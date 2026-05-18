// Database module - PostgreSQL operations

use sqlx::postgres::{PgPoolOptions, PgRow};
use sqlx::Row;
use sqlx::Postgres;
use std::time::Duration;
use std::sync::Arc;

/// Database pool type
pub type DbPool = sqlx::Pool<Postgres>;

/// Create a new database pool
pub async fn create_pool(database_url: &str) -> Result<DbPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(30))
        .connect(database_url)
        .await
}

/// Run migrations - split into individual statements for Neon compatibility
pub async fn run_migrations(pool: &DbPool) -> Result<(), sqlx::Error> {
    // Create conches table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS conches (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            state JSONB NOT NULL DEFAULT '{}',
            story TEXT NOT NULL DEFAULT '',
            lineage UUID[] NOT NULL DEFAULT '{}',
            intent TEXT NOT NULL DEFAULT '',
            era INTEGER NOT NULL DEFAULT 1,
            owner TEXT NOT NULL DEFAULT 'anonymous',
            permissions JSONB NOT NULL DEFAULT '{}',
            signature TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )"
    )
    .execute(pool)
    .await?;
    
    // Create conch_links table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS conch_links (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source_id UUID NOT NULL REFERENCES conches(id) ON DELETE CASCADE,
            target_id UUID NOT NULL REFERENCES conches(id) ON DELETE CASCADE,
            link_type TEXT NOT NULL DEFAULT 'references',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE(source_id, target_id)
        )"
    )
    .execute(pool)
    .await?;
    
    // Create users table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            public_key TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )"
    )
    .execute(pool)
    .await?;
    
    // Create indexes
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conches_owner ON conches(owner)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conches_era ON conches(era)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conches_state ON conches USING GIN(state)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conch_links_source ON conch_links(source_id)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conch_links_target ON conch_links(target_id)")
        .execute(pool)
        .await?;
    
    Ok(())
}

/// List all conches with pagination
pub async fn list_conches(pool: &DbPool, page: i32, page_size: i32) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let offset = (page - 1) * page_size;
    let rows = sqlx::query(
        "SELECT id, state, story, lineage, intent, era, owner, permissions, signature, created_at, updated_at 
         FROM conches ORDER BY created_at DESC LIMIT $1 OFFSET $2"
    )
    .bind(page_size)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    
    let conches: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "state": row.get::<serde_json::Value, _>("state"),
            "story": row.get::<String, _>("story"),
            "lineage": row.get::<Vec<uuid::Uuid>, _>("lineage"),
            "intent": row.get::<String, _>("intent"),
            "era": row.get::<i32, _>("era"),
            "owner": row.get::<String, _>("owner"),
            "permissions": row.get::<serde_json::Value, _>("permissions"),
            "signature": row.get::<String, _>("signature"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            "updated_at": row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at").to_rfc3339(),
        })
    }).collect();
    
    Ok(conches)
}

/// Get a single conch by ID
pub async fn get_conch(pool: &DbPool, id: uuid::Uuid) -> Result<Option<serde_json::Value>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT id, state, story, lineage, intent, era, owner, permissions, signature, created_at, updated_at 
         FROM conches WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    
    match row {
        Some(row) => Ok(Some(serde_json::json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "state": row.get::<serde_json::Value, _>("state"),
            "story": row.get::<String, _>("story"),
            "lineage": row.get::<Vec<uuid::Uuid>, _>("lineage"),
            "intent": row.get::<String, _>("intent"),
            "era": row.get::<i32, _>("era"),
            "owner": row.get::<String, _>("owner"),
            "permissions": row.get::<serde_json::Value, _>("permissions"),
            "signature": row.get::<String, _>("signature"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            "updated_at": row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at").to_rfc3339(),
        }))),
        None => Ok(None),
    }
}

