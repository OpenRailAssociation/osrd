use std::collections::BTreeMap;
use std::collections::HashMap;
use std::hash::DefaultHasher;
use std::hash::Hash;
use std::hash::Hasher;

use derivative::Derivative;
use editoast_common::units;
use editoast_common::units::quantities::{
    Acceleration, Deceleration, Length, Mass, Ratio, Time, Velocity,
};
use editoast_schemas::primitives::Identifier;
use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::EtcsBrakeParams;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStock;
use editoast_schemas::rolling_stock::TowedRollingStock;
use editoast_schemas::train_schedule::Comfort;
use editoast_schemas::train_schedule::Distribution;
use editoast_schemas::train_schedule::MarginValue;
use editoast_schemas::train_schedule::ReceptionSignal;
use editoast_schemas::train_schedule::TrainScheduleOptions;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::pathfinding::TrackRange;
use crate::client::get_app_version;
use crate::core::{AsCoreRequest, Json};
use crate::error::InternalError;
use crate::views::path::pathfinding::PathfindingFailure;

editoast_common::schemas! {
    CompleteReportTrain,
    RoutingRequirement,
    SignalCriticalPosition,
    SpacingRequirement,
    RoutingZoneRequirement,
    ZoneUpdate,
    ReportTrain,
    SimulationResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize, Derivative, ToSchema)]
#[derivative(Hash)]
pub struct PhysicsConsist {
    pub effort_curves: EffortCurves,
    pub base_power_class: Option<String>,
    /// Length of the rolling stock
    #[derivative(Hash(hash_with = "units::millimeter::hash"))]
    #[serde(with = "units::millimeter::u64")]
    #[schema(value_type = u64)]
    pub length: Length,
    /// Maximum speed of the rolling stock
    #[derivative(Hash(hash_with = "units::meter_per_second::hash"))]
    #[serde(with = "units::meter_per_second")]
    #[schema(value_type = f64)]
    pub max_speed: Velocity,
    #[derivative(Hash(hash_with = "units::millisecond::hash"))]
    #[serde(with = "units::millisecond::u64")]
    #[schema(value_type = u64)]
    pub startup_time: Time,
    #[derivative(Hash(hash_with = "units::meter_per_second_squared::hash"))]
    #[serde(with = "units::meter_per_second_squared")]
    #[schema(value_type = f64)]
    pub startup_acceleration: Acceleration,
    #[derivative(Hash(hash_with = "units::meter_per_second_squared::hash"))]
    #[serde(with = "units::meter_per_second_squared")]
    #[schema(value_type = f64)]
    pub comfort_acceleration: Acceleration,
    /// The constant gamma braking coefficient used when NOT circulating
    /// under ETCS/ERTMS signaling system
    #[derivative(Hash(hash_with = "units::meter_per_second_squared::hash"))]
    #[serde(with = "units::meter_per_second_squared")]
    #[schema(value_type = f64)]
    pub const_gamma: Deceleration,
    pub etcs_brake_params: Option<EtcsBrakeParams>,
    #[derivative(Hash(hash_with = "units::basis_point::hash"))]
    #[serde(with = "units::basis_point")]
    #[schema(value_type = f64)]
    pub inertia_coefficient: Ratio,
    /// Mass of the rolling stock
    #[derivative(Hash(hash_with = "units::kilogram::hash"))]
    #[serde(with = "units::kilogram::u64")]
    #[schema(value_type = u64)]
    pub mass: Mass,
    pub rolling_resistance: RollingResistance,
    /// Mapping of power restriction code to power class
    #[serde(default)]
    pub power_restrictions: BTreeMap<String, String>,
    /// The time the train takes before actually using electrical power.
    /// Is null if the train is not electric or the value not specified.
    #[derivative(Hash(hash_with = "units::millisecond::option::hash"))]
    #[serde(default, with = "units::millisecond::u64::option")]
    #[schema(value_type = Option<u64>)]
    pub electrical_power_startup_time: Option<Time>,
    /// The time it takes to raise this train's pantograph.
    /// Is null if the train is not electric or the value not specified.
    #[derivative(Hash(hash_with = "units::millisecond::option::hash"))]
    #[serde(default, with = "units::millisecond::u64::option")]
    #[schema(value_type = Option<u64>)]
    pub raise_pantograph_time: Option<Time>,
}

