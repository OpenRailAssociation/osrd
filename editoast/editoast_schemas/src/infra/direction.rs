use editoast_common::rangemap_utils::Direction as RangeMapDirection;
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

impl From<Direction> for RangeMapDirection {
    fn from(val: Direction) -> RangeMapDirection {
        match val {
            Direction::StartToStop => RangeMapDirection::StartToEnd,
            Direction::StopToStart => RangeMapDirection::EndToStart,
        }
    }
}
