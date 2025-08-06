use enum_map::Enum;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use strum::EnumIter;
use utoipa::ToSchema;

#[editoast_derive::openapi_schema]
#[derive(
    Debug,
    Clone,
    Copy,
    Deserialize,
    Hash,
    Eq,
    PartialEq,
    Serialize,
    Enum,
    EnumIter,
    Display,
    ToSchema,
)]
#[serde(deny_unknown_fields)]
pub enum ObjectType {
    TrackSection,
    Signal,
    SpeedSection,
    Detector,
    NeutralSection,
    Switch,
    SwitchType,
    BufferStop,
    Route,
    OperationalPoint,
    Electrification,
}
