use editoast_common::rangemap_utils::TravelDir;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    Direction,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash, ToSchema)]
#[serde(deny_unknown_fields, rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Direction {
    StartToStop,
    StopToStart,
}

impl From<Direction> for TravelDir {
    fn from(val: Direction) -> TravelDir {
        match val {
            Direction::StartToStop => TravelDir::StartToStop,
            Direction::StopToStart => TravelDir::StopToStart,
        }
    }
}
