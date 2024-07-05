use editoast_schemas::infra::Direction;
use editoast_schemas::infra::TrackOffset;
use editoast_schemas::primitives::Identifier;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::train_schedule::PathItemLocation;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::core::{AsCoreRequest, Json};
use crate::error::InternalError;

editoast_common::schemas! {
    IncompatibleConstraints,
    IncompatibleElectrification,
    IncompatibleLoadingGauge,
    IncompatibleSignalingSystem,
    PathfindingResult,
    PathfindingResultSuccess,
    RangeOffet,
    TrackRange,
}

#[derive(Debug, Serialize)]
pub struct PathfindingRequest {
    /// Infrastructure id
    pub infra: i64,
    /// Infrastructure expected version
    pub expected_version: String,
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
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RangeOffet {
    start: u64,
    end: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct IncompatibleElectrification {
    range: RangeOffet,
    value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct IncompatibleLoadingGauge {
    range: RangeOffet,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct IncompatibleSignalingSystem {
    range: RangeOffet,
    value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct IncompatibleConstraints {
    incompatible_electrification_ranges: Option<Vec<IncompatibleElectrification>>,
    incompatible_gauge_ranges: Option<Vec<IncompatibleLoadingGauge>>,
    incompatible_signalisation_system_ranges: Option<Vec<IncompatibleSignalingSystem>>,
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum PathfindingResult {
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
        relaxed_constraints_path: PathfindingResultSuccess,
        incompatible_constraints: IncompatibleConstraints,
    },
    InvalidPathItem {
        index: usize,
        #[schema(inline)]
        path_item: PathItemLocation,
    },
    NotEnoughPathItems,
    RollingStockNotFound {
        rolling_stock_name: String,
    },
    PathfindingFailed {
        core_error: InternalError,
    },
}

/// A successful pathfinding result. This is also used for STDCM response.
#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
pub struct PathfindingResultSuccess {
    #[schema(inline)]
    /// Path description as block ids
    pub blocks: Vec<Identifier>,
    #[schema(inline)]
    /// Path description as route ids
    pub routes: Vec<Identifier>,
    /// Path description as track ranges
    pub track_section_ranges: Vec<TrackRange>,
    /// Length of the path in mm
    pub length: u64,
    /// The path offset in mm of each path item given as input of the pathfinding
    /// The first value is always `0` (beginning of the path) and the last one is always equal to the `length` of the path in mm
    pub path_items_positions: Vec<u64>,
}

/// An oriented range on a track section.
/// `begin` is always less than `end`.
#[derive(Serialize, Deserialize, Clone, Debug, ToSchema, Hash, PartialEq, Eq)]
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

impl TrackRange {
    #[cfg(test)]
    /// Creates a new `TrackRange`.
    pub fn new<T: AsRef<str>>(
        track_section: T,
        begin: u64,
        end: u64,
        direction: Direction,
    ) -> Self {
        Self {
            track_section: track_section.as_ref().into(),
            begin,
            end,
            direction,
        }
    }

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

impl AsCoreRequest<Json<PathfindingResult>> for PathfindingRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/v2/pathfinding/blocks";
}
