use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

/// A range along the train path where a power restriction is applied.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq)]
#[schema(example = json!({
    "begin_position": 0.0,
    "end_position": 1000.0,
    "power_restriction_code": "C1US"
}))]
pub struct RjsPowerRestrictionRange {
    /// Offset from the start of the path, in meters.
    begin_position: f32,
    /// Offset from the start of the path, in meters.
    end_position: f32,
    /// The power restriction code to apply.
    power_restriction_code: String,
}