/// Create a new conch
pub async fn create_conch(
    pool: &DbPool,
    state: serde_json::Value,
    story: String,
    intent: String,
    owner: &str,
) -> Result<serde_json::Value, sqlx::Error> {
    let id = uuid::Uuid::new_v4();
    
    // Insert with empty state first
    let row: PgRow = sqlx::query(
        "INSERT INTO conches (id, state, story, lineage, intent, era, owner, permissions, signature) 
         VALUES ($1, '{}'::jsonb, $2, $3, $4, 1, $5, '{}'::jsonb, '')
         RETURNING id, state, story, lineage, intent, era, owner, permissions, signature, created_at, updated_at"
    )
    .bind(id)
    .bind(&story)
    .bind(&[] as &[uuid::Uuid])
    .bind(&intent)
    .bind(owner)
    .fetch_one(pool)
    .await?;
    
    // Now update with the actual state JSON
    let state_json = serde_json::to_string(&state).unwrap_or_else(|_| "{}".to_string());
    sqlx::query("UPDATE conches SET state = $1::jsonb WHERE id = $2")
        .bind(&state_json)
        .bind(id)
        .execute(pool)
        .await?;
    
    // Get the created conch
    match get_conch(pool, id).await {
        Ok(Some(conch)) => Ok(conch),
        Ok(None) => Err(sqlx::Error::RowNotFound),
        Err(e) => Err(e),
    }
}

/// Update a conch
pub async fn update_conch(
    pool: &DbPool,
    id: uuid::Uuid,
    state: serde_json::Value,
    story: String,
    intent: String,
) -> Result<Option<serde_json::Value>, sqlx::Error> {
    let state_json = serde_json::to_string(&state).unwrap_or_else(|_| "{}".to_string());
    
    let rows_affected = sqlx::query(
        "UPDATE conches SET state = $1::jsonb, story = $2, intent = $3, era = era + 1, updated_at = NOW() WHERE id = $4"
    )
    .bind(&state_json)
    .bind(&story)
    .bind(&intent)
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();
    
    if rows_affected > 0 {
        get_conch(pool, id).await
    } else {
        Ok(None)
    }
}

/// Delete a conch
pub async fn delete_conch(pool: &DbPool, id: uuid::Uuid) -> Result<bool, sqlx::Error> {
    let rows_affected = sqlx::query("DELETE FROM conches WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    
    Ok(rows_affected > 0)
}

/// Create a link between two conches
pub async fn create_link(
    pool: &DbPool,
    source_id: uuid::Uuid,
    target_id: uuid::Uuid,
    link_type: String,
) -> Result<serde_json::Value, sqlx::Error> {
    let id = uuid::Uuid::new_v4();
    
    sqlx::query(
        "INSERT INTO conch_links (id, source_id, target_id, link_type) VALUES ($1, $2, $3, $4)
         ON CONFLICT (source_id, target_id) DO NOTHING"
    )
    .bind(id)
    .bind(source_id)
    .bind(target_id)
    .bind(&link_type)
    .execute(pool)
    .await?;
    
    Ok(serde_json::json!({
        "id": id,
        "source_id": source_id,
        "target_id": target_id,
        "link_type": link_type,
        "created_at": chrono::Utc::now().to_rfc3339(),
    }))
}

/// Get links for a conch
pub async fn get_links(pool: &DbPool, conch_id: uuid::Uuid) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, source_id, target_id, link_type, created_at FROM conch_links WHERE source_id = $1 OR target_id = $1"
    )
    .bind(conch_id)
    .fetch_all(pool)
    .await?;
    
    let links: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "source_id": row.get::<uuid::Uuid, _>("source_id"),
            "target_id": row.get::<uuid::Uuid, _>("target_id"),
            "link_type": row.get::<String, _>("link_type"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
        })
    }).collect();
    
    Ok(links)
}

/// Get all links
pub async fn get_all_links(pool: &DbPool) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, source_id, target_id, link_type, created_at FROM conch_links"
    )
    .fetch_all(pool)
    .await?;
    
    let links: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "source_id": row.get::<uuid::Uuid, _>("source_id"),
            "target_id": row.get::<uuid::Uuid, _>("target_id"),
            "link_type": row.get::<String, _>("link_type"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
        })
    }).collect();
    
    Ok(links)
}

// ============ USER PROFILES ============

