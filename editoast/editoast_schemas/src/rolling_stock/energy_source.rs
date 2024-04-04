use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

// Energy sources schema

/// energy source of a rolling stock
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(tag = "energy_source_type", deny_unknown_fields)]
pub enum EnergySource {
    /// energy source for a rolling stock representing a electrification
    Electrification {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        #[schema(minimum = 0, maximum = 1)]
        efficiency: f64,
    },
    PowerPack {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        energy_storage: EnergyStorage,
        #[schema(minimum = 0, maximum = 1)]
        efficiency: f64,
    },
    /// energy source for a rolling stock representing a battery
    Battery {
        max_input_power: SpeedDependantPower,
        max_output_power: SpeedDependantPower,
        energy_storage: EnergyStorage,
        #[schema(minimum = 0, maximum = 1)]
        efficiency: f64,
    },
}

/// power-speed curve (in an energy source)
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct SpeedDependantPower {
    speeds: Vec<f64>,
    powers: Vec<f64>,
}

/// energy storage of an energy source (of a rolling stock, can be a electrical battery or a hydrogen/fuel powerPack)
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct EnergyStorage {
    capacity: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc_min: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc_max: f64,
    #[schema(required)]
    refill_law: Option<RefillLaw>,
}

/// physical law defining how the storage can be refilled
#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct RefillLaw {
    #[schema(minimum = 0)]
    tau: f64,
    #[schema(minimum = 0, maximum = 1)]
    soc_ref: f64,
}
