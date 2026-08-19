use schemas::rolling_stock::RollingResistancePerWeight;
use sea_orm::ActiveValue::Set;
use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::sea_orm_types::ForeignJson;
use crate::sea_orm_types::Kilograms;
use crate::sea_orm_types::Meters;
use crate::sea_orm_types::MetersPerSecond;
use crate::sea_orm_types::MetersPerSecondSquared;

#[derive(Clone, Debug, DeriveEntityModel, Deserialize, PartialEq, Serialize, ToSchema)]
#[sea_orm(table_name = "towed_rolling_stock")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub name: String,
    pub label: String,
    pub railjson_version: String,
    pub locked: bool,
    #[sea_orm(column_type = "Double")]
    pub mass: Kilograms,
    #[sea_orm(column_type = "Double")]
    pub length: Meters,
    #[sea_orm(column_type = "Double", nullable)]
    pub max_speed: Option<MetersPerSecond>,
    #[sea_orm(column_type = "Double")]
    pub comfort_acceleration: MetersPerSecondSquared,
    #[sea_orm(column_type = "Double")]
    pub startup_acceleration: MetersPerSecondSquared,
    pub inertia_coefficient: f64,
    #[sea_orm(column_type = "JsonBinary")]
    pub rolling_resistance: ForeignJson<RollingResistancePerWeight>,
    #[sea_orm(column_type = "Double")]
    pub const_gamma: MetersPerSecondSquared,
    pub version: i64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

impl From<Model> for schemas::TowedRollingStock {
    fn from(model: Model) -> Self {
        Self {
            name: model.name,
            label: model.label,
            railjson_version: model.railjson_version,
            mass: model.mass.into(),
            length: model.length.into(),
            comfort_acceleration: model.comfort_acceleration.into(),
            startup_acceleration: model.startup_acceleration.into(),
            inertia_coefficient: model.inertia_coefficient,
            rolling_resistance: model.rolling_resistance.into_inner(),
            const_gamma: model.const_gamma.into(),
            max_speed: model.max_speed.map(Into::into),
        }
    }
}

impl From<schemas::TowedRollingStock> for ActiveModel {
    fn from(model: schemas::TowedRollingStock) -> Self {
        Self {
            name: Set(model.name),
            label: Set(model.label),
            railjson_version: Set(model.railjson_version),
            mass: Set(model.mass.into()),
            length: Set(model.length.into()),
            comfort_acceleration: Set(model.comfort_acceleration.into()),
            startup_acceleration: Set(model.startup_acceleration.into()),
            inertia_coefficient: Set(model.inertia_coefficient),
            rolling_resistance: Set(ForeignJson::new(model.rolling_resistance)),
            const_gamma: Set(model.const_gamma.into()),
            max_speed: Set(model.max_speed.map(Into::into)),
            locked: Set(false),
            version: Set(0),
            ..Default::default()
        }
    }
}