#[derive(Debug, Clone)]
pub struct PhysicsConsistParameters {
    pub total_mass: Option<Mass>,
    pub total_length: Option<Length>,
    pub max_speed: Option<Velocity>,
    pub towed_rolling_stock: Option<TowedRollingStock>,
    pub traction_engine: RollingStock,
}

impl PhysicsConsistParameters {
    pub fn from_traction_engine(traction_engine: RollingStock) -> Self {
        PhysicsConsistParameters {
            max_speed: None,
            total_length: None,
            total_mass: None,
            towed_rolling_stock: None,
            traction_engine,
        }
    }
}

impl PhysicsConsistParameters {
    pub fn compute_length(&self) -> Length {
        let towed_rolling_stock_length = self
            .towed_rolling_stock
            .as_ref()
            .map(|trs| trs.length)
            .unwrap_or_default();

        self.total_length
            .unwrap_or(self.traction_engine.length + towed_rolling_stock_length)
    }

    pub fn compute_max_speed(&self) -> Velocity {
        let max_speeds = [
            self.max_speed,
            self.towed_rolling_stock
                .as_ref()
                .and_then(|towed| towed.max_speed),
            Some(self.traction_engine.max_speed),
        ];
        max_speeds
            .into_iter()
            .flatten()
            .reduce(Velocity::min)
            .unwrap_or(self.traction_engine.max_speed)
    }

    pub fn compute_startup_acceleration(&self) -> Acceleration {
        self.towed_rolling_stock
            .as_ref()
            .map(|towed_rolling_stock| {
                self.traction_engine
                    .startup_acceleration
                    .max(towed_rolling_stock.startup_acceleration)
            })
            .unwrap_or(self.traction_engine.startup_acceleration)
    }

    pub fn compute_comfort_acceleration(&self) -> Acceleration {
        self.towed_rolling_stock
            .as_ref()
            .map(|towed_rolling_stock| {
                self.traction_engine
                    .comfort_acceleration
                    .min(towed_rolling_stock.comfort_acceleration)
            })
            .unwrap_or(self.traction_engine.comfort_acceleration)
    }

    pub fn compute_inertia_coefficient(&self) -> Ratio {
        if let (Some(towed_rolling_stock), Some(total_mass)) =
            (self.towed_rolling_stock.as_ref(), self.total_mass)
        {
            let towed_mass = total_mass - self.traction_engine.mass;
            let traction_engine_inertia =
                self.traction_engine.mass * self.traction_engine.inertia_coefficient;
            let towed_inertia = towed_mass * towed_rolling_stock.inertia_coefficient;
            (traction_engine_inertia + towed_inertia) / total_mass
        } else {
            self.traction_engine.inertia_coefficient
        }
    }

    pub fn compute_mass(&self) -> Mass {
        let traction_engine_mass = self.traction_engine.mass;
        let towed_rolling_stock_mass = self
            .towed_rolling_stock
            .as_ref()
            .map(|trs| trs.mass)
            .unwrap_or_default();
        self.total_mass
            .unwrap_or(traction_engine_mass + towed_rolling_stock_mass)
    }

    pub fn compute_rolling_resistance(&self) -> RollingResistance {
        if let (Some(towed_rolling_stock), Some(total_mass)) =
            (self.towed_rolling_stock.as_ref(), self.total_mass)
        {
            let traction_engine_rr = &self.traction_engine.rolling_resistance;
            let towed_rs_rr = &towed_rolling_stock.rolling_resistance;
            let traction_engine_mass = self.traction_engine.mass; // kg

            let towed_mass = total_mass - traction_engine_mass; // kg

            let traction_engine_solid_friction_a = traction_engine_rr.A; // N
            let traction_engine_viscosity_friction_b = traction_engine_rr.B; // N/(m/s)
            let traction_engine_aerodynamic_drag_c = traction_engine_rr.C; // N/(m/s)²

            let towed_solid_friction_a = towed_rs_rr.A * towed_mass; // N
            let towed_viscosity_friction_b = towed_rs_rr.B * towed_mass; // N/(m/s)
            let towed_aerodynamic_drag_c = towed_rs_rr.C * towed_mass; // N/(m/s)²

            let solid_friction_a = traction_engine_solid_friction_a + towed_solid_friction_a; // N
            let viscosity_friction_b =
                traction_engine_viscosity_friction_b + towed_viscosity_friction_b; // N/(m/s)
            let aerodynamic_drag_c = traction_engine_aerodynamic_drag_c + towed_aerodynamic_drag_c; // N/(m/s)²

            RollingResistance {
                rolling_resistance_type: traction_engine_rr.rolling_resistance_type.clone(),
                A: solid_friction_a,
                B: viscosity_friction_b,
                C: aerodynamic_drag_c,
            }
        } else {
            self.traction_engine.rolling_resistance.clone()
        }
    }

