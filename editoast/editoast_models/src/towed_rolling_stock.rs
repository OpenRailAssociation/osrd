use common::units;
use common::units::quantities::Acceleration;
use common::units::quantities::Deceleration;
use common::units::quantities::Length;
use common::units::quantities::Mass;
use common::units::quantities::Velocity;
use editoast_derive::Model;
use schemas::rolling_stock::RollingResistancePerWeight;
use serde::Deserialize;
use serde::Serialize;

use crate as editoast_models;
use crate::prelude::*;

#[editoast_derive::annotate_units]
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Model, utoipa::ToSchema)]
#[model(table = database::tables::towed_rolling_stock)]
#[model(gen(ops = crud, batch_ops = r, list))]
#[model(changeset(public))]
pub struct TowedRollingStock {
    pub id: i64,
    #[model(identifier)]
    pub name: String,
    pub label: String,
    pub railjson_version: String,
    pub locked: bool,

    #[serde(with = "units::kilogram")]
    #[model(uom_unit = "units::kilogram")]
    pub mass: Mass,
    #[serde(with = "units::meter")]
    #[model(uom_unit = "units::meter")]
    pub length: Length,
    #[serde(default, with = "units::meter_per_second::option")]
    #[model(uom_unit = "units::meter_per_second::option")]
    pub max_speed: Option<Velocity>,
    #[model(uom_unit = "units::meter_per_second_squared")]
    #[serde(with = "units::meter_per_second_squared")]
    pub comfort_acceleration: Acceleration,
    #[model(uom_unit = "units::meter_per_second_squared")]
    #[serde(with = "units::meter_per_second_squared")]
    pub startup_acceleration: Acceleration,
    pub inertia_coefficient: f64,
    #[model(json)]
    pub rolling_resistance: RollingResistancePerWeight,
    #[model(uom_unit = "units::meter_per_second_squared")]
    #[serde(with = "units::meter_per_second_squared")]
    pub const_gamma: Deceleration,

    pub version: i64,
}

impl From<TowedRollingStock> for schemas::TowedRollingStock {
    fn from(model: TowedRollingStock) -> Self {
        Self {
            name: model.name,
            label: model.label,
            railjson_version: model.railjson_version,
            mass: model.mass,
            length: model.length,
            comfort_acceleration: model.comfort_acceleration,
            startup_acceleration: model.startup_acceleration,
            inertia_coefficient: model.inertia_coefficient,
            rolling_resistance: model.rolling_resistance,
            const_gamma: model.const_gamma,
            max_speed: model.max_speed,
        }
    }
}

impl From<schemas::TowedRollingStock> for TowedRollingStockChangeset {
    fn from(towed_rolling_stock: schemas::TowedRollingStock) -> Self {
        TowedRollingStock::changeset()
            .name(towed_rolling_stock.name)
            .label(towed_rolling_stock.label)
            .railjson_version(towed_rolling_stock.railjson_version)
            .mass(towed_rolling_stock.mass)
            .length(towed_rolling_stock.length)
            .comfort_acceleration(towed_rolling_stock.comfort_acceleration)
            .startup_acceleration(towed_rolling_stock.startup_acceleration)
            .inertia_coefficient(towed_rolling_stock.inertia_coefficient)
            .rolling_resistance(towed_rolling_stock.rolling_resistance)
            .const_gamma(towed_rolling_stock.const_gamma)
            .max_speed(towed_rolling_stock.max_speed)
    }
}
