// CONCH Platform - Library Root
// A mythic, modern landing portal and real-time Conch memory system

pub mod api;
pub mod auth;
pub mod db;
pub mod events;
pub mod models;
pub mod state;
pub mod websocket;

pub use models::*;
pub use state::{AppState, WebSocketManager};