    pub fn compute_const_gamma(&self) -> Acceleration {
        self.towed_rolling_stock
            .as_ref()
            .map(|towed| Acceleration::min(towed.const_gamma, self.traction_engine.const_gamma))
            .unwrap_or_else(|| self.traction_engine.const_gamma)
    }

    pub fn compute_etcs_brake_params(&self) -> Option<EtcsBrakeParams> {
        // TODO: handle towed rolling-stock when applying ERTMS to that case
        assert!(
            !self
                .traction_engine
                .supported_signaling_systems
                .0
                .contains(&"ETCS_LEVEL2".to_string())
                || self.towed_rolling_stock.is_none(),
            "ETCS is not handled (yet) for towed rolling-stock"
        );

        self.traction_engine.etcs_brake_params.clone()
    }
}

impl From<PhysicsConsistParameters> for PhysicsConsist {
    fn from(params: PhysicsConsistParameters) -> Self {
        let length = params.compute_length();
        let max_speed = params.compute_max_speed();
        let startup_acceleration = params.compute_startup_acceleration();
        let comfort_acceleration = params.compute_comfort_acceleration();
        let inertia_coefficient = params.compute_inertia_coefficient();
        let mass = params.compute_mass();
        let rolling_resistance = params.compute_rolling_resistance();
        let const_gamma = params.compute_const_gamma();
        let etcs_brake_params = params.compute_etcs_brake_params();

        let traction_engine = params.traction_engine;

        Self {
            effort_curves: traction_engine.effort_curves,
            base_power_class: traction_engine.base_power_class,
            length,
            mass,
            max_speed,
            startup_time: traction_engine.startup_time,
            startup_acceleration,
            comfort_acceleration,
            const_gamma,
            etcs_brake_params,
            inertia_coefficient,
            rolling_resistance,
            power_restrictions: traction_engine.power_restrictions.into_iter().collect(),
            electrical_power_startup_time: traction_engine.electrical_power_startup_time,
            raise_pantograph_time: traction_engine.raise_pantograph_time,
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
    pub physics_consist: PhysicsConsist,
    pub electrical_profile_set_id: Option<i64>,
}

impl SimulationRequest {
    // Compute hash input of a simulation
    pub fn compute_train_simulation_hash_with_versioning(
        &self,
        infra_id: i64,
        infra_version: &String,
    ) -> String {
        let osrd_version = get_app_version().unwrap_or_default();
        let mut hasher = DefaultHasher::new();
        self.hash(&mut hasher);
        let hash_simulation_input = hasher.finish();
        format!("simulation_{osrd_version}.{infra_id}.{infra_version}.{hash_simulation_input}")
    }
}

#[derive(Serialize, Deserialize, PartialEq, Clone, Debug, ToSchema)]
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
        pathfinding_failed: PathfindingFailure,
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

impl SimulationResponse {
    pub fn simulation_run_time(&self) -> Option<u64> {
        if let SimulationResponse::Success { provisional, .. } = self {
            Some(
                *provisional
                    .times
                    .last()
                    .expect("core error: empty simulation result"),
            )
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use editoast_common::units;
    use editoast_schemas::rolling_stock::RollingResistance;
    use pretty_assertions::assert_eq;

    use crate::models::fixtures::create_simple_rolling_stock;
    use crate::models::fixtures::create_towed_rolling_stock;

    use super::PhysicsConsistParameters;

    fn create_physics_consist() -> PhysicsConsistParameters {
        PhysicsConsistParameters {
            total_length: Some(units::meter::new(100.0)),
            total_mass: Some(units::kilogram::new(50000.0)),
            max_speed: Some(units::meter_per_second::new(22.0)),
            towed_rolling_stock: Some(create_towed_rolling_stock()),
            traction_engine: create_simple_rolling_stock(),
        }
    }

    #[test]
    fn physics_consist_compute_length() {
        let mut physics_consist = create_physics_consist();
        physics_consist.total_length = Some(units::meter::new(100.0));
        physics_consist.traction_engine.length = units::meter::new(40.0);

        // We always take total_length
        assert_eq!(
            physics_consist.compute_length(),
            units::millimeter::new(100000.)
        );

        physics_consist.total_length = None;
        // When no total_length we take towed length + traction_engine length
        assert_eq!(
            physics_consist.compute_length(),
            units::millimeter::new(70000.)
        );

        physics_consist.total_length = None;
        physics_consist.towed_rolling_stock = None;
        // When no user specified length and towed rolling stock, we take traction_engine length
        assert_eq!(
            physics_consist.compute_length(),
            units::millimeter::new(40000.)
        );
    }

    #[test]
    fn physics_consist_compute_mass() {
        let mut physics_consist = create_physics_consist();
        physics_consist.total_mass = Some(units::kilogram::new(50000.0));
        physics_consist.traction_engine.mass = units::kilogram::new(15000.0);

        // We always take total_mass
        assert_eq!(physics_consist.compute_mass(), units::kilogram::new(50000.));

        physics_consist.total_mass = None;
        // When no total_mass we take towed mass + traction_engine mass
        assert_eq!(physics_consist.compute_mass(), units::kilogram::new(65000.));

        physics_consist.total_mass = None;
        physics_consist.towed_rolling_stock = None;
        // When no user specified mass and towed rolling stock, we take traction_engine mass
        assert_eq!(physics_consist.compute_mass(), units::kilogram::new(15000.));
    }

    #[test]
    fn physics_consist_max_speed() {
        // Towed max speed 35
        let mut physics_consist = create_physics_consist();
        physics_consist.max_speed = Some(units::meter_per_second::new(20.0));
        physics_consist.traction_engine.max_speed = units::meter_per_second::new(22.0);

        // We take the smallest max speed
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(20.0)
        );

        physics_consist.max_speed = Some(units::meter_per_second::new(25.0));
        physics_consist.traction_engine.max_speed = units::meter_per_second::new(24.0);

        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(24.0)
        );

        physics_consist.max_speed = None;
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(24.0)
        );

        physics_consist.traction_engine.max_speed = units::meter_per_second::new(40.0);
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(35.0)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_max_speed(),
            units::meter_per_second::new(40.0)
        );
    }

