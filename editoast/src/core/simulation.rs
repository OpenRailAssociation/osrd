use std::collections::BTreeMap;
use std::collections::HashMap;

use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::Distribution;
use editoast_schemas::train_schedule::MarginValue;
use editoast_schemas::train_schedule::ReceptionSignal;
use editoast_schemas::train_schedule::TrainScheduleOptions;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::pathfinding::TrackRange;
use crate::core::pathfinding::PathfindingResult;
use crate::core::{AsCoreRequest, Json};
use crate::error::InternalError;
use crate::RollingStockModel;
use derivative::Derivative;
use editoast_schemas::primitives::Identifier;
use std::hash::Hash;

editoast_common::schemas! {
    CompleteReportTrain,
    RoutingRequirement,
    SignalSighting,
    SpacingRequirement,
    RoutingZoneRequirement,
    ZoneUpdate,
    ReportTrain,
    SimulationResponse,
}

#[derive(Debug, Serialize, Derivative)]
#[derivative(Hash)]
pub struct PhysicsRollingStock {
    pub effort_curves: EffortCurves,
    pub base_power_class: Option<String>,
    /// Length of the rolling stock in mm
    pub length: u64,
    /// Maximum speed of the rolling stock in m/s
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<3,_>"))]
    pub max_speed: f64,
    // Time in ms
    pub startup_time: u64,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    pub startup_acceleration: f64,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    pub comfort_acceleration: f64,
    pub gamma: Gamma,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<5,_>"))]
    pub inertia_coefficient: f64,
    /// Mass of the rolling stock in kg
    pub mass: u64,
    pub rolling_resistance: RollingResistance,
    /// Mapping of power restriction code to power class
    #[serde(default)]
    pub power_restrictions: BTreeMap<String, String>,
    /// The time the train takes before actually using electrical power (in miliseconds).
    /// Is null if the train is not electric or the value not specified.
    pub electrical_power_startup_time: Option<u64>,
    /// The time it takes to raise this train's pantograph in miliseconds.
    /// Is null if the train is not electric or the value not specified.
    pub raise_pantograph_time: Option<u64>,
}

impl From<RollingStockModel> for PhysicsRollingStock {
    fn from(value: RollingStockModel) -> Self {
        Self {
            effort_curves: value.effort_curves,
            base_power_class: value.base_power_class,
            length: (value.length * 1000.0).round() as u64,
            max_speed: value.max_speed,
            startup_time: (value.startup_time * 1000.0).round() as u64,
            startup_acceleration: value.startup_acceleration,
            comfort_acceleration: value.comfort_acceleration,
            gamma: value.gamma,
            inertia_coefficient: value.inertia_coefficient,
            mass: value.mass.round() as u64,
            rolling_resistance: value.rolling_resistance,
            power_restrictions: value.power_restrictions.into_iter().collect(),
            electrical_power_startup_time: value
                .electrical_power_startup_time
                .map(|v| (v * 1000.0).round() as u64),
            raise_pantograph_time: value
                .raise_pantograph_time
                .map(|v| (v * 1000.0).round() as u64),
        }
    }
}

#[derive(Debug, Clone, Hash, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ZoneUpdate {
    pub zone: String,
    // Time in ms
    pub time: u64,
    pub position: u64,
    pub is_entry: bool,
}

#[derive(Debug, Serialize, Hash)]
pub struct SimulationScheduleItem {
    /// Position on the path in mm
    pub path_offset: u64,
    /// Time in ms since the departure of the train
    pub arrival: Option<u64>,
    /// Duration of the stop in ms
    pub stop_for: Option<u64>,
    /// Whether the next signal is expected to be blocking while stopping
    pub reception_signal: ReceptionSignal,
}

#[derive(Debug, Serialize, Hash)]
pub struct SimulationMargins {
    /// Path offset separating margin transitions in mm
    pub boundaries: Vec<u64>,
    pub values: Vec<MarginValue>,
}

#[derive(Debug, Serialize, Hash)]
pub struct SimulationPowerRestrictionItem {
    /// Position on the path in mm
    pub from: u64,
    /// Position on the path in mm
    pub to: u64,
    pub value: String,
}

/// Path description
#[derive(Debug, Serialize, Hash)]
pub struct SimulationPath {
    pub blocks: Vec<Identifier>,
    pub routes: Vec<Identifier>,
    pub track_section_ranges: Vec<TrackRange>,
    /// The path offset in mm of each path item given as input of the pathfinding
    pub path_item_positions: Vec<u64>,
}

#[derive(Deserialize, Default, Serialize, Clone, Debug, ToSchema)]
pub struct ReportTrain {
    /// List of positions of a train
    /// Both positions (in mm) and times (in ms) must have the same length
    pub positions: Vec<u64>,
    pub times: Vec<u64>,
    /// List of speeds associated to a position
    pub speeds: Vec<f64>,
    /// Total energy consumption
    pub energy_consumption: f64,
    /// Time in ms of each path item given as input of the pathfinding
    /// The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path)
    pub path_item_times: Vec<u64>,
}

