use ordered_float::OrderedFloat;
use schemas::infra::Direction;
use schemas::infra::TrackOffset;
use schemas::primitives::Identifier;
use schemas::rolling_stock::LoadingGaugeType;
use schemas::train_schedule::PathItemLocation;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::AsCoreRequest;
use crate::Json;
use crate::RawError;

#[derive(Debug, Hash, Serialize)]
pub struct PathfindingRequest {
    /// Infrastructure id
    pub infra: i64,
    /// Infrastructure expected version
    pub expected_version: i64,
    /// List of waypoints. Each waypoint is a list of track offset.
    pub path_items: Vec<Vec<TrackOffset>>,
    /// The loading gauge of the rolling stock
    pub rolling_stock_loading_gauge: LoadingGaugeType,
    /// Can the rolling stock run on non-electrified tracks
    pub rolling_stock_is_thermal: bool,
    /// List of supported electrification modes.
    /// Empty if does not support any electrification
    pub rolling_stock_supported_electrifications: Vec<String>,
    /// List of supported signaling systems
    pub rolling_stock_supported_signaling_systems: Vec<String>,
    /// Maximum speed of the rolling stock
    pub rolling_stock_maximum_speed: OrderedFloat<f64>,
    /// Rolling stock length in meters:
    pub rolling_stock_length: OrderedFloat<f64>,
    /// Speed limit tag, used to estimate the max speed and travel time
    pub speed_limit_tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct OffsetRange {
    start: u64,
    end: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct IncompatibleOffsetRangeWithValue {
    range: OffsetRange,
    value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct IncompatibleOffsetRange {
    range: OffsetRange,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct IncompatibleConstraints {
    incompatible_electrification_ranges: Vec<IncompatibleOffsetRangeWithValue>,
    incompatible_gauge_ranges: Vec<IncompatibleOffsetRange>,
    incompatible_signaling_system_ranges: Vec<IncompatibleOffsetRangeWithValue>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
pub struct InvalidPathItem {
    pub index: usize,
    pub path_item: PathItemLocation,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum PathfindingCoreResult {
    Success(PathfindingResultSuccess),
    NotFoundInBlocks {
        track_section_ranges: Vec<TrackRange>,
        length: u64,
    },
    NotFoundInRoutes {
        track_section_ranges: Vec<TrackRange>,
        length: u64,
    },
    NotFoundInTracks,
    IncompatibleConstraints {
        relaxed_constraints_path: Box<PathfindingResultSuccess>,
        incompatible_constraints: Box<IncompatibleConstraints>,
    },
    InvalidPathItems {
        items: Vec<InvalidPathItem>,
    },
    NotEnoughPathItems,
    RollingStockNotFound {
        rolling_stock_name: String,
    },
    InternalError {
        core_error: RawError,
    },
}

/// A successful pathfinding result. This is also used for STDCM response.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
#[cfg_attr(feature = "mocking_client", derive(Default))]
pub struct PathfindingResultSuccess {
    /// Full description of the path data
    pub path: TrainPath,
    /// Length of the path in mm
    pub length: u64,
    /// The path offset in mm of each path item given as input of the pathfinding
    /// The first value is always `0` (beginning of the path) and the last one is always equal to the `length` of the path in mm
    pub path_item_positions: Vec<u64>,
}

// Enum for input-related errors
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
#[serde(tag = "error_type", rename_all = "snake_case")]
pub enum PathfindingInputError {
    InvalidPathItems {
        #[schema(inline)]
        items: Vec<InvalidPathItem>,
    },
    NotEnoughPathItems,
    RollingStockNotFound {
        rolling_stock_name: String,
    },
    ZeroLengthPath,
}

// Enum for not-found results and incompatible constraints
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema, Default)]
#[serde(tag = "error_type", rename_all = "snake_case")]
pub enum PathfindingNotFound {
    NotFoundInBlocks {
        track_section_ranges: Vec<TrackRange>,
        length: u64,
    },
    NotFoundInRoutes {
        track_section_ranges: Vec<TrackRange>,
        length: u64,
    },
    #[default]
    NotFoundInTracks,
    IncompatibleConstraints {
        relaxed_constraints_path: Box<PathfindingResultSuccess>,
        incompatible_constraints: Box<IncompatibleConstraints>,
    },
}

/// An oriented range on a track section.
/// `begin` is always less than `end`.
#[derive(Serialize, Deserialize, Clone, Debug, ToSchema, Hash, PartialEq, Eq)]
#[schema(as = CoreTrackRange)]
pub struct TrackRange {
    /// The track section identifier.
    #[schema(inline)]
    pub track_section: Identifier,
    /// The beginning of the range in mm.
    pub begin: u64,
    /// The end of the range in mm.
    pub end: u64,
    /// The direction of the range.
    pub direction: Direction,
}

#[cfg(feature = "mocking_client")]
impl TrackRange {
    pub fn new(track_section: &str, begin: u64, end: u64, direction: Direction) -> Self {
        Self {
            track_section: track_section.into(),
            begin,
            end,
            direction,
        }
    }
}

/// A range on a linear object (usually block or route)
#[derive(Serialize, Deserialize, Clone, Debug, ToSchema, Hash, PartialEq, Eq)]
pub struct ObjectRange {
    /// The object identifier.
    #[schema(inline)]
    pub id: Identifier,
    /// The beginning of the range in mm.
    pub begin: u64,
    /// The end of the range in mm.
    pub end: u64,
}

/// A valid train path, as returned from the pathfinding.
/// Can be used as-is as input for other endpoints.
#[derive(Serialize, Deserialize, Clone, Debug, ToSchema, Hash, PartialEq, Eq, Default)]
pub struct TrainPath {
    /// Block ranges, in order.
    pub blocks: Vec<ObjectRange>,
    /// Route ranges, in order.
    pub routes: Vec<ObjectRange>,
    /// Track section ranges, in order.
    pub track_section_ranges: Vec<TrackRange>,
}

impl From<schemas::infra::DirectionalTrackRange> for TrackRange {
    fn from(value: schemas::infra::DirectionalTrackRange) -> Self {
        TrackRange {
            track_section: value.track,
            begin: (value.begin * 1000.).round() as u64,
            end: (value.end * 1000.).round() as u64,
            direction: value.direction,
        }
    }
}

impl TrackRange {
    /// Returns the starting offset of the range (depending on the direction).
    pub fn start(&self) -> u64 {
        if self.direction == Direction::StartToStop {
            self.begin
        } else {
            self.end
        }
    }

    /// Returns the ending offset of the range (depending on the direction).
    pub fn stop(&self) -> u64 {
        if self.direction == Direction::StartToStop {
            self.end
        } else {
            self.begin
        }
    }

    /// Computes a TrackRangeOffset location on this track range following its direction
    pub fn offset(&self, offset: u64) -> TrackRangeOffset<'_> {
        assert!(offset <= self.length(), "offset out of track range bounds");
        TrackRangeOffset {
            track_range: self,
            offset,
        }
    }

    pub fn length(&self) -> u64 {
        self.end - self.begin
    }
}

pub struct TrackRangeOffset<'a> {
    track_range: &'a TrackRange,
    pub offset: u64,
}

impl TrackRangeOffset<'_> {
    pub fn as_track_offset(&self) -> TrackOffset {
        if self.track_range.direction == Direction::StartToStop {
            return TrackOffset::new(
                &self.track_range.track_section,
                self.offset + self.track_range.begin,
            );
        }
        TrackOffset::new(
            &self.track_range.track_section,
            self.track_range.end - self.offset,
        )
    }
}

impl AsCoreRequest<Json<PathfindingCoreResult>> for PathfindingRequest {
    const URL_PATH: &'static str = "/pathfinding/blocks";

    fn worker_id(&self) -> Option<String> {
        Some(self.infra.to_string())
    }
}
