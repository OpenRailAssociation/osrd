use std::collections::BTreeMap;
use std::collections::HashMap;
use std::hash::Hash;

use common::units;
use common::units::quantities::Acceleration;
use common::units::quantities::Deceleration;
use common::units::quantities::Length;
use common::units::quantities::Mass;
use common::units::quantities::Time;
use common::units::quantities::Velocity;
use educe::Educe;
use schemas::rolling_stock::EffortCurves;
use schemas::rolling_stock::EtcsBrakeParams;
use schemas::rolling_stock::RollingResistance;
use schemas::train_schedule::Comfort;
use schemas::train_schedule::Distribution;
use schemas::train_schedule::MarginValue;
use schemas::train_schedule::ReceptionSignal;
use schemas::train_schedule::TrainScheduleOptions;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::RawError;
use super::pathfinding::TrainPath;
use crate::AsCoreRequest;
use crate::Json;

#[derive(Debug, Clone, Serialize, Deserialize, Educe, PartialEq, ToSchema)]
#[educe(Hash)]
pub struct PhysicsConsist {
    pub effort_curves: EffortCurves,
    pub base_power_class: Option<String>,
    /// Length of the rolling stock
    #[educe(Hash(method(units::millimeter::hash)))]
    #[serde(with = "units::millimeter::u64")]
    #[schema(value_type = u64)]
    pub length: Length,
    /// Maximum speed of the rolling stock
    #[educe(Hash(method(units::meter_per_second::hash)))]
    #[serde(with = "units::meter_per_second")]
    #[schema(value_type = f64)]
    pub max_speed: Velocity,
    #[educe(Hash(method(units::millisecond::hash)))]
    #[serde(with = "units::millisecond::u64")]
    #[schema(value_type = u64)]
    pub startup_time: Time,
    #[educe(Hash(method(units::meter_per_second_squared::hash)))]
    #[serde(with = "units::meter_per_second_squared")]
    #[schema(value_type = f64)]
    pub startup_acceleration: Acceleration,
    #[educe(Hash(method(units::meter_per_second_squared::hash)))]
    #[serde(with = "units::meter_per_second_squared")]
    #[schema(value_type = f64)]
    pub comfort_acceleration: Acceleration,
    /// The constant gamma braking coefficient used when NOT circulating
    /// under ETCS/ERTMS signaling system
    #[educe(Hash(method(units::meter_per_second_squared::hash)))]
    #[serde(with = "units::meter_per_second_squared")]
    #[schema(value_type = f64)]
    pub const_gamma: Deceleration,
    pub etcs_brake_params: Option<EtcsBrakeParams>,
    #[educe(Hash(method(common::hash_float::<5,_>)))]
    pub inertia_coefficient: f64,
    /// Mass of the rolling stock
    #[educe(Hash(method(units::kilogram::hash)))]
    #[serde(with = "units::kilogram::u64")]
    #[schema(value_type = u64)]
    pub mass: Mass,
    pub rolling_resistance: RollingResistance,
    /// Mapping of power restriction code to power class
    #[serde(default)]
    pub power_restrictions: BTreeMap<String, String>,
    /// The time the train takes before actually using electrical power.
    /// Is null if the train is not electric or the value not specified.
    #[educe(Hash(method(units::millisecond::option::hash)))]
    #[serde(default, with = "units::millisecond::u64::option")]
    #[schema(value_type = Option<u64>)]
    pub electrical_power_startup_time: Option<Time>,
    /// The time it takes to raise this train's pantograph.
    /// Is null if the train is not electric or the value not specified.
    #[educe(Hash(method(units::millisecond::option::hash)))]
    #[serde(default, with = "units::millisecond::u64::option")]
    #[schema(value_type = Option<u64>)]
    pub raise_pantograph_time: Option<Time>,
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

#[derive(Deserialize, Default, PartialEq, Serialize, Clone, Debug, ToSchema)]
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

#[derive(Deserialize, Default, PartialEq, Serialize, Clone, Debug, ToSchema)]
pub struct CompleteReportTrain {
    #[serde(flatten)]
    pub report_train: ReportTrain,
    pub signal_critical_positions: Vec<SignalCriticalPosition>,
    pub zone_updates: Vec<ZoneUpdate>,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Debug, Clone, PartialEq, Hash, Serialize, Deserialize, ToSchema)]
/// First position (space and time) along the path where given signal must
/// be free (sighting time or closed-signal stop ending)
pub struct SignalCriticalPosition {
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

#[derive(Debug, Serialize, Educe)]
#[educe(Hash)]
pub struct Request {
    pub infra: i64,
    pub expected_version: i64,
    pub path: TrainPath,
    pub schedule: Vec<SimulationScheduleItem>,
    pub margins: SimulationMargins,
    #[educe(Hash(method(common::hash_float::<3,_>)))]
    pub initial_speed: f64,
    pub comfort: Comfort,
    pub constraint_distribution: Distribution,
    pub speed_limit_tag: Option<String>,
    pub power_restrictions: Vec<SimulationPowerRestrictionItem>,
    pub options: TrainScheduleOptions,
    pub physics_consist: PhysicsConsist,
    pub electrical_profile_set_id: Option<i64>,
    /// The path offset in mm of each path item given as input of the pathfinding
    pub path_item_positions: Vec<u64>,
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug)]
pub struct SimulationSuccess {
    /// Simulation without any regularity margins
    pub base: ReportTrain,
    /// Simulation that takes into account the regularity margins
    pub provisional: ReportTrain,
    /// User-selected simulation: can be base or provisional
    pub final_output: CompleteReportTrain,
    pub mrsp: SpeedLimitProperties,
    pub electrical_profiles: ElectricalProfiles,
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug)]
#[serde(tag = "status", rename_all = "snake_case")]
// We accepted the difference of memory size taken by variants
// Since there is only on success and others are error cases
#[allow(clippy::large_enum_variant)]
pub enum Response {
    Success(SimulationSuccess),
    SimulationFailed { core_error: RawError },
}

impl Response {
    #[cfg(feature = "mocking_client")]
    pub fn success(self) -> Option<SimulationSuccess> {
        match self {
            Response::Success(simulation_success) => Some(simulation_success),
            Response::SimulationFailed { .. } => None,
        }
    }
}

impl AsCoreRequest<Json<Response>> for Request {
    const URL_PATH: &'static str = "/standalone_simulation";

    fn worker_id(&self) -> Option<String> {
        Some(self.infra.to_string())
    }
}