/// Add profile fields to users table
pub async fn add_user_profile_fields(pool: &DbPool) -> Result<(), sqlx::Error> {
    sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT ''")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT ''")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image TEXT DEFAULT ''")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS expertise TEXT[] DEFAULT '{}'")
        .execute(pool)
        .await?;
    sqlx::query("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)")
        .execute(pool)
        .await?;
    sqlx::query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
            \"mute_users\": [],
            \"mute_conches\": [],
            \"email_notifications\": true,
            \"push_notifications\": true,
            \"mentions\": true,
            \"follows\": true,
            \"likes\": true,
            \"comments\": true,
            \"digest\": \"daily\"
        }'::jsonb"
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Get user profile by username
pub async fn get_user_profile(pool: &DbPool, username: &str) -> Result<Option<serde_json::Value>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT id, username, email, public_key, bio, avatar_url, cover_image, expertise, notification_preferences, created_at 
         FROM users WHERE username = $1"
    )
    .bind(username)
    .fetch_optional(pool)
    .await?;
    
    match row {
        Some(row) => Ok(Some(serde_json::json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "username": row.get::<String, _>("username"),
            "email": row.get::<String, _>("email"),
            "public_key": row.get::<Option<String>, _>("public_key"),
            "bio": row.get::<String, _>("bio"),
            "avatar_url": row.get::<String, _>("avatar_url"),
            "cover_image": row.get::<String, _>("cover_image"),
            "expertise": row.get::<Vec<String>, _>("expertise"),
            "notification_preferences": row.get::<serde_json::Value, _>("notification_preferences"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
        }))),
        None => Ok(None),
    }
}

/// Update user profile
pub async fn update_user_profile(
    pool: &DbPool,
    username: &str,
    bio: Option<String>,
    avatar_url: Option<String>,
    cover_image: Option<String>,
    expertise: Option<Vec<String>>,
) -> Result<bool, sqlx::Error> {
    // For now, return false as users table may not exist
    // In production, this would update the users table
    let _ = (pool, username, bio, avatar_url, cover_image, expertise);
    Ok(false)
}

// ============ FOLLOWS ============

/// Create follows table
pub async fn create_follows_table(pool: &DbPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS follows (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            follower_username TEXT NOT NULL,
            following_username TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE(follower_username, following_username)
        )"
    )
    .execute(pool)
    .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_username)")
        .execute(pool)
        .await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_username)")
        .execute(pool)
        .await?;
    
    Ok(())
}

/// Follow a user
pub async fn follow_user(pool: &DbPool, follower: &str, following: &str) -> Result<bool, sqlx::Error> {
    sqlx::query(
        "INSERT INTO follows (follower_username, following_username) VALUES ($1, $2) 
         ON CONFLICT (follower_username, following_username) DO NOTHING"
    )
    .bind(follower)
    .bind(following)
    .execute(pool)
    .await?;
    
    Ok(true)
}

/// Unfollow a user
pub async fn unfollow_user(pool: &DbPool, follower: &str, following: &str) -> Result<bool, sqlx::Error> {
    sqlx::query("DELETE FROM follows WHERE follower_username = $1 AND following_username = $2")
        .bind(follower)
        .bind(following)
        .execute(pool)
        .await?;
    
    Ok(true)
}

/// Get followers count
pub async fn get_followers_count(pool: &DbPool, username: &str) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM follows WHERE following_username = $1"
    )
    .bind(username)
    .fetch_one(pool)
    .await?;
    
    Ok(row.0)
}

/// Get following count
pub async fn get_following_count(pool: &DbPool, username: &str) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM follows WHERE follower_username = $1"
    )
    .bind(username)
    .fetch_one(pool)
    .await?;
    
    Ok(row.0)
}

/// Check if following
pub async fn is_following(pool: &DbPool, follower: &str, following: &str) -> Result<bool, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM follows WHERE follower_username = $1 AND following_username = $2"
    )
    .bind(follower)
    .bind(following)
    .fetch_one(pool)
    .await?;
    
    Ok(row.0 > 0)
}

// ============ NOTIFICATIONS ============

/// Create notifications table
pub async fn create_notifications_table(pool: &DbPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_username TEXT NOT NULL,
            type TEXT NOT NULL,
            from_username TEXT,
            conch_id UUID,
            message TEXT NOT NULL,
            read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )"
    )
    .execute(pool)
    .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_username)")
        .execute(pool)
    .await?;
    
    Ok(())
}

