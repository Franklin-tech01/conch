use super::error::ConchError;
use super::types::ConchObject;
use super::validator::validate_conch;

/// Serialize a ConchObject to canonical pretty-printed JSON.
///
/// Validates the object first — returns SerializationError wrapping all
/// validation failures if the object is not valid.
///
/// Determinism is guaranteed by:
///   - BTreeMap in `data` and `schema.fields` → keys sorted alphabetically
///   - Struct fields declared in canonical section order (meta, schema, data,
///     permissions, history) → serde preserves declaration order
///   - history already sorted ascending by the parser / validator
pub fn write_conch(conch: &ConchObject) -> Result<String, ConchError> {
    validate_conch(conch).map_err(|errors| {
        let msgs: Vec<String> = errors.iter().map(|e| e.to_string()).collect();
        ConchError::SerializationError(format!(
            "validation failed before write: {}",
            msgs.join("; ")
        ))
    })?;

    serde_json::to_string_pretty(conch)
        .map_err(|e| ConchError::SerializationError(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::conch::parser::parse_conch;

    // Minimal valid .conch — used for all round-trip / determinism checks.
    const SAMPLE: &str = r#"{
        "meta": {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "version": 1,
            "created_at": "2026-01-01T00:00:00Z",
            "creator": "abc123",
            "conch_version": "0.1"
        },
        "schema": {
            "version": 1,
            "fields": {
                "name": {"type": "string", "required": true, "description": "display name"},
                "count": {"type": "number", "required": false, "description": ""}
            }
        },
        "data": {"count": 7, "name": "hello"},
        "permissions": {
            "read": ["*"],
            "write": ["abc123"],
            "admin": ["abc123"]
        },
        "history": [
            {"timestamp": "2026-01-01T00:00:00Z", "action": "created", "actor": "abc123", "diff": {}}
        ]
    }"#;

    #[test]
    fn round_trip() {
        let obj1 = parse_conch(SAMPLE).expect("first parse failed");
        let written = write_conch(&obj1).expect("write failed");
        let obj2 = parse_conch(&written).expect("second parse failed");
        assert_eq!(obj1, obj2, "round-trip produced a different structure");
    }

    #[test]
    fn deterministic() {
        let obj = parse_conch(SAMPLE).expect("parse failed");
        let w1 = write_conch(&obj).expect("first write failed");
        let w2 = write_conch(&obj).expect("second write failed");
        assert_eq!(w1, w2, "write is not deterministic");
    }

    #[test]
    fn data_keys_sorted() {
        // data has keys "count" and "name"; BTreeMap must emit them alphabetically
        let obj = parse_conch(SAMPLE).expect("parse failed");
        let written = write_conch(&obj).expect("write failed");
        let count_pos = written.find("\"count\"").expect("count key missing");
        let name_pos = written.find("\"name\"").expect("name key missing");
        assert!(
            count_pos < name_pos,
            "data keys not in alphabetical order in output"
        );
    }

    #[test]
    fn sections_in_canonical_order() {
        let obj = parse_conch(SAMPLE).expect("parse failed");
        let written = write_conch(&obj).expect("write failed");
        let positions = ["meta", "schema", "data", "permissions", "history"]
            .map(|s| written.find(&format!("\"{s}\"")).expect("section missing"));
        for window in positions.windows(2) {
            assert!(window[0] < window[1], "sections out of canonical order");
        }
    }

    #[test]
    fn rejects_invalid_object() {
        let mut obj = parse_conch(SAMPLE).expect("parse failed");
        obj.permissions.read.clear(); // violates validator rule
        let result = write_conch(&obj);
        assert!(result.is_err(), "write should reject an invalid object");
    }
}
