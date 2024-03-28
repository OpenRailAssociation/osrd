use std::collections::HashMap;

use actix_web::web::Data;
use derivative::Derivative;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel::SelectableHelper;
use diesel_async::RunQueryDsl;
use editoast_derive::ModelV2;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;
use validator::Validate;
use validator::ValidationError;
use validator::ValidationErrors;

use crate::error::Result;
use crate::modelsv2::prelude::*;
use crate::modelsv2::rolling_stock_livery::RollingStockLiveryMetadataModel;
use crate::schema::rolling_stock::EffortCurves;
use crate::schema::rolling_stock::EnergySource;
use crate::schema::rolling_stock::Gamma;
use crate::schema::rolling_stock::RollingResistance;
use crate::schema::rolling_stock::RollingStock;
use crate::schema::rolling_stock::RollingStockMetadata;
use crate::schema::rolling_stock::RollingStockWithLiveries;
use crate::schema::track_section::LoadingGaugeType;
use crate::DbPool;

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct RollingStockSupportedSignalingSystems(pub Vec<String>);

impl From<Vec<Option<String>>> for RollingStockSupportedSignalingSystems {
    fn from(features: Vec<Option<String>>) -> Self {
        Self(features.into_iter().flatten().collect())
    }
}
impl From<RollingStockSupportedSignalingSystems> for Vec<Option<String>> {
    fn from(features: RollingStockSupportedSignalingSystems) -> Self {
        features.0.into_iter().map(Some).collect()
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, Derivative, ModelV2, ToSchema)]
#[derivative(PartialEq)]
#[model(table = crate::tables::rolling_stock)]
#[model(changeset(derive(Deserialize, Serialize, Debug, Validate, PartialEq), public))]
pub struct RollingStockModel {
    pub id: i64,
    pub railjson_version: String,
    #[model(identifier)]
    #[derivative(PartialEq = "ignore")]
    pub name: String,
    #[model(json)]
    pub effort_curves: EffortCurves,
    #[model(json)]
    pub metadata: RollingStockMetadata,
    pub length: f64,
    pub max_speed: f64,
    pub startup_time: f64,
    pub startup_acceleration: f64,
    pub comfort_acceleration: f64,
    #[model(json)]
    pub gamma: Gamma,
    pub inertia_coefficient: f64,
    pub base_power_class: Option<String>,
    pub mass: f64,
    #[model(json)]
    pub rolling_resistance: RollingResistance,
    #[model(to_enum)]
    pub loading_gauge: LoadingGaugeType,
    #[model(json)]
    #[schema(required)]
    pub power_restrictions: HashMap<String, String>,
    #[model(json)]
    pub energy_sources: Vec<EnergySource>,
    pub locked: bool,
    pub electrical_power_startup_time: Option<f64>,
    pub raise_pantograph_time: Option<f64>,
    pub version: i64,
    #[schema(value_type = Vec<String>)]
    #[model(remote = "Vec<Option<String>>")]
    pub supported_signaling_systems: RollingStockSupportedSignalingSystems,
}

impl RollingStockModel {
    pub async fn with_liveries(self, db_pool: Data<DbPool>) -> Result<RollingStockWithLiveries> {
        use crate::tables::rolling_stock_livery::dsl as livery_dsl;
        let mut conn = db_pool.get().await?;
        let liveries = livery_dsl::rolling_stock_livery
            .filter(livery_dsl::rolling_stock_id.eq(self.id))
            .select(RollingStockLiveryMetadataModel::as_select())
            .load(&mut conn)
            .await?;
        Ok(RollingStockWithLiveries {
            rolling_stock: self.into(),
            liveries: liveries.into_iter().map(|livery| livery.into()).collect(),
        })
    }
}

impl RollingStockModelChangeset {
    pub fn validate_imported_rolling_stock(&self) -> std::result::Result<(), ValidationErrors> {
        self.validate()?;
        match &self.effort_curves {
            Some(effort_curves) => validate_rolling_stock(
                effort_curves,
                self.electrical_power_startup_time.flatten(),
                self.raise_pantograph_time.flatten(),
            )
            .map_err(|e| {
                let mut err = ValidationErrors::new();
                err.add("effort_curves", e);
                err
            }),
            None => {
                let mut err = ValidationErrors::new();
                err.add(
                    "effort_curves",
                    ValidationError::new("effort_curves is required"),
                );
                Err(err)
            }
        }
    }
}

pub fn validate_rolling_stock(
    effort_curves: &EffortCurves,
    electrical_power_startup_time: Option<f64>,
    raise_pantograph_time: Option<f64>,
) -> std::result::Result<(), ValidationError> {
    if !effort_curves.is_electric() {
        return Ok(());
    }
    if electrical_power_startup_time.is_none() || electrical_power_startup_time.is_none() {
        let mut error = ValidationError::new("electrical_power_startup_time");
        error.message =
            Some("electrical_power_startup_time is required for electric rolling stocks".into());
        return Err(error);
    }
    if raise_pantograph_time.is_none() || raise_pantograph_time.is_none() {
        let mut error = ValidationError::new("raise_pantograph_time");
        error.message =
            Some("raise_pantograph_time is required for electric rolling stocks".into());
        return Err(error);
    }
    Ok(())
}

// TODO remove it after refactor tests
impl From<RollingStock> for Changeset<RollingStockModel> {
    fn from(value: RollingStock) -> Self {
        RollingStockModel::changeset()
            .railjson_version(value.railjson_version)
            .name(value.common.name)
            .effort_curves(value.common.effort_curves)
            .metadata(value.metadata)
            .length(value.common.length)
            .max_speed(value.common.max_speed)
            .startup_time(value.common.startup_time)
            .startup_acceleration(value.common.startup_acceleration)
            .comfort_acceleration(value.common.comfort_acceleration)
            .gamma(value.common.gamma)
            .inertia_coefficient(value.common.inertia_coefficient)
            .base_power_class(value.common.base_power_class)
            .mass(value.common.mass)
            .rolling_resistance(value.common.rolling_resistance)
            .loading_gauge(value.common.loading_gauge)
            .power_restrictions(value.common.power_restrictions)
            .energy_sources(value.common.energy_sources)
            .electrical_power_startup_time(value.common.electrical_power_startup_time)
            .raise_pantograph_time(value.common.raise_pantograph_time)
            .supported_signaling_systems(value.common.supported_signaling_systems)
    }
}