/// Create notification
pub async fn create_notification(
    pool: &DbPool,
    user_username: &str,
    notif_type: &str,
    from_username: Option<&str>,
    conch_id: Option<uuid::Uuid>,
    message: &str,
) -> Result<serde_json::Value, sqlx::Error> {
    let id = uuid::Uuid::new_v4();
    
    let row: PgRow = sqlx::query(
        "INSERT INTO notifications (id, user_username, type, from_username, conch_id, message) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, user_username, type, from_username, conch_id, message, read, created_at"
    )
    .bind(id)
    .bind(user_username)
    .bind(notif_type)
    .bind(from_username)
    .bind(conch_id)
    .bind(message)
    .fetch_one(pool)
    .await?;
    
    Ok(serde_json::json!({
        "id": row.get::<uuid::Uuid, _>("id"),
        "user_username": row.get::<String, _>("user_username"),
        "type": row.get::<String, _>("type"),
        "from_username": row.get::<Option<String>, _>("from_username"),
        "conch_id": row.get::<Option<uuid::Uuid>, _>("conch_id"),
        "message": row.get::<String, _>("message"),
        "read": row.get::<bool, _>("read"),
        "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
    }))
}

/// Get notifications for user
pub async fn get_notifications(pool: &DbPool, username: &str, limit: i32) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, user_username, type, from_username, conch_id, message, read, created_at 
         FROM notifications WHERE user_username = $1 ORDER BY created_at DESC LIMIT $2"
    )
    .bind(username)
    .bind(limit)
    .fetch_all(pool)
    .await?;
    
    let notifications: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "user_username": row.get::<String, _>("user_username"),
            "type": row.get::<String, _>("type"),
            "from_username": row.get::<Option<String>, _>("from_username"),
            "conch_id": row.get::<Option<uuid::Uuid>, _>("conch_id"),
            "message": row.get::<String, _>("message"),
            "read": row.get::<bool, _>("read"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
        })
    }).collect();
    
    Ok(notifications)
}

/// Mark notification as read
pub async fn mark_notification_read(pool: &DbPool, notification_id: uuid::Uuid) -> Result<bool, sqlx::Error> {
    sqlx::query("UPDATE notifications SET read = TRUE WHERE id = $1")
        .bind(notification_id)
        .execute(pool)
        .await?;
    
    Ok(true)
}

/// Update notification preferences for a user
pub async fn update_notification_preferences(pool: &DbPool, username: &str, prefs: serde_json::Value) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE users SET notification_preferences = $1 WHERE username = $2"
    )
    .bind(prefs)
    .bind(username)
    .execute(pool)
    .await?;
    
    Ok(())
}

// ============ VERSION HISTORY ============

/// Create conch_versions table
pub async fn create_conch_versions_table(pool: &DbPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS conch_versions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conch_id UUID NOT NULL REFERENCES conches(id) ON DELETE CASCADE,
            version_number INTEGER NOT NULL,
            state JSONB NOT NULL,
            story TEXT NOT NULL,
            intent TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )"
    )
    .execute(pool)
    .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_conch_versions_conch ON conch_versions(conch_id)")
        .execute(pool)
    .await?;
    
    Ok(())
}

/// Save conch version
pub async fn save_conch_version(
    pool: &DbPool,
    conch_id: uuid::Uuid,
    state: serde_json::Value,
    story: String,
    intent: String,
) -> Result<serde_json::Value, sqlx::Error> {
    let id = uuid::Uuid::new_v4();
    
    // Get next version number
    let row: (i32,) = sqlx::query_as(
        "SELECT COALESCE(MAX(version_number), 0) + 1 FROM conch_versions WHERE conch_id = $1"
    )
    .bind(conch_id)
    .fetch_one(pool)
    .await?;
    
    let version_number = row.0;
    let state_json = serde_json::to_string(&state).unwrap_or_else(|_| "{}".to_string());
    
    let row: PgRow = sqlx::query(
        "INSERT INTO conch_versions (id, conch_id, version_number, state, story, intent) 
         VALUES ($1, $2, $3, $4::jsonb, $5, $6) RETURNING id, conch_id, version_number, state, story, intent, created_at"
    )
    .bind(id)
    .bind(conch_id)
    .bind(version_number)
    .bind(&state_json)
    .bind(&story)
    .bind(&intent)
    .fetch_one(pool)
    .await?;
    
    Ok(serde_json::json!({
        "id": row.get::<uuid::Uuid, _>("id"),
        "conch_id": row.get::<uuid::Uuid, _>("conch_id"),
        "version_number": row.get::<i32, _>("version_number"),
        "state": row.get::<serde_json::Value, _>("state"),
        "story": row.get::<String, _>("story"),
        "intent": row.get::<String, _>("intent"),
        "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
    }))
}

