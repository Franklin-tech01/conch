// CONCH Platform - Main Entry Point
// A mythic, modern landing portal and real-time Conch memory system

mod api;
mod auth;
mod conch;
mod db;
mod events;
mod models;
mod state;
mod websocket;

use std::net::SocketAddr;

use axum::{
    routing::{get, post, put, delete},
    Router,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use db::{create_pool, run_migrations};
use state::AppState;

#[derive(Clone)]
struct Config {
    database_url: String,
    redis_url: Option<String>,
}

impl Config {
    fn from_env() -> Self {
        Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/conch".to_string()),
            redis_url: std::env::var("REDIS_URL").ok(),
        }
    }
}

#[tokio::main]
async fn main() {
    // Initialize logging
    let _ = tracing_subscriber::fmt()
        .with_env_filter("conch_api=debug,tower_http=debug")
        .try_init();

    println!("🐚 CONCH Platform starting...");

    // Load configuration
    let config = Config::from_env();

    // Initialize database connection pool
    let pool = create_pool(&config.database_url)
        .await
        .expect("Failed to create database pool");

    // Run migrations
    run_migrations(&pool)
        .await
        .expect("Failed to run migrations");
    
    // Run additional migrations for new features
    db::create_follows_table(&pool)
        .await
        .expect("Failed to create follows table");
    db::create_notifications_table(&pool)
        .await
        .expect("Failed to create notifications table");
    db::create_conch_versions_table(&pool)
        .await
        .expect("Failed to create conch_versions table");
    db::create_likes_table(&pool)
        .await
        .expect("Failed to create likes table");
    db::create_comments_table(&pool)
        .await
        .expect("Failed to create comments table");
    db::create_tags_table(&pool)
        .await
        .expect("Failed to create tags table");
    db::add_user_profile_fields(&pool)
        .await
        .expect("Failed to add user profile fields");

    println!("📦 Database connected and migrations complete");

    // Create application state
    let app_state = AppState::new(pool, config.redis_url.as_deref()).await;

    println!("🚀 Application state initialized");

    // Build the router
    let app = Router::new()
        .route("/", get(root_handler))
        .route("/health", get(api::health))
        .route("/api/conches", get(api::list_conches))
        .route("/api/conches", post(api::create_conch))
        .route("/api/conches/:id", get(api::get_conch))
        .route("/api/conches/:id", put(api::update_conch))
        .route("/api/conches/:id", delete(api::delete_conch))
        .route("/api/conches/:id/links", get(api::get_links))
        .route("/api/conches/:id/links", post(api::create_link))
        .route("/api/links", get(api::get_all_links))
        .route("/api/graph", get(api::get_graph_data))
        .route("/api/conch/parse", post(api::parse_conch_handler))
        .route("/api/conch/validate", post(api::validate_conch_handler))
        .route("/api/conch/new", post(api::new_conch_handler))
        .route("/ws", get(websocket::ws_handler))
        .route("/events", get(websocket::events_handler))
        .with_state(std::sync::Arc::new(app_state));

    // Start the server
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3000".to_string())
        .parse()
        .unwrap_or(3000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("🎭 Server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

/// Root handler
async fn root_handler() -> &'static str {
    r#"
    🐚 CONCH Platform API
    
    Endpoints:
    - GET  /health              - Health check
    - GET  /api/conches         - List all Conches
    - POST /api/conches         - Create a new Conch
    - GET  /api/conches/:id     - Get a specific Conch
    - PUT  /api/conches/:id     - Update a Conch
    - DEL  /api/conches/:id     - Delete a Conch
    - GET  /api/conches/:id/links - Get Conch links
    - POST /api/conches/:id/links - Link two Conches
    - GET  /api/links           - Get all links
    - GET  /api/graph           - Get full graph
    - WS  /ws                   - WebSocket for real-time updates
    - GET /events               - SSE for real-time updates
    "#
}
