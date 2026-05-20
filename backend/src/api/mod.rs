// API handlers module

use axum::{
    extract::{Path, Query, State},
    http::{StatusCode, header, HeaderMap},
    response::Json,
    routing::{delete, get, post, put},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::auth;
use crate::db;
use crate::state::AppState;

/// List query parameters
#[derive(Deserialize)]
pub struct ListQuery {
    page: Option<i32>,
    page_size: Option<i32>,
}

/// Standard API response wrapper
pub fn success_response<T: Serialize>(data: T) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "success": true,
        "data": data
    }))
}

/// Error response
pub fn error_response(message: &str, status: StatusCode) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({
        "success": false,
        "error": message
    })))
}

/// Get current user from Authorization header
/// In production this would parse/verify a JWT and return the associated username.
///
/// Returns `Some(username)` when a bearer token is present and looks valid, or
/// `None` when the request is unauthenticated.  **Do not** rely on the string
/// "anonymous" in application logic – authentication is required for many
/// operations and unwrapped values should be handled explicitly.
/// Extract identity from the X-Public-Key header.
/// The public key IS the identity — no accounts, no sessions.
fn get_current_user(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get("X-Public-Key")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

/// Register request body
#[derive(Deserialize)]
pub struct RegisterBody {
    pub username: String,
    pub email: String,
    pub password: String,
}

/// Login request body
#[derive(Deserialize)]
pub struct LoginBody {
    pub email: String,
    pub password: String,
}

/// POST /api/auth/register
pub async fn register_user(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RegisterBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if payload.username.trim().is_empty() || payload.email.trim().is_empty() || payload.password.len() < 6 {
        return Err(error_response("Username, email and password (min 6 chars) are required", StatusCode::BAD_REQUEST));
    }

    match db::get_user_by_email(&state.db, &payload.email).await {
        Ok(Some(_)) => return Err(error_response("Email already registered", StatusCode::CONFLICT)),
        Err(e) => return Err(error_response(&format!("Database error: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
        Ok(None) => {}
    }

    let password_hash = auth::hash_password(&payload.password);

    let user_id = db::create_user(&state.db, &payload.username, &payload.email, &password_hash)
        .await
        .map_err(|e| {
            if e.to_string().contains("unique") || e.to_string().contains("duplicate") {
                error_response("Username already taken", StatusCode::CONFLICT)
            } else {
                error_response(&format!("Failed to create user: {}", e), StatusCode::INTERNAL_SERVER_ERROR)
            }
        })?;

    let token = auth::generate_token(&user_id, &payload.username, &payload.email)
        .map_err(|e| error_response(&format!("Token error: {}", e), StatusCode::INTERNAL_SERVER_ERROR))?;

    Ok(success_response(serde_json::json!({
        "token": token,
        "user": { "id": user_id, "username": payload.username, "email": payload.email }
    })))
}

/// POST /api/auth/login
pub async fn login_user(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let user = db::get_user_by_email(&state.db, &payload.email)
        .await
        .map_err(|e| error_response(&format!("Database error: {}", e), StatusCode::INTERNAL_SERVER_ERROR))?
        .ok_or_else(|| error_response("Invalid email or password", StatusCode::UNAUTHORIZED))?;

    let password_hash = user["password_hash"].as_str().unwrap_or("");
    if !auth::verify_password(&payload.password, password_hash) {
        return Err(error_response("Invalid email or password", StatusCode::UNAUTHORIZED));
    }

    let user_id = user["id"].as_str().unwrap_or("");
    let username = user["username"].as_str().unwrap_or("");
    let email = user["email"].as_str().unwrap_or("");

    let token = auth::generate_token(user_id, username, email)
        .map_err(|e| error_response(&format!("Token error: {}", e), StatusCode::INTERNAL_SERVER_ERROR))?;

    Ok(success_response(serde_json::json!({
        "token": token,
        "user": { "id": user_id, "username": username, "email": email }
    })))
}

/// Helper wrapper used inside handlers to short-circuit with a 401 error when
/// no authenticated user is present.
fn require_user(headers: &axum::http::HeaderMap) -> Result<String, (StatusCode, Json<serde_json::Value>)> {
    match get_current_user(headers) {
        Some(u) => Ok(u),
        None => Err(error_response("Authentication required", StatusCode::UNAUTHORIZED)),
    }
}

/// Health check endpoint
pub async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "conch-api",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

/// List all conches
pub async fn list_conches(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20).min(100);
    
    match db::list_conches(&state.db, page, page_size).await {
        Ok(conches) => Ok(success_response(conches)),
        Err(e) => Err(error_response(&format!("Failed to list conches: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Get a single conch by ID
pub async fn get_conch(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::get_conch(&state.db, id).await {
        Ok(Some(conch)) => Ok(success_response(conch)),
        Ok(None) => Err(error_response("Conch not found", StatusCode::NOT_FOUND)),
        Err(e) => Err(error_response(&format!("Failed to get conch: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Create conch request
#[derive(Deserialize)]
pub struct CreateConchRequest {
    pub state: Option<serde_json::Value>,
    pub story: Option<String>,
    pub intent: Option<String>,
    pub owner: Option<String>,
}

/// Create a new conch
pub async fn create_conch(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<CreateConchRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let state_ref = state.as_ref();

    // determine the owner: prefer explicit owner in request, then authenticated
    // user, then fall back to "anonymous" so unauthenticated users can still create.
    let owner = if let Some(o) = payload.owner.clone() {
        o
    } else {
        require_user(&headers).unwrap_or_else(|_| "anonymous".to_string())
    };

    let state_json = payload.state.unwrap_or(serde_json::json!({}));
    let story = payload.story.unwrap_or_default();
    let intent = payload.intent.unwrap_or_default();

    match db::create_conch(&state_ref.db, state_json, story, intent, &owner).await {
        Ok(conch) => {
            // Broadcast the event
            let event = serde_json::json!({
                "type": "conch_created",
                "data": &conch
            });
            let _ = state_ref.event_sender.send(event.to_string());

            // Broadcast via WebSocket
            let ws_manager = state_ref.ws_manager.read().await;
            ws_manager.broadcast(&event.to_string()).await;

            Ok(success_response(conch))
        }
        Err(e) => Err(error_response(&format!("Failed to create conch: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Update conch request
#[derive(Deserialize)]
pub struct UpdateConchRequest {
    pub state: Option<serde_json::Value>,
    pub story: Option<String>,
    pub intent: Option<String>,
}

/// Update a conch
pub async fn update_conch(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
    Json(payload): Json<UpdateConchRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let state_ref = state.as_ref();
    
    let conch = match db::get_conch(&state_ref.db, id).await {
        Ok(Some(c)) => c,
        Ok(None) => return Err(error_response("Conch not found", StatusCode::NOT_FOUND)),
        Err(e) => return Err(error_response(&format!("Failed to get conch: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    };
    
    let state_json = payload.state.unwrap_or(serde_json::json!({}));
    let story = payload.story.or_else(|| conch.get("story").and_then(|s| s.as_str()).map(String::from)).unwrap_or_default();
    let intent = payload.intent.or_else(|| conch.get("intent").and_then(|s| s.as_str()).map(String::from)).unwrap_or_default();
    
    match db::update_conch(&state_ref.db, id, state_json, story, intent).await {
        Ok(Some(updated)) => {
            // Broadcast the event
            let event = serde_json::json!({
                "type": "conch_updated",
                "data": &updated
            });
            let _ = state_ref.event_sender.send(event.to_string());
            
            // Broadcast via WebSocket
            let ws_manager = state_ref.ws_manager.read().await;
            ws_manager.broadcast(&event.to_string()).await;
            
            Ok(success_response(updated))
        }
        Ok(None) => Err(error_response("Conch not found", StatusCode::NOT_FOUND)),
        Err(e) => Err(error_response(&format!("Failed to update conch: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Delete a conch
pub async fn delete_conch(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let state_ref = state.as_ref();
    
    match db::delete_conch(&state_ref.db, id).await {
        Ok(true) => {
            // Broadcast the event
            let event = serde_json::json!({
                "type": "conch_deleted",
                "data": { "id": id.to_string() }
            });
            let _ = state_ref.event_sender.send(event.to_string());
            
            // Broadcast via WebSocket
            let ws_manager = state_ref.ws_manager.read().await;
            ws_manager.broadcast(&event.to_string()).await;
            
            Ok(success_response(serde_json::json!({ "deleted": true })))
        }
        Ok(false) => Err(error_response("Conch not found", StatusCode::NOT_FOUND)),
        Err(e) => Err(error_response(&format!("Failed to delete conch: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Create link request
#[derive(Deserialize)]
pub struct CreateLinkRequest {
    pub target_id: uuid::Uuid,
    pub link_type: Option<String>,
}

/// Create a link between two conches
pub async fn create_link(
    State(state): State<Arc<AppState>>,
    Path(source_id): Path<uuid::Uuid>,
    Json(payload): Json<CreateLinkRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let state_ref = state.as_ref();
    
    // Verify source exists
    match db::get_conch(&state_ref.db, source_id).await {
        Ok(None) => return Err(error_response("Source conch not found", StatusCode::NOT_FOUND)),
        Err(e) => return Err(error_response(&format!("Failed to verify source: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
        _ => {}
    }
    
    // Verify target exists
    match db::get_conch(&state_ref.db, payload.target_id).await {
        Ok(None) => return Err(error_response("Target conch not found", StatusCode::NOT_FOUND)),
        Err(e) => return Err(error_response(&format!("Failed to verify target: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
        _ => {}
    }
    
    let link_type = payload.link_type.unwrap_or_else(|| "references".to_string());
    
    match db::create_link(&state_ref.db, source_id, payload.target_id, link_type).await {
        Ok(link) => {
            // Broadcast the event
            let event = serde_json::json!({
                "type": "link_created",
                "data": &link
            });
            let _ = state_ref.event_sender.send(event.to_string());
            
            // Broadcast via WebSocket
            let ws_manager = state_ref.ws_manager.read().await;
            ws_manager.broadcast(&event.to_string()).await;
            
            Ok(success_response(link))
        }
        Err(e) => Err(error_response(&format!("Failed to create link: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Get links for a conch
pub async fn get_links(
    State(state): State<Arc<AppState>>,
    Path(conch_id): Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::get_links(&state.db, conch_id).await {
        Ok(links) => Ok(success_response(links)),
        Err(e) => Err(error_response(&format!("Failed to get links: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Get all links (for graph view)
pub async fn get_all_links(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::get_all_links(&state.db).await {
        Ok(links) => Ok(success_response(links)),
        Err(e) => Err(error_response(&format!("Failed to get links: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Get conches with their links (for graph view)
pub async fn get_graph_data(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let conches = match db::list_conches(&state.db, 1, 1000).await {
        Ok(c) => c,
        Err(e) => return Err(error_response(&format!("Failed to get conches: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    };
    
    let links = match db::get_all_links(&state.db).await {
        Ok(l) => l,
        Err(e) => return Err(error_response(&format!("Failed to get links: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    };
    
    Ok(success_response(serde_json::json!({
        "conches": conches,
        "links": links
    })))
}

/// Search query parameters
#[derive(Deserialize)]
pub struct SearchQuery {
    q: Option<String>,
    tags: Option<String>,
    author: Option<String>,
    state: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    sort: Option<String>,
    page: Option<i32>,
    page_size: Option<i32>,
}

/// Search conches with filters
pub async fn search_conches(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let tags: Option<Vec<String>> = query.tags.map(|t| t.split(',').map(String::from).collect());
    let sort_by = query.sort.unwrap_or_else(|| "date_desc".to_string());
    let page = query.page.unwrap_or(1);
    let page_size = query.page_size.unwrap_or(20).min(100);
    
    match db::search_conches(
        &state.db,
        query.q,
        tags,
        query.author,
        query.state,
        query.date_from,
        query.date_to,
        &sort_by,
        page,
        page_size,
    ).await {
        Ok(conches) => Ok(success_response(conches)),
        Err(e) => Err(error_response(&format!("Search failed: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ============ USER PROFILES ============

/// Get user profile
pub async fn get_user_profile(
    State(state): State<Arc<AppState>>,
    Path(username): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::get_user_profile(&state.db, &username).await {
        Ok(Some(profile)) => Ok(success_response(profile)),
        Ok(None) => Err(error_response("User not found", StatusCode::NOT_FOUND)),
        Err(e) => Err(error_response(&format!("Failed to get profile: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Update user profile request
#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub cover_image: Option<String>,
    pub expertise: Option<Vec<String>>,
}

/// Update user profile
pub async fn update_user_profile(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(username): Path<String>,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    // Get current authenticated user (must exist)
    let current_user = require_user(&headers)?;
    
    // Authorization check: only the profile owner can update their profile
    if current_user != username {
        return Err(error_response("You can only update your own profile", StatusCode::FORBIDDEN));
    }
    
    match db::update_user_profile(
        &state.db,
        &username,
        payload.bio,
        payload.avatar_url,
        payload.cover_image,
        payload.expertise,
    ).await {
        Ok(_) => Ok(success_response(serde_json::json!({"updated": true}))),
        Err(e) => Err(error_response(&format!("Failed to update profile: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ============ FOLLOWS ============

/// Follow a user request
#[derive(Deserialize)]
pub struct FollowRequest {
    pub username: String,
}

/// Follow a user
pub async fn follow_user(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<FollowRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let current_user = require_user(&headers)?;

    match db::follow_user(&state.db, &current_user, &payload.username).await {
        Ok(_) => {
            // Create notification
            let _ = db::create_notification(
                &state.db,
                &payload.username,
                "follow",
                Some(&current_user),
                None,
                &format!("{} started following you", current_user),
            ).await;
            Ok(success_response(serde_json::json!({"following": true})))
        }
        Err(e) => Err(error_response(&format!("Failed to follow: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Unfollow a user
pub async fn unfollow_user(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(username): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let current_user = require_user(&headers)?;

    match db::unfollow_user(&state.db, &current_user, &username).await {
        Ok(_) => Ok(success_response(serde_json::json!({"following": false}))),
        Err(e) => Err(error_response(&format!("Failed to unfollow: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Get followers count
pub async fn get_followers(
    State(state): State<Arc<AppState>>,
    Path(username): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::get_followers_count(&state.db, &username).await {
        Ok(count) => Ok(success_response(serde_json::json!({ "count": count }))),
        Err(e) => Err(error_response(&format!("Failed to get followers: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Get following count
pub async fn get_following(
    State(state): State<Arc<AppState>>,
    Path(username): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::get_following_count(&state.db, &username).await {
        Ok(count) => Ok(success_response(serde_json::json!({ "count": count }))),
        Err(e) => Err(error_response(&format!("Failed to get following: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Check if current user follows given username
pub async fn check_follow_status(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Path(username): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let current_user = require_user(&headers)?;
    match db::is_following(&state.db, &current_user, &username).await {
        Ok(flag) => Ok(success_response(serde_json::json!({ "following": flag }))),
        Err(e) => Err(error_response(&format!("Failed to check follow status: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ============ NOTIFICATIONS ============

/// Get notifications
pub async fn get_notifications(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let username = require_user(&headers)?;
    let limit = query.page_size.unwrap_or(20);
    
    match db::get_notifications(&state.db, &username, limit).await {
        Ok(notifications) => Ok(success_response(notifications)),
        Err(e) => Err(error_response(&format!("Failed to get notifications: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Mark notification as read
pub async fn mark_notification_read(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::mark_notification_read(&state.db, id).await {
        Ok(_) => Ok(success_response(serde_json::json!({"read": true}))),
        Err(e) => Err(error_response(&format!("Failed to mark read: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ============ NOTIFICATIONS ============

/// Update notification preferences
pub async fn update_notification_preferences(
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
    Path(username): Path<String>,
    Json(prefs): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let current_user = require_user(&headers)?;
    
    // Ensure user can only update their own preferences
    if current_user != username {
        return Err(error_response("Cannot update other users' preferences", StatusCode::FORBIDDEN));
    }
    
    match db::update_notification_preferences(&state.db, &username, prefs).await {
        Ok(_) => Ok(success_response(serde_json::json!({"updated": true}))),
        Err(e) => Err(error_response(&format!("Failed to update preferences: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ============ VERSION HISTORY ============

/// Get conch versions
pub async fn get_conch_versions(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::get_conch_versions(&state.db, id).await {
        Ok(versions) => Ok(success_response(versions)),
        Err(e) => Err(error_response(&format!("Failed to get versions: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ============ LIKES ============

/// Like a conch request
#[derive(Deserialize)]
pub struct LikeRequest {
    pub username: String,
}

/// Like a conch
pub async fn like_conch(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
    Json(payload): Json<LikeRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::like_conch(&state.db, id, &payload.username).await {
        Ok(_) => {
            // Get conch owner for notification
            if let Ok(Some(conch)) = db::get_conch(&state.db, id).await {
                if let Some(owner) = conch.get("owner").and_then(|o| o.as_str()) {
                    if owner != payload.username {
                        let _ = db::create_notification(
                            &state.db,
                            owner,
                            "like",
                            Some(&payload.username),
                            Some(id),
                            &format!("{} liked your Conch", payload.username),
                        ).await;
                    }
                }
            }
            Ok(success_response(serde_json::json!({"liked": true})))
        }
        Err(e) => Err(error_response(&format!("Failed to like: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Unlike a conch
pub async fn unlike_conch(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(id): Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let username = require_user(&headers)?;
    match db::unlike_conch(&state.db, id, &username).await {
        Ok(_) => Ok(success_response(serde_json::json!({"liked": false}))),
        Err(e) => Err(error_response(&format!("Failed to unlike: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Get likes count for a conch
pub async fn get_conch_likes(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::get_likes_count(&state.db, id).await {
        Ok(count) => Ok(success_response(serde_json::json!({ "likes": count }))),
        Err(e) => Err(error_response(&format!("Failed to get likes: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ============ COMMENTS ============

/// Add comment request
#[derive(Deserialize)]
pub struct CommentRequest {
    pub username: String,
    pub content: String,
    pub parent_id: Option<uuid::Uuid>,
}

/// Add comment to conch
pub async fn add_comment(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
    Json(payload): Json<CommentRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::add_comment(&state.db, id, payload.parent_id, &payload.username, &payload.content).await {
        Ok(comment) => {
            // Get conch owner for notification
            if let Ok(Some(conch)) = db::get_conch(&state.db, id).await {
                if let Some(owner) = conch.get("owner").and_then(|o| o.as_str()) {
                    if owner != payload.username {
                        let _ = db::create_notification(
                            &state.db,
                            owner,
                            "comment",
                            Some(&payload.username),
                            Some(id),
                            &format!("{} commented on your Conch", payload.username),
                        ).await;
                    }
                }
            }
            Ok(success_response(comment))
        }
        Err(e) => Err(error_response(&format!("Failed to add comment: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Get comments for a conch
pub async fn get_comments(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::get_comments(&state.db, id).await {
        Ok(comments) => Ok(success_response(comments)),
        Err(e) => Err(error_response(&format!("Failed to get comments: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ============ TAGS ============

/// Add tags request
#[derive(Deserialize)]
pub struct AddTagsRequest {
    pub tags: Vec<String>,
}

/// Add tags to a conch
pub async fn add_conch_tags(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
    Json(payload): Json<AddTagsRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::add_tags_to_conch(&state.db, id, payload.tags).await {
        Ok(_) => Ok(success_response(serde_json::json!({"tags_added": true}))),
        Err(e) => Err(error_response(&format!("Failed to add tags: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Get tags for a conch
pub async fn get_conch_tags(
    State(state): State<Arc<AppState>>,
    Path(id): Path<uuid::Uuid>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match db::get_conch_tags(&state.db, id).await {
        Ok(tags) => Ok(success_response(tags)),
        Err(e) => Err(error_response(&format!("Failed to get tags: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

/// Tag search query
#[derive(Deserialize)]
pub struct TagSearchQuery {
    q: String,
    limit: Option<i32>,
}

/// Search tags (auto-suggest)
pub async fn search_tags(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TagSearchQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let limit = query.limit.unwrap_or(10);
    match db::search_tags(&state.db, &query.q, limit).await {
        Ok(tags) => Ok(success_response(tags)),
        Err(e) => Err(error_response(&format!("Search failed: {}", e), StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

// ============ CONCH PARSER / VALIDATOR / BUILDER ============

/// POST /api/conch/parse
/// Body: { "json": "<raw .conch JSON string>" }
pub async fn parse_conch_handler(
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let raw = payload["json"]
        .as_str()
        .ok_or_else(|| error_response("Body must contain a 'json' string field", StatusCode::BAD_REQUEST))?;

    match crate::conch::parse_conch(raw) {
        Ok(obj) => Ok(success_response(serde_json::to_value(obj).unwrap())),
        Err(e) => Err(error_response(&e.to_string(), StatusCode::UNPROCESSABLE_ENTITY)),
    }
}

/// POST /api/conch/validate
/// Body: { "json": "<raw .conch JSON string>" }
/// Returns all validation errors, not just the first.
pub async fn validate_conch_handler(
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let raw = payload["json"]
        .as_str()
        .ok_or_else(|| error_response("Body must contain a 'json' string field", StatusCode::BAD_REQUEST))?;

    let obj = crate::conch::parse_conch(raw)
        .map_err(|e| error_response(&e.to_string(), StatusCode::UNPROCESSABLE_ENTITY))?;

    match crate::conch::validate_conch(&obj) {
        Ok(()) => Ok(success_response(serde_json::json!({ "valid": true, "errors": [] }))),
        Err(errors) => {
            let error_strs: Vec<String> = errors.iter().map(|e| e.to_string()).collect();
            Ok(Json(serde_json::json!({
                "success": true,
                "data": { "valid": false, "errors": error_strs }
            })))
        }
    }
}

/// POST /api/conch/new
/// Body: { "creator": "<pubkey_hex>", "fields": [...], "data": {...} }
/// Returns a freshly built ConchObject ready to store or sign.
pub async fn new_conch_handler(
    headers: axum::http::HeaderMap,
    Json(payload): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let creator = payload["creator"]
        .as_str()
        .map(String::from)
        .or_else(|| get_current_user(&headers))
        .unwrap_or_else(|| "anonymous".to_string());

    let mut builder = crate::conch::ConchBuilder::new(&creator);

    if let Some(fields) = payload["fields"].as_array() {
        for f in fields {
            let name = f["name"].as_str().unwrap_or("").to_string();
            let type_str = f["type"].as_str().unwrap_or("string");
            let required = f["required"].as_bool().unwrap_or(false);
            let description = f["description"].as_str().unwrap_or("").to_string();

            let field_type = match type_str {
                "number" => crate::conch::FieldType::Number,
                "boolean" => crate::conch::FieldType::Boolean,
                "array" => crate::conch::FieldType::Array,
                "object" => crate::conch::FieldType::Object,
                _ => crate::conch::FieldType::String,
            };

            if !name.is_empty() {
                builder = builder.field(name, field_type, required, description);
            }
        }
    }

    if let Some(data_obj) = payload["data"].as_object() {
        for (k, v) in data_obj {
            builder = builder.data(k.clone(), v.clone());
        }
    }

    let obj = builder.build();
    Ok(success_response(serde_json::to_value(obj).unwrap()))
}

/// Create router with all routes
pub fn create_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/health", get(health))
        .route("/conches", get(list_conches))
        .route("/conches", post(create_conch))
        .route("/conches/:id", get(get_conch))
        .route("/conches/:id", put(update_conch))
        .route("/conches/:id", delete(delete_conch))
        .route("/conches/:id/links", get(get_links))
        .route("/conches/:id/links", post(create_link))
        .route("/conches/:id/versions", get(get_conch_versions))
        .route("/conches/:id/likes", get(get_conch_likes))
        .route("/conches/:id/likes", post(like_conch))
        .route("/conches/:id/likes", delete(unlike_conch))
        .route("/conches/:id/comments", get(get_comments))
        .route("/conches/:id/comments", post(add_comment))
        .route("/conches/:id/tags", get(get_conch_tags))
        .route("/conches/:id/tags", post(add_conch_tags))
        .route("/links", get(get_all_links))
        .route("/graph", get(get_graph_data))
        .route("/search", get(search_conches))
        .route("/users/:username", get(get_user_profile))
        .route("/users/:username/preferences", put(update_notification_preferences))
        .route("/users/:username/followers", get(get_followers))
        .route("/users/:username/following", get(get_following))
        .route("/follow", post(follow_user))
        .route("/follow/:username", delete(unfollow_user))
        .route("/follow/status/:username", get(check_follow_status))
        .route("/notifications", get(get_notifications))
        .route("/notifications/:id/read", put(mark_notification_read))
        .route("/tags/search", get(search_tags))
        .route("/conch/parse", post(parse_conch_handler))
        .route("/conch/validate", post(validate_conch_handler))
        .route("/conch/new", post(new_conch_handler))
}
