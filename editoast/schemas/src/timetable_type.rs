use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use strum::EnumString;
use strum::IntoStaticStr;
use utoipa::ToSchema;

// This enum maps to a Postgres enum type, specifically `timetable_type`.
// Any changes made to this enum must be reflected in the corresponding Postgres enum,
// and vice versa, to ensure consistency between the application and the database.
#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Serialize,
    Deserialize,
    ToSchema,
    EnumString,
    IntoStaticStr,
    Display,
    Default,
)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TimetableType {
    #[default]
    Calendar,
    Hourly,
}
