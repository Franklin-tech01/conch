use std::collections::BTreeMap;
use serde::{Deserialize, Serialize};

pub const SUPPORTED_VERSION: &str = "0.1";

/// The complete, parsed .conch object. All five sections are required.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConchObject {
    pub meta: ConchMeta,
    pub schema: ConchSchema,
    /// Ordered map of field_name → value (BTreeMap preserves insertion key order)
    pub data: BTreeMap<String, serde_json::Value>,
    pub permissions: ConchPermissions,
    /// History sorted ascending by timestamp
    pub history: Vec<ConchHistoryEntry>,
}

/// Provenance and identity metadata
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConchMeta {
    pub id: String,
    pub version: u32,
    pub created_at: String,
    pub creator: String,
    pub conch_version: String,
}

/// Schema definition — what fields the data section may/must contain
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConchSchema {
    pub version: u32,
    pub fields: BTreeMap<String, SchemaField>,
}

/// Declaration for a single schema field
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SchemaField {
    #[serde(rename = "type")]
    pub field_type: FieldType,
    pub required: bool,
    #[serde(default)]
    pub description: String,
}

/// Supported primitive types for schema field validation
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldType {
    String,
    Number,
    Boolean,
    Array,
    Object,
}

impl FieldType {
    pub fn as_str(&self) -> &'static str {
        match self {
            FieldType::String => "string",
            FieldType::Number => "number",
            FieldType::Boolean => "boolean",
            FieldType::Array => "array",
            FieldType::Object => "object",
        }
    }

    pub fn matches(&self, value: &serde_json::Value) -> bool {
        match self {
            FieldType::String => value.is_string(),
            FieldType::Number => value.is_number(),
            FieldType::Boolean => value.is_boolean(),
            FieldType::Array => value.is_array(),
            FieldType::Object => value.is_object(),
        }
    }
}

/// Who can read, write, or administer a Conch.
/// "*" means unrestricted; otherwise entries are hex public keys.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConchPermissions {
    pub read: Vec<String>,
    pub write: Vec<String>,
    pub admin: Vec<String>,
}

/// One entry in the immutable audit trail
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ConchHistoryEntry {
    pub timestamp: String,
    pub action: String,
    pub actor: String,
    #[serde(default)]
    pub diff: serde_json::Value,
}