    #[test]
    fn physics_consist_compute_startup_acceleration() {
        let mut physics_consist = create_physics_consist(); // 0.06

        // We take the biggest
        assert_eq!(
            physics_consist.compute_startup_acceleration(),
            units::meter_per_second_squared::new(0.06)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_startup_acceleration(),
            units::meter_per_second_squared::new(0.04)
        );
    }

    #[test]
    fn physics_consist_compute_comfort_acceleration() {
        let mut physics_consist = create_physics_consist(); // 0.2

        // We take the smallest
        assert_eq!(
            physics_consist.compute_comfort_acceleration(),
            units::meter_per_second_squared::new(0.1)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_comfort_acceleration(),
            units::meter_per_second_squared::new(0.1)
        );
    }

    #[test]
    fn physics_consist_compute_inertia_coefficient() {
        let mut physics_consist = create_physics_consist();

        approx::assert_relative_eq!(
            units::basis_point::from(physics_consist.compute_inertia_coefficient()),
            1.065
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_inertia_coefficient(),
            units::basis_point::new(1.10,)
        );
    }

    #[test]
    fn physics_consist_compute_rolling_resistance() {
        let mut physics_consist = create_physics_consist();

        assert_eq!(
            physics_consist.compute_rolling_resistance(),
            RollingResistance {
                rolling_resistance_type: "davis".to_string(),
                A: units::newton::new(35001.0),
                B: units::kilogram_per_second::new(350.01),
                C: units::kilogram_per_meter::new(7.0005),
            }
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_rolling_resistance(),
            physics_consist.traction_engine.rolling_resistance,
        );
    }

    #[test]
    fn physics_consist_compute_gamma() {
        // Towed const gamma 0.5
        let mut physics_consist = create_physics_consist();
        physics_consist.traction_engine.const_gamma = units::meter_per_second_squared::new(0.4);

        assert_eq!(
            physics_consist.compute_const_gamma(),
            units::meter_per_second_squared::new(0.4)
        );

        physics_consist.traction_engine.const_gamma = units::meter_per_second_squared::new(0.6);
        assert_eq!(
            physics_consist.compute_const_gamma(),
            units::meter_per_second_squared::new(0.5)
        );

        physics_consist.towed_rolling_stock = None;
        assert_eq!(
            physics_consist.compute_const_gamma(),
            units::meter_per_second_squared::new(0.6)
        );
    }
}
