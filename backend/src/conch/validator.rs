use super::error::ConchError;
use super::types::ConchObject;

/// Validate a parsed ConchObject against its own schema.
/// Returns all errors found (not just the first), so callers get the full picture.
pub fn validate_conch(conch: &ConchObject) -> Result<(), Vec<ConchError>> {
    let mut errors = Vec::new();

    // 1. Schema → data: every required field must be present with the right type
    for (field_name, field_def) in &conch.schema.fields {
        match conch.data.get(field_name) {
            None => {
                if field_def.required {
                    errors.push(ConchError::MissingRequiredField(field_name.clone()));
                }
            }
            Some(value) => {
                if !field_def.field_type.matches(value) {
                    errors.push(ConchError::TypeMismatch {
                        field: field_name.clone(),
                        expected: field_def.field_type.as_str().to_string(),
                        found: json_type_name(value),
                    });
                }
            }
        }
    }

    // 2. Data → schema: no undeclared fields allowed
    for field_name in conch.data.keys() {
        if !conch.schema.fields.contains_key(field_name) {
            errors.push(ConchError::UndeclaredField(field_name.clone()));
        }
    }

    // 3. Permissions: each list must be non-empty
    if conch.permissions.read.is_empty() {
        errors.push(ConchError::InvalidPermissions("'read' list cannot be empty".into()));
    }
    if conch.permissions.write.is_empty() {
        errors.push(ConchError::InvalidPermissions("'write' list cannot be empty".into()));
    }
    if conch.permissions.admin.is_empty() {
        errors.push(ConchError::InvalidPermissions("'admin' list cannot be empty".into()));
    }

    // 4. History ordering (should already be sorted by parser, double-check)
    for window in conch.history.windows(2) {
        if window[0].timestamp > window[1].timestamp {
            errors.push(ConchError::HistoryNotOrdered);
            break;
        }
    }

    // 5. At least one history entry (must have a 'created' event)
    if conch.history.is_empty() {
        errors.push(ConchError::InvalidHistoryEntry("history must have at least one entry".into()));
    }

    if errors.is_empty() { Ok(()) } else { Err(errors) }
}

fn json_type_name(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::Null => "null",
        serde_json::Value::Bool(_) => "boolean",
        serde_json::Value::Number(_) => "number",
        serde_json::Value::String(_) => "string",
        serde_json::Value::Array(_) => "array",
        serde_json::Value::Object(_) => "object",
    }
    .to_string()
}
