use std::collections::BTreeMap;
use std::collections::HashMap;
use std::hash::Hash;

use common::units;
use common::units::quantities::Acceleration;
use common::units::quantities::Deceleration;
use common::units::quantities::Length;
use common::units::quantities::Mass;
use common::units::quantities::Offset;
use common::units::quantities::Time;
use common::units::quantities::Velocity;
use educe::Educe;
use schemas::rolling_stock::EffortCurves;
use schemas::rolling_stock::EtcsBrakeParams;
use schemas::rolling_stock::RollingResistanceRaw;
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
use crate::WorkerKey;

#[editoast_derive::annotate_units]
#[derive(Debug, Clone, Serialize, Deserialize, Educe, ToSchema)]
#[educe(Hash, PartialEq, Eq)]
#[schema(as = CorePhysicsConsist)]
pub struct PhysicsConsist {
    pub effort_curves: EffortCurves,
    pub base_power_class: Option<String>,

    #[educe(Hash(method(units::millimeter::hash)))]
    #[serde(with = "units::millimeter::u64")]
    #[schema(value_type = u64)]
    pub length: Length,

    #[educe(Hash(method(units::meter_per_second::hash)))]
    #[educe(PartialEq(method(units::meter_per_second::eq)))]
    #[serde(with = "units::meter_per_second")]
    pub max_speed: Velocity,

    #[educe(Hash(method(units::millisecond::hash)))]
    #[serde(with = "units::millisecond::u64")]
    #[schema(value_type = u64)]
    pub startup_time: Time,

    #[educe(Hash(method(units::meter_per_second_squared::hash)))]
    #[educe(PartialEq(method(units::meter_per_second_squared::eq)))]
    #[serde(with = "units::meter_per_second_squared")]
    pub startup_acceleration: Acceleration,

    #[educe(Hash(method(units::meter_per_second_squared::hash)))]
    #[educe(PartialEq(method(units::meter_per_second_squared::eq)))]
    #[serde(with = "units::meter_per_second_squared")]
    pub comfort_acceleration: Acceleration,

    /// The constant gamma braking coefficient used when NOT circulating
    /// under ETCS/ERTMS signaling system
    #[educe(Hash(method(units::meter_per_second_squared::hash)))]
    #[educe(PartialEq(method(units::meter_per_second_squared::eq)))]
    #[serde(with = "units::meter_per_second_squared")]
    pub const_gamma: Deceleration,

    pub etcs_brake_params: Option<EtcsBrakeParams>,

    #[educe(Hash(method(common::hash_float::<5,_>)))]
    #[educe(PartialEq(method(common::float_eq)))]
    pub inertia_coefficient: f64,

    #[educe(Hash(method(units::kilogram::hash)))]
    #[serde(with = "units::kilogram::u64")]
    #[schema(value_type = u64)]
    pub mass: Mass,

