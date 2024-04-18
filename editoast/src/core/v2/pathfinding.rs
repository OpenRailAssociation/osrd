use editoast_schemas::infra::TrackOffset;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::train_schedule::PathItemLocation;
use serde::Deserialize;
use serde::Serialize;

use crate::core::{AsCoreRequest, Json};
use crate::views::v2::path::TrackRange;
use editoast_common::Identifier;
use utoipa::ToSchema;

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

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum PathfindingResult {
    Success {
        #[schema(inline)]
        /// Path description as block ids
        blocks: Vec<Identifier>,
        #[schema(inline)]
        /// Path description as route ids
        routes: Vec<Identifier>,
        /// Path description as track ranges
        track_section_ranges: Vec<TrackRange>,
        /// Length of the path in mm
        length: u64,
        /// The path offset in mm of each path item given as input of the pathfinding
        /// The first value is always `0` (beginning of the path) and the last one is always equal to the `length` of the path in mm
        path_items_positions: Vec<u64>,
    },
    NotFoundInBlocks {
        track_section_ranges: Vec<TrackRange>,
        length: u64,
    },
    NotFoundInRoutes {
        track_section_ranges: Vec<TrackRange>,
        length: u64,
    },
    NotFoundInTracks,
    IncompatibleElectrification {
        #[schema(inline)]
        blocks: Vec<Identifier>,
        #[schema(inline)]
        routes: Vec<Identifier>,
        track_section_ranges: Vec<TrackRange>,
        length: u64,
        incompatible_ranges: Vec<(u64, u64)>,
    },
    IncompatibleLoadingGauge {
        #[schema(inline)]
        blocks: Vec<Identifier>,
        #[schema(inline)]
        routes: Vec<Identifier>,
        track_section_ranges: Vec<TrackRange>,
        length: u64,
        incompatible_ranges: Vec<(u64, u64)>,
    },
    IncompatibleSignalingSystem {
        #[schema(inline)]
        blocks: Vec<Identifier>,
        #[schema(inline)]
        routes: Vec<Identifier>,
        track_section_ranges: Vec<TrackRange>,
        length: u64,
        incompatible_ranges: Vec<(u64, u64)>,
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
}

impl AsCoreRequest<Json<PathfindingResult>> for PathfindingRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/v2/pathfinding/blocks";
}