/// Get conch versions
pub async fn get_conch_versions(pool: &DbPool, conch_id: uuid::Uuid) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, conch_id, version_number, state, story, intent, created_at 
         FROM conch_versions WHERE conch_id = $1 ORDER BY version_number DESC"
    )
    .bind(conch_id)
    .fetch_all(pool)
    .await?;
    
    let versions: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "conch_id": row.get::<uuid::Uuid, _>("conch_id"),
            "version_number": row.get::<i32, _>("version_number"),
            "state": row.get::<serde_json::Value, _>("state"),
            "story": row.get::<String, _>("story"),
            "intent": row.get::<String, _>("intent"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
        })
    }).collect();
    
    Ok(versions)
}

// ============ LIKES ============

/// Create likes table
pub async fn create_likes_table(pool: &DbPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS likes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conch_id UUID NOT NULL REFERENCES conches(id) ON DELETE CASCADE,
            username TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE(conch_id, username)
        )"
    )
    .execute(pool)
    .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_likes_conch ON likes(conch_id)")
        .execute(pool)
        .await?;
    
    Ok(())
}

/// Like a conch
pub async fn like_conch(pool: &DbPool, conch_id: uuid::Uuid, username: &str) -> Result<bool, sqlx::Error> {
    sqlx::query(
        "INSERT INTO likes (conch_id, username) VALUES ($1, $2) 
         ON CONFLICT (conch_id, username) DO NOTHING"
    )
    .bind(conch_id)
    .bind(username)
    .execute(pool)
    .await?;
    
    Ok(true)
}

/// Unlike a conch
pub async fn unlike_conch(pool: &DbPool, conch_id: uuid::Uuid, username: &str) -> Result<bool, sqlx::Error> {
    sqlx::query("DELETE FROM likes WHERE conch_id = $1 AND username = $2")
        .bind(conch_id)
        .bind(username)
        .execute(pool)
        .await?;
    
    Ok(true)
}

/// Get likes count for a conch
pub async fn get_likes_count(pool: &DbPool, conch_id: uuid::Uuid) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM likes WHERE conch_id = $1"
    )
    .bind(conch_id)
    .fetch_one(pool)
    .await?;
    
    Ok(row.0)
}

/// Check if user liked a conch
pub async fn has_liked(pool: &DbPool, conch_id: uuid::Uuid, username: &str) -> Result<bool, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM likes WHERE conch_id = $1 AND username = $2"
    )
    .bind(conch_id)
    .bind(username)
    .fetch_one(pool)
    .await?;
    
    Ok(row.0 > 0)
}

// ============ COMMENTS ============

/// Create comments table
pub async fn create_comments_table(pool: &DbPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS comments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conch_id UUID NOT NULL REFERENCES conches(id) ON DELETE CASCADE,
            parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
            username TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )"
    )
    .execute(pool)
    .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_comments_conch ON comments(conch_id)")
        .execute(pool)
        .await?;
    
    Ok(())
}

