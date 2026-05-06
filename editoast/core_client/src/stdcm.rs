use std::collections::HashSet;

use chrono::DateTime;
use chrono::Utc;
use schemas::infra::TrackOffset;
use schemas::rolling_stock::LoadingGaugeType;
use schemas::train_schedule::Comfort;
use schemas::train_schedule::MarginValue;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::pathfinding::PathfindingResultSuccess;
use super::pathfinding::TrackRange;
use super::simulation::PhysicsConsist;
use super::simulation::SimulationSuccess;
use crate::AsCoreRequest;
use crate::Json;
use crate::WorkerKey;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[schema(as = CoreStdcmRequest)]
pub struct Request {
    /// Infrastructure id
    pub infra: i64,
    /// Infrastructure expected version
    pub expected_version: i64,
    /// Timetable id
    pub timetable_id: i64,

    // Pathfinding inputs
    /// List of waypoints. Each waypoint is a list of track offset.
    pub path_items: Vec<PathItem>,
    /// Set of authorized track section ids for the current request
    pub allowed_track_sections: Option<HashSet<String>>,

    // Simulation inputs
    /// The comfort of the train
    pub comfort: Comfort,
    pub consist_schedule: ConsistSchedule,

    // STDCM search parameters
    /// Numerical integration time step in milliseconds. Use default value if not specified.
    pub time_step: Option<u64>,
    pub start_time: DateTime<Utc>,
    /// Maximum departure delay in milliseconds.
    pub maximum_departure_delay: u64,
    /// Maximum run time of the simulation in milliseconds
    pub maximum_run_time: u64,
    /// Gap between the created train and previous trains in milliseconds
    pub time_gap_before: u64,
    /// Gap between the created train and following trains in milliseconds
    pub time_gap_after: u64,
    /// Margin to apply to the whole train
    #[schema(inline)]
    pub margin: Option<MarginValue>,
    /// List of planned work schedules
    pub work_schedules: Vec<WorkSchedule>,
    /// List of applicable temporary speed limits between the train departure and arrival
    #[schema(inline)]
    pub temporary_speed_limits: Vec<TemporarySpeedLimit>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Deserialize, ToSchema)]
#[schema(as = CorePathItem)]
pub struct PathItem {
    /// The track offsets of the path item
    pub locations: Vec<TrackOffset>,
    /// Stop duration in milliseconds. None if the train does not stop at this path item.
    pub stop_duration: Option<u64>,
    /// If specified, describes when the train may arrive at the location
    pub step_timing_data: Option<StepTimingData>,
}

/// Contains the data of a step timing, when it is specified
#[derive(Debug, Clone, Serialize, PartialEq, Deserialize, ToSchema)]
#[schema(as = CoreStepTimingData)]
pub struct StepTimingData {
    /// Time the train should arrive at this point
    pub arrival_time: DateTime<Utc>,
    /// Tolerance for the arrival time, when it arrives before the expected time, in ms
    pub arrival_time_tolerance_before: u64,
    /// Tolerance for the arrival time, when it arrives after the expected time, in ms
    pub arrival_time_tolerance_after: u64,
}

/// Lighter description of a work schedule, with only the relevant information for core
#[derive(Debug, Clone, Serialize, PartialEq, Deserialize, ToSchema)]
#[schema(as = CoreWorkSchedule)]
pub struct WorkSchedule {
    /// Start time as a time delta from the stdcm start time in ms
    pub start_time: u64,
    /// End time as a time delta from the stdcm start time in ms
    pub end_time: u64,
    /// List of unavailable track ranges
    pub track_ranges: Vec<UndirectedTrackRange>,
}

/// Lighter description of a work schedule with only the relevant information for core
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[schema(as = CoreTemporarySpeedLimit)]
pub struct TemporarySpeedLimit {
    /// Speed limitation in m/s
    pub speed_limit: f64,
    /// Track ranges on which the speed limitation applies
    pub track_ranges: Vec<TrackRange>,
}

/// A range on a track section.
/// `begin` is always less than `end`.
#[derive(Serialize, Deserialize, Clone, Debug, ToSchema, Hash, PartialEq, Eq)]
#[schema(as = CoreUndirectedTrackRange)]
pub struct UndirectedTrackRange {
    /// The track section identifier.
    pub track_section: String,
    /// The beginning of the range in mm.
    pub begin: u64,
    /// The end of the range in mm.
    pub end: u64,
}

/// Represents a physics consist.
#[derive(Serialize, Deserialize, Clone, Debug, ToSchema, educe::Educe, PartialEq, Eq)]
#[schema(as = CoreConsistConfiguration)]
#[educe(Hash)]
pub struct ConsistConfiguration {
    /// List of supported signaling systems
    #[educe(Hash(method(common::hashing_hash_set_string)))]
    pub supported_signaling_systems: HashSet<String>,
    pub speed_limit_tag: Option<String>,
    /// The loading gauge of the rolling stock
    pub loading_gauge_type: LoadingGaugeType,
    #[schema(inline)]
    pub physics_consist: PhysicsConsist,
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema, Hash, PartialEq, Eq)]
pub struct ConsistSchedule {
    // Indices of steps where consist changes occur
    pub boundaries: Vec<usize>,
    // Consist configuration for each segment
    pub values: Vec<ConsistConfiguration>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "status", rename_all = "SCREAMING_SNAKE_CASE")]
#[allow(clippy::large_enum_variant)]
pub enum ProgressStatus {
    InProgress {
        point: ProgressCoordinates,
        best_travel_time: u64,
    },
    Done {
        result: Response,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, ToSchema)]
pub struct ProgressCoordinates {
    pub lat: f64,
    pub lon: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "status", rename_all = "snake_case")]
// We accepted the difference of memory size taken by variants
// Since there is only on success and others are error cases
#[allow(clippy::large_enum_variant)]
pub enum Response {
    Success {
        simulation: SimulationSuccess,
        path: PathfindingResultSuccess,
        departure_time: DateTime<Utc>,
    },
    PathNotFound,
}

impl AsCoreRequest<Json<Response>> for Request {
    const URL_PATH: &'static str = "/stdcm";

    fn worker_key(&self) -> WorkerKey {
        WorkerKey::Timetable {
            infra_id: self.infra,
            timetable_id: self.timetable_id,
        }
    }
}