    pub rolling_resistance: RollingResistanceRaw,

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
#[schema(as = CoreZoneUpdate)]
pub struct ZoneUpdate {
    pub zone: String,
    // Time in ms
    pub time: u64,
    pub position: u64,
    pub is_entry: bool,
}

#[derive(Debug, Serialize, Hash, PartialEq)]
pub struct SimulationScheduleItem {
    /// Position on the path in mm
    pub path_offset: u64,
    /// Time in ms since the departure of the train
    pub arrival: Option<u64>,
    /// Stop details if this is a stop
    pub stop_details: Option<StopDetails>,
}

#[derive(Debug, Serialize, Hash, PartialEq)]
pub struct StopDetails {
    /// Stop duration in ms
    pub duration: u64,
    /// Whether the next signal is expected to be blocking while stopping
    pub reception_signal: ReceptionSignal,
    /// Whether this stop is followed by a backtracking
    pub is_backtracking: bool,
}

#[derive(Debug, Serialize, Hash, PartialEq)]
pub struct SimulationMargins {
    /// Path offset separating margin transitions in mm
    pub boundaries: Vec<u64>,
    pub values: Vec<MarginValue>,
}

#[derive(Debug, Serialize, Hash, PartialEq)]
pub struct SimulationPowerRestrictionItem {
    /// Position on the path in mm
    pub from: u64,
    /// Position on the path in mm
    pub to: u64,
    pub value: String,
}

#[derive(Deserialize, Default, PartialEq, Serialize, Clone, Debug, ToSchema)]
#[schema(as = CoreReportTrain)]
pub struct ReportTrain {
    /// List of positions of a train
    /// Both positions (in mm) and times (in ms) must have the same length
    pub positions: Vec<u64>,
    pub times: Vec<u64>,
    /// List of speeds associated to a position
    pub speeds: Vec<f64>,
    /// Total energy consumption
    pub energy_consumption: f64,
    /// Time in ms at which the train *arrives* at each path item given as input of the pathfinding
    /// The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path)
    ///
    /// In case multiple path items are at the same position, the stop duration
    /// of the earlier ones are added to the path item time of the next. For
    /// example, if A and B are at the same position, and A has a stop duration
    /// of 2s, then the path item time of B will be equal to the path item time
    /// of A plus 2s.
    pub path_item_times: Vec<u64>,
}

#[derive(Deserialize, Default, PartialEq, Serialize, Clone, Debug, ToSchema)]
#[schema(as = CoreCompleteReportTrain)]
pub struct CompleteReportTrain {
    #[serde(flatten)]
    pub report_train: ReportTrain,
    pub signal_critical_positions: Vec<SignalCriticalPosition>,
    pub zone_updates: Vec<ZoneUpdate>,
    pub spacing_requirements: Vec<SpacingRequirement>,
    pub routing_requirements: Vec<RoutingRequirement>,
}

#[derive(Debug, Clone, PartialEq, Hash, Serialize, Deserialize, ToSchema)]
#[schema(as = CoreSignalCriticalPosition)]
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
#[schema(as = CoreSpacingRequirement)]
pub struct SpacingRequirement {
    pub zone: String,
    /// Time in ms since a reference point that depends on which struct embeds this one:
    /// - in `TrainRequirements` & `TrainRequirementsById` (conflict detection & timetable
    ///   requirements): a request-wide origin shared by all trains, `work_schedules` and the
    ///   response (`1970-01-01T00:00:00Z` for calendar timetables, the timetable start for
    ///   hourly ones);
    /// - in `CompleteReportTrain` (simulation results): the train's own `start_time`.
    pub begin_time: u64,
    /// Time in ms: see begin_time
    pub end_time: u64,
}

impl SpacingRequirement {
    pub fn shifted_by(&self, offset: Offset) -> Self {
        use uom::si::time::millisecond;
        Self {
            zone: self.zone.clone(),
            begin_time: self.begin_time + offset.get::<millisecond>() as u64,
            end_time: self.end_time + offset.get::<millisecond>() as u64,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[schema(as = CoreRoutingRequirement)]
pub struct RoutingRequirement {
    pub route: String,
    /// Time in ms since a reference point that depends on which struct embeds this one:
    /// - in `TrainRequirements` & `TrainRequirementsById` (conflict detection & timetable
    ///   requirements): a request-wide origin shared by all trains, `work_schedules` and the
    ///   response (`1970-01-01T00:00:00Z` for calendar timetables, the timetable start for
    ///   hourly ones);
    /// - in `CompleteReportTrain` (simulation results): the train's own `start_time`.
    pub begin_time: u64,
    pub zones: Vec<RoutingZoneRequirement>,
}

impl RoutingRequirement {
    pub fn shifted_by(&self, offset: Offset) -> Self {
        use uom::si::time::millisecond;
        Self {
            route: self.route.clone(),
            begin_time: self.begin_time + offset.get::<millisecond>() as u64,
            zones: self
                .zones
                .iter()
                .map(|zone| RoutingZoneRequirement {
                    zone: zone.zone.clone(),
                    entry_detector: zone.entry_detector.clone(),
                    exit_detector: zone.exit_detector.clone(),
                    switches: zone.switches.clone(),
                    end_time: zone.end_time + offset.get::<millisecond>() as u64,
                })
                .collect(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[schema(as = CoreRoutingZoneRequirement)]
pub struct RoutingZoneRequirement {
    pub zone: String,
    pub entry_detector: String,
    pub exit_detector: String,
    pub switches: HashMap<String, String>,
    /// Time in ms since a reference point that depends on which struct embeds this one:
    /// - in `TrainRequirements` & `TrainRequirementsById` (conflict detection & timetable
    ///   requirements): a request-wide origin shared by all trains, `work_schedules` and the
    ///   response (`1970-01-01T00:00:00Z` for calendar timetables, the timetable start for
    ///   hourly ones);
    /// - in `CompleteReportTrain` (simulation results): the train's own `start_time`.
    pub end_time: u64,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[schema(as = CoreElectricalProfiles)]
pub struct ElectricalProfiles {
    /// List of `n` boundaries of the ranges (block path).
    /// A boundary is a distance from the beginning of the path in mm.
    pub boundaries: Vec<u64>,
    /// List of `n+1` values associated to the ranges
    #[schema(inline)]
    pub values: Vec<ElectricalProfileValue>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[schema(as = CoreElectricalProfileValue, title_variants)]
#[serde(tag = "electrical_profile_type", rename_all = "snake_case")]
pub enum ElectricalProfileValue {
    NoProfile,
    Profile {
        profile: Option<String>,
        handled: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[schema(as = CoreSpeedLimitSource, title_variants)]
#[serde(tag = "speed_limit_source_type", rename_all = "snake_case")]
#[allow(clippy::enum_variant_names)]
pub enum SpeedLimitSource {
    GivenTrainTag { tag: String },
    FallbackTag { tag: String },
    UnknownTag,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[schema(as = CoreSpeedLimitProperty)]
pub struct SpeedLimitProperty {
    /// in meters per second
    pub speed: f64,
    /// source of the speed-limit if relevant (tag used)
    #[schema(inline)]
    pub source: Option<SpeedLimitSource>,
}

/// A MRSP computation result (Most Restrictive Speed Profile)

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[schema(as = CoreSpeedLimitProperties)]
pub struct SpeedLimitProperties {
    /// List of `n` boundaries of the ranges (block path).
    /// A boundary is a distance from the beginning of the path in mm.
    pub boundaries: Vec<u64>,
    /// List of `n+1` values associated to the ranges
    pub values: Vec<SpeedLimitProperty>,
}
#[derive(Debug, Serialize, Educe)]
#[educe(Hash)]
#[derive(PartialEq)]
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
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug)]
pub struct SimulationSuccess {
    /// Simulation without any regularity margins
    pub base: ReportTrain,
    /// Simulation that takes into account the regularity margins
    pub provisional: ReportTrain,
    /// Simulation that takes into account the regularity margins and the schedule item times
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
    pub fn success(self) -> Option<SimulationSuccess> {
        match self {
            Response::Success(simulation_success) => Some(simulation_success),
            Response::SimulationFailed { .. } => None,
        }
    }
}

impl AsCoreRequest<Json<Response>> for Request {
    const URL_PATH: &'static str = "/standalone_simulation";

    fn worker_key(&self) -> WorkerKey {
        WorkerKey::Infra(self.infra)
    }
}
