use std::collections::BTreeMap;
use serde_json::Value;

use super::error::ConchError;
use super::types::{
    ConchHistoryEntry, ConchMeta, ConchObject, ConchPermissions, ConchSchema, SchemaField,
    FieldType, SUPPORTED_VERSION,
};

/// Parse a JSON string into a ConchObject.
/// Returns the first error encountered; call validate_conch for a full error list.
pub fn parse_conch(json: &str) -> Result<ConchObject, ConchError> {
    let raw: Value = serde_json::from_str(json)
        .map_err(|e| ConchError::InvalidJson(e.to_string()))?;

    let obj = raw.as_object()
        .ok_or_else(|| ConchError::InvalidJson("root must be a JSON object".into()))?;

    for section in ["meta", "schema", "data", "permissions", "history"] {
        if !obj.contains_key(section) {
            return Err(ConchError::MissingSection(section.into()));
        }
    }

    let meta = parse_meta(&raw["meta"])?;
    let schema = parse_schema(&raw["schema"])?;
    let data = parse_data(&raw["data"])?;
    let permissions = parse_permissions(&raw["permissions"])?;
    let history = parse_history(&raw["history"])?;

    Ok(ConchObject { meta, schema, data, permissions, history })
}

fn parse_meta(v: &Value) -> Result<ConchMeta, ConchError> {
    let required = ["id", "version", "created_at", "creator", "conch_version"];
    for field in required {
        if v.get(field).is_none() {
            return Err(ConchError::MissingMetaField(field.into()));
        }
    }

    let id = v["id"].as_str()
        .ok_or_else(|| ConchError::MissingMetaField("id".into()))?
        .to_string();

    // Validate UUID v4 format (8-4-4-4-12 hex groups)
    if !is_uuid_v4(&id) {
        return Err(ConchError::InvalidId(format!("'{id}' is not a valid UUID v4")));
    }

    let version = v["version"].as_u64()
        .ok_or_else(|| ConchError::MissingMetaField("version".into()))? as u32;

    let created_at = v["created_at"].as_str()
        .ok_or_else(|| ConchError::MissingMetaField("created_at".into()))?
        .to_string();

    let creator = v["creator"].as_str()
        .ok_or_else(|| ConchError::MissingMetaField("creator".into()))?
        .to_string();

    let conch_version = v["conch_version"].as_str()
        .ok_or_else(|| ConchError::MissingMetaField("conch_version".into()))?
        .to_string();

    if conch_version != SUPPORTED_VERSION {
        return Err(ConchError::UnsupportedVersion(conch_version));
    }

    Ok(ConchMeta { id, version, created_at, creator, conch_version })
}

fn parse_schema(v: &Value) -> Result<ConchSchema, ConchError> {
    let version = v["version"].as_u64().unwrap_or(1) as u32;

    let fields_raw = v["fields"].as_object()
        .ok_or_else(|| ConchError::MissingSection("schema.fields".into()))?;

    let mut fields = BTreeMap::new();
    for (name, field_val) in fields_raw {
        let type_str = field_val["type"].as_str()
            .ok_or_else(|| ConchError::UnknownFieldType {
                field: name.clone(),
                type_name: "<missing>".into(),
            })?;

        let field_type = parse_field_type(name, type_str)?;
        let required = field_val["required"].as_bool().unwrap_or(false);
        let description = field_val["description"].as_str().unwrap_or("").to_string();

        fields.insert(name.clone(), SchemaField { field_type, required, description });
    }

    Ok(ConchSchema { version, fields })
}

fn parse_field_type(field: &str, type_str: &str) -> Result<FieldType, ConchError> {
    match type_str {
        "string" => Ok(FieldType::String),
        "number" => Ok(FieldType::Number),
        "boolean" => Ok(FieldType::Boolean),
        "array" => Ok(FieldType::Array),
        "object" => Ok(FieldType::Object),
        other => Err(ConchError::UnknownFieldType {
            field: field.to_string(),
            type_name: other.to_string(),
        }),
    }
}

fn parse_data(v: &Value) -> Result<BTreeMap<String, Value>, ConchError> {
    let obj = v.as_object()
        .ok_or_else(|| ConchError::InvalidJson("data must be a JSON object".into()))?;

    // BTreeMap gives us canonical key-sorted ordering automatically
    Ok(obj.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
}

fn parse_permissions(v: &Value) -> Result<ConchPermissions, ConchError> {
    let parse_list = |key: &str| -> Result<Vec<String>, ConchError> {
        let arr = v[key].as_array()
            .ok_or_else(|| ConchError::InvalidPermissions(format!("'{key}' must be an array")))?;
        arr.iter()
            .map(|item| {
                item.as_str()
                    .map(|s| s.to_string())
                    .ok_or_else(|| ConchError::InvalidPermissions(
                        format!("'{key}' entries must be strings"),
                    ))
            })
            .collect()
    };

    Ok(ConchPermissions {
        read: parse_list("read")?,
        write: parse_list("write")?,
        admin: parse_list("admin")?,
    })
}

fn parse_history(v: &Value) -> Result<Vec<ConchHistoryEntry>, ConchError> {
    let arr = v.as_array()
        .ok_or_else(|| ConchError::InvalidJson("history must be a JSON array".into()))?;

    let mut entries = Vec::with_capacity(arr.len());
    for (i, item) in arr.iter().enumerate() {
        let timestamp = item["timestamp"].as_str()
            .ok_or_else(|| ConchError::InvalidHistoryEntry(format!("entry {i} missing timestamp")))?
            .to_string();
        let action = item["action"].as_str()
            .ok_or_else(|| ConchError::InvalidHistoryEntry(format!("entry {i} missing action")))?
            .to_string();
        let actor = item["actor"].as_str()
            .ok_or_else(|| ConchError::InvalidHistoryEntry(format!("entry {i} missing actor")))?
            .to_string();
        let diff = item.get("diff").cloned().unwrap_or(Value::Object(Default::default()));

        entries.push(ConchHistoryEntry { timestamp, action, actor, diff });
    }

    // Sort ascending by timestamp (ISO 8601 strings sort lexicographically)
    entries.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

    Ok(entries)
}

fn is_uuid_v4(s: &str) -> bool {
    let parts: Vec<&str> = s.split('-').collect();
    if parts.len() != 5 { return false; }
    let lengths = [8, 4, 4, 4, 12];
    for (part, &expected_len) in parts.iter().zip(lengths.iter()) {
        if part.len() != expected_len { return false; }
        if !part.chars().all(|c| c.is_ascii_hexdigit()) { return false; }
    }
    // UUID v4: third group must start with '4'
    parts[2].starts_with('4')
}