#[derive(Deserialize, Default, Serialize, Clone, Debug, ToSchema)]
pub struct CompleteReportTrain {
    #[serde(flatten)]
    pub report_train: ReportTrain,
    pub signal_sightings: Vec<SignalSighting>,
    pub zone_updates: Vec<ZoneUpdate>,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Debug, Clone, PartialEq, Hash, Serialize, Deserialize, ToSchema)]
pub struct SignalSighting {
    pub signal: String,
    /// Time in ms
    pub time: u64,
    /// Position in mm
    pub position: u64,
    pub state: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SpacingRequirement {
    pub zone: String,
    // Time in ms
    pub begin_time: u64,
    // Time in ms
    pub end_time: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct RoutingRequirement {
    pub route: String,
    /// Time in ms
    pub begin_time: u64,
    pub zones: Vec<RoutingZoneRequirement>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct RoutingZoneRequirement {
    pub zone: String,
    pub entry_detector: String,
    pub exit_detector: String,
    pub switches: HashMap<String, String>,
    /// Time in ms
    pub end_time: u64,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct ElectricalProfiles {
    /// List of `n` boundaries of the ranges (block path).
    /// A boundary is a distance from the beginning of the path in mm.
    pub boundaries: Vec<u64>,
    /// List of `n+1` values associated to the ranges
    #[schema(inline)]
    pub values: Vec<ElectricalProfileValue>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "electrical_profile_type", rename_all = "snake_case")]
pub enum ElectricalProfileValue {
    NoProfile,
    Profile {
        profile: Option<String>,
        handled: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "speed_limit_source_type", rename_all = "snake_case")]
#[allow(clippy::enum_variant_names)]
pub enum SpeedLimitSource {
    GivenTrainTag { tag: String },
    FallbackTag { tag: String },
    UnknownTag,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SpeedLimitProperty {
    /// in meters per second
    pub speed: f64,
    /// source of the speed-limit if relevant (tag used)
    #[schema(inline)]
    pub source: Option<SpeedLimitSource>,
}

/// A MRSP computation result (Most Restrictive Speed Profile)
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct SpeedLimitProperties {
    /// List of `n` boundaries of the ranges (block path).
    /// A boundary is a distance from the beginning of the path in mm.
    pub boundaries: Vec<u64>,
    /// List of `n+1` values associated to the ranges
    #[schema(inline)]
    pub values: Vec<SpeedLimitProperty>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct SimulationPowerRestrictionRange {
    /// Start position in the path in mm
    begin: u64,
    /// End position in the path in mm
    end: u64,
    code: String,
    /// Is power restriction handled during simulation
    handled: bool,
}

#[derive(Debug, Serialize, Derivative)]
#[derivative(Hash)]
pub struct SimulationRequest {
    pub infra: i64,
    pub expected_version: String,
    pub path: SimulationPath,
    pub schedule: Vec<SimulationScheduleItem>,
    pub margins: SimulationMargins,
    #[derivative(Hash(hash_with = "editoast_common::hash_float::<3,_>"))]
    pub initial_speed: f64,
    pub comfort: Comfort,
    pub constraint_distribution: Distribution,
    pub speed_limit_tag: Option<String>,
    pub power_restrictions: Vec<SimulationPowerRestrictionItem>,
    pub options: TrainScheduleOptions,
    pub rolling_stock: PhysicsRollingStock,
    pub electrical_profile_set_id: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone, Debug, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
// We accepted the difference of memory size taken by variants
// Since there is only on success and others are error cases
#[allow(clippy::large_enum_variant)]
pub enum SimulationResponse {
    Success {
        /// Simulation without any regularity margins
        base: ReportTrain,
        /// Simulation that takes into account the regularity margins
        provisional: ReportTrain,
        #[schema(inline)]
        /// User-selected simulation: can be base or provisional
        final_output: CompleteReportTrain,
        #[schema(inline)]
        mrsp: SpeedLimitProperties,
        #[schema(inline)]
        electrical_profiles: ElectricalProfiles,
    },
    PathfindingFailed {
        pathfinding_result: PathfindingResult,
    },
    SimulationFailed {
        core_error: InternalError,
    },
}

impl Default for SimulationResponse {
    fn default() -> Self {
        Self::Success {
            base: Default::default(),
            provisional: Default::default(),
            final_output: Default::default(),
            mrsp: Default::default(),
            electrical_profiles: Default::default(),
        }
    }
}

impl AsCoreRequest<Json<SimulationResponse>> for SimulationRequest {
    const METHOD: reqwest::Method = reqwest::Method::POST;
    const URL_PATH: &'static str = "/v2/standalone_simulation";

    fn infra_id(&self) -> Option<i64> {
        Some(self.infra)
    }
}
