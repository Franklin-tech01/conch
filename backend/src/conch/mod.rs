// Conch Core — .conch file format parser, validator, and builder
// Phase 1 of the CONCH 2026 Roadmap: Reference Library

pub mod error;
pub mod types;
pub mod parser;
pub mod validator;
pub mod builder;
pub mod writer;

pub use error::ConchError;
pub use types::{ConchObject, ConchMeta, ConchSchema, SchemaField, ConchPermissions, ConchHistoryEntry, FieldType};
pub use parser::parse_conch;
pub use validator::validate_conch;
pub use builder::ConchBuilder;
pub use writer::write_conch;
