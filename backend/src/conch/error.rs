use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum ConchError {
    /// JSON deserialization failed
    InvalidJson(String),

    /// A required top-level section is missing
    MissingSection(String),

    /// meta.id is not a valid UUID v4
    InvalidId(String),

    /// meta.conch_version is not a supported version string
    UnsupportedVersion(String),

    /// A required meta field is absent or empty
    MissingMetaField(String),

    /// schema.fields references an unknown FieldType
    UnknownFieldType { field: String, type_name: String },

    /// A data field required by the schema is missing from data
    MissingRequiredField(String),

    /// A data field value does not match the schema-declared type
    TypeMismatch { field: String, expected: String, found: String },

    /// A field present in data is not declared in the schema
    UndeclaredField(String),

    /// permissions section has an invalid structure
    InvalidPermissions(String),

    /// history entries are not sorted by ascending timestamp
    HistoryNotOrdered,

    /// A history entry is missing required fields
    InvalidHistoryEntry(String),
}

impl fmt::Display for ConchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConchError::InvalidJson(msg) => write!(f, "Invalid JSON: {msg}"),
            ConchError::MissingSection(s) => write!(f, "Missing required section: '{s}'"),
            ConchError::InvalidId(msg) => write!(f, "Invalid id: {msg}"),
            ConchError::UnsupportedVersion(v) => write!(f, "Unsupported conch_version: '{v}'"),
            ConchError::MissingMetaField(field) => write!(f, "Missing meta field: '{field}'"),
            ConchError::UnknownFieldType { field, type_name } => {
                write!(f, "Unknown type '{type_name}' for field '{field}'")
            }
            ConchError::MissingRequiredField(field) => {
                write!(f, "Required field '{field}' is absent from data")
            }
            ConchError::TypeMismatch { field, expected, found } => {
                write!(f, "Field '{field}': expected {expected}, found {found}")
            }
            ConchError::UndeclaredField(field) => {
                write!(f, "Data field '{field}' is not declared in schema")
            }
            ConchError::InvalidPermissions(msg) => write!(f, "Invalid permissions: {msg}"),
            ConchError::HistoryNotOrdered => {
                write!(f, "History entries must be in ascending timestamp order")
            }
            ConchError::InvalidHistoryEntry(msg) => write!(f, "Invalid history entry: {msg}"),
        }
    }
}

impl std::error::Error for ConchError {}