/// Add comment to conch
pub async fn add_comment(
    pool: &DbPool,
    conch_id: uuid::Uuid,
    parent_id: Option<uuid::Uuid>,
    username: &str,
    content: &str,
) -> Result<serde_json::Value, sqlx::Error> {
    let id = uuid::Uuid::new_v4();
    
    let row: PgRow = sqlx::query(
        "INSERT INTO comments (id, conch_id, parent_id, username, content) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id, conch_id, parent_id, username, content, created_at"
    )
    .bind(id)
    .bind(conch_id)
    .bind(parent_id)
    .bind(username)
    .bind(content)
    .fetch_one(pool)
    .await?;
    
    Ok(serde_json::json!({
        "id": row.get::<uuid::Uuid, _>("id"),
        "conch_id": row.get::<uuid::Uuid, _>("conch_id"),
        "parent_id": row.get::<Option<uuid::Uuid>, _>("parent_id"),
        "username": row.get::<String, _>("username"),
        "content": row.get::<String, _>("content"),
        "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
    }))
}

/// Get comments for a conch
pub async fn get_comments(pool: &DbPool, conch_id: uuid::Uuid) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, conch_id, parent_id, username, content, created_at 
         FROM comments WHERE conch_id = $1 ORDER BY created_at ASC"
    )
    .bind(conch_id)
    .fetch_all(pool)
    .await?;
    
    let comments: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "conch_id": row.get::<uuid::Uuid, _>("conch_id"),
            "parent_id": row.get::<Option<uuid::Uuid>, _>("parent_id"),
            "username": row.get::<String, _>("username"),
            "content": row.get::<String, _>("content"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
        })
    }).collect();
    
    Ok(comments)
}

// ============ TAGS ============

/// Create tags table
pub async fn create_tags_table(pool: &DbPool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tags (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL UNIQUE,
            usage_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )"
    )
    .execute(pool)
    .await?;
    
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)")
        .execute(pool)
        .await?;
    
    // Create conch_tags junction table
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS conch_tags (
            conch_id UUID NOT NULL REFERENCES conches(id) ON DELETE CASCADE,
            tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            UNIQUE(conch_id, tag_id)
        )"
    )
    .execute(pool)
    .await?;
    
    Ok(())
}

/// Add tags to conch
pub async fn add_tags_to_conch(pool: &DbPool, conch_id: uuid::Uuid, tag_names: Vec<String>) -> Result<bool, sqlx::Error> {
    for tag_name in tag_names {
        // Insert tag if not exists
        sqlx::query(
            "INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET usage_count = tags.usage_count + 1"
        )
        .bind(&tag_name)
        .execute(pool)
        .await?;
        
        // Get tag id
        let row: (uuid::Uuid,) = sqlx::query_as(
            "SELECT id FROM tags WHERE name = $1"
        )
        .bind(&tag_name)
        .fetch_one(pool)
        .await?;
        
        // Link tag to conch
        sqlx::query(
            "INSERT INTO conch_tags (conch_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
        )
        .bind(conch_id)
        .bind(row.0)
        .execute(pool)
        .await?;
    }
    
    Ok(true)
}

/// Get tags for a conch
pub async fn get_conch_tags(pool: &DbPool, conch_id: uuid::Uuid) -> Result<Vec<String>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT t.name FROM tags t 
         JOIN conch_tags ct ON t.id = ct.tag_id 
         WHERE ct.conch_id = $1"
    )
    .bind(conch_id)
    .fetch_all(pool)
    .await?;
    
    let tags: Vec<String> = rows.into_iter().map(|row| row.get::<String, _>("name")).collect();
    
    Ok(tags)
}

/// Search tags (auto-suggest)
pub async fn search_tags(pool: &DbPool, query: &str, limit: i32) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, name, usage_count FROM tags WHERE name ILIKE $1 ORDER BY usage_count DESC LIMIT $2"
    )
    .bind(format!("%{}%", query))
    .bind(limit)
    .fetch_all(pool)
    .await?;
    
    let tags: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "name": row.get::<String, _>("name"),
            "usage_count": row.get::<i32, _>("usage_count"),
        })
    }).collect();
    
    Ok(tags)
}

// ============ SEARCH & FILTERING ============

