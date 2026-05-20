use std::collections::BTreeMap;
use uuid::Uuid;

use super::types::{
    ConchHistoryEntry, ConchMeta, ConchObject, ConchPermissions, ConchSchema, FieldType,
    SchemaField, SUPPORTED_VERSION,
};

/// Fluent builder for new ConchObjects.
pub struct ConchBuilder {
    creator: String,
    display_name: Option<String>,
    schema_fields: BTreeMap<String, SchemaField>,
    data: BTreeMap<String, serde_json::Value>,
    read: Vec<String>,
    write: Vec<String>,
    admin: Vec<String>,
}

impl ConchBuilder {
    pub fn new(creator: impl Into<String>) -> Self {
        let creator = creator.into();
        Self {
            write: vec![creator.clone()],
            admin: vec![creator.clone()],
            creator,
            display_name: None,
            schema_fields: BTreeMap::new(),
            data: BTreeMap::new(),
            read: vec!["*".to_string()],
        }
    }

    pub fn field(
        mut self,
        name: impl Into<String>,
        field_type: FieldType,
        required: bool,
        description: impl Into<String>,
    ) -> Self {
        self.schema_fields.insert(name.into(), SchemaField {
            field_type,
            required,
            description: description.into(),
        });
        self
    }

    pub fn data(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.data.insert(key.into(), value);
        self
    }

    pub fn read_public(mut self) -> Self {
        self.read = vec!["*".to_string()];
        self
    }

    pub fn read_restricted(mut self, keys: Vec<String>) -> Self {
        self.read = keys;
        self
    }

    pub fn build(self) -> ConchObject {
        let now = chrono::Utc::now().to_rfc3339();
        let id = Uuid::new_v4().to_string();

        ConchObject {
            meta: ConchMeta {
                id: id.clone(),
                version: 1,
                created_at: now.clone(),
                creator: self.creator.clone(),
                conch_version: SUPPORTED_VERSION.to_string(),
            },
            schema: ConchSchema {
                version: 1,
                fields: self.schema_fields,
            },
            data: self.data,
            permissions: ConchPermissions {
                read: self.read,
                write: self.write,
                admin: self.admin,
            },
            history: vec![ConchHistoryEntry {
                timestamp: now,
                action: "created".to_string(),
                actor: self.creator,
                diff: serde_json::Value::Object(Default::default()),
            }],
        }
    }
}