/// Search conches with filters
pub async fn search_conches(
    pool: &DbPool,
    query: Option<String>,
    tags: Option<Vec<String>>,
    author: Option<String>,
    state_filter: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    sort_by: &str,
    page: i32,
    page_size: i32,
) -> Result<Vec<serde_json::Value>, sqlx::Error> {
    let offset = (page - 1) * page_size;
    
    let mut sql = String::from("SELECT DISTINCT c.id, c.state, c.story, c.lineage, c.intent, c.era, c.owner, c.permissions, c.signature, c.created_at, c.updated_at FROM conches c ");
    
    // Join with conch_tags if tags are provided
    if tags.is_some() {
        sql.push_str("LEFT JOIN conch_tags ct ON c.id = ct.conch_id ");
        sql.push_str("LEFT JOIN tags t ON ct.tag_id = t.id ");
    }
    
    let mut conditions: Vec<String> = vec![];
    
    if let Some(ref q) = query {
        if !q.is_empty() {
            conditions.push(format!("(c.story ILIKE '%{}%' OR c.intent ILIKE '%{}%' OR c.owner ILIKE '%{}%')", q, q, q));
        }
    }
    
    if let Some(ref a) = author {
        if !a.is_empty() {
            conditions.push(format!("c.owner = '{}'", a));
        }
    }
    
    if let Some(ref t) = tags {
        if !t.is_empty() {
            let tag_list = t.iter().map(|s| format!("'{}'", s)).collect::<Vec<_>>().join(", ");
            conditions.push(format!("t.name IN ({})", tag_list));
        }
    }
    
    if !conditions.is_empty() {
        sql.push_str("WHERE ");
        sql.push_str(&conditions.join(" AND "));
    }
    
    // Sort
    match sort_by {
        "date_asc" => sql.push_str(" ORDER BY c.created_at ASC"),
        "date_desc" => sql.push_str(" ORDER BY c.created_at DESC"),
        "popularity" => sql.push_str(" ORDER BY c.era DESC"), // Using era as proxy for popularity
        _ => sql.push_str(" ORDER BY c.created_at DESC"),
    }
    
    sql.push_str(&format!(" LIMIT {} OFFSET {}", page_size, offset));

    let rows = sqlx::query(&sql).fetch_all(pool).await?;

    let conches: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        serde_json::json!({
            "id": row.get::<uuid::Uuid, _>("id"),
            "state": row.get::<serde_json::Value, _>("state"),
            "story": row.get::<String, _>("story"),
            "lineage": row.get::<Vec<uuid::Uuid>, _>("lineage"),
            "intent": row.get::<String, _>("intent"),
            "era": row.get::<i32, _>("era"),
            "owner": row.get::<String, _>("owner"),
            "permissions": row.get::<serde_json::Value, _>("permissions"),
            "signature": row.get::<String, _>("signature"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").to_rfc3339(),
            "updated_at": row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at").to_rfc3339(),
        })
    }).collect();

    Ok(conches)
}

/// Get a user by email
pub async fn get_user_by_email(pool: &DbPool, email: &str) -> Result<Option<serde_json::Value>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT id::text as id, username, email, password_hash, public_key FROM users WHERE email = $1"
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| serde_json::json!({
        "id": r.get::<String, _>("id"),
        "username": r.get::<String, _>("username"),
        "email": r.get::<String, _>("email"),
        "password_hash": r.get::<String, _>("password_hash"),
        "public_key": r.try_get::<Option<String>, _>("public_key").ok().flatten(),
    })))
}

/// Get a user by username
pub async fn get_user_by_username(pool: &DbPool, username: &str) -> Result<Option<serde_json::Value>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT id::text as id, username, email, password_hash, public_key FROM users WHERE username = $1"
    )
    .bind(username)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| serde_json::json!({
        "id": r.get::<String, _>("id"),
        "username": r.get::<String, _>("username"),
        "email": r.get::<String, _>("email"),
        "public_key": r.try_get::<Option<String>, _>("public_key").ok().flatten(),
    })))
}

/// Create a new user, returns the new user's UUID as a string
pub async fn create_user(pool: &DbPool, username: &str, email: &str, password_hash: &str) -> Result<String, sqlx::Error> {
    let row = sqlx::query(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id::text as id"
    )
    .bind(username)
    .bind(email)
    .bind(password_hash)
    .fetch_one(pool)
    .await?;

    Ok(row.get::<String, _>("id"))
}
