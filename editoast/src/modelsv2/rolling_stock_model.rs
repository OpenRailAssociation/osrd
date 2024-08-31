mod power_restrictions;
mod rolling_stock_usage;
pub use rolling_stock_usage::TrainScheduleScenarioStudyProject;

use std::collections::HashMap;

use editoast_derive::ModelV2;
use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStock;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use power_restrictions::PowerRestriction;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;
use validator::Validate;
use validator::ValidationError;
use validator::ValidationErrors;

use crate::modelsv2::prelude::*;

mod schedules_from_rolling_stock;
pub use schedules_from_rolling_stock::ScenarioReference;

editoast_common::schemas! {
    RollingStockModel,
    PowerRestriction,
    TrainScheduleScenarioStudyProject,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, ModelV2, ToSchema)]
#[model(table = editoast_models::tables::rolling_stock)]
#[model(changeset(derive(Validate), public))]
#[schema(as = RollingStock)]
pub struct RollingStockModel {
    pub id: i64,
    pub railjson_version: String,
    #[model(identifier)]
    pub name: String,
    #[model(json)]
    pub effort_curves: EffortCurves,
    #[model(json)]
    #[schema(required)]
    pub metadata: Option<RollingStockMetadata>,
    pub length: f64,
    pub max_speed: f64,
    pub startup_time: f64,
    pub startup_acceleration: f64,
    pub comfort_acceleration: f64,
    #[model(json)]
    pub gamma: Gamma,
    pub inertia_coefficient: f64,
    #[schema(required)]
    pub base_power_class: Option<String>,
    pub mass: f64,
    #[model(json)]
    pub rolling_resistance: RollingResistance,
    #[model(to_enum)]
    pub loading_gauge: LoadingGaugeType,
    #[model(json)]
    pub power_restrictions: HashMap<String, String>,
    #[model(json)]
    pub energy_sources: Vec<EnergySource>,
    pub locked: bool,
    #[schema(required)]
    pub electrical_power_startup_time: Option<f64>,
    #[schema(required)]
    pub raise_pantograph_time: Option<f64>,
    pub version: i64,
    #[schema(value_type = Vec<String>)]
    #[model(remote = "Vec<Option<String>>")]
    pub supported_signaling_systems: RollingStockSupportedSignalingSystems,
}

impl RollingStockModel {
    pub fn has_thermal_curves(&self) -> bool {
        self.effort_curves
            .modes
            .values()
            .any(|mode| !mode.is_electric)
    }

    pub fn supported_electrification(&self) -> Vec<String> {
        self.effort_curves
            .modes
            .iter()
            .filter(|(_, mode)| mode.is_electric)
            .map(|(key, _)| key.clone())
            .collect()
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

impl From<RollingStockModel> for RollingStock {
    fn from(rolling_stock_model: RollingStockModel) -> Self {
        RollingStock {
            railjson_version: rolling_stock_model.railjson_version,
            metadata: rolling_stock_model.metadata,
            name: rolling_stock_model.name,
            effort_curves: rolling_stock_model.effort_curves,
            base_power_class: rolling_stock_model.base_power_class,
            length: rolling_stock_model.length,
            max_speed: rolling_stock_model.max_speed,
            startup_time: rolling_stock_model.startup_time,
            startup_acceleration: rolling_stock_model.startup_acceleration,
            comfort_acceleration: rolling_stock_model.comfort_acceleration,
            gamma: rolling_stock_model.gamma,
            inertia_coefficient: rolling_stock_model.inertia_coefficient,
            mass: rolling_stock_model.mass,
            rolling_resistance: rolling_stock_model.rolling_resistance,
            loading_gauge: rolling_stock_model.loading_gauge,
            power_restrictions: rolling_stock_model.power_restrictions,
            energy_sources: rolling_stock_model.energy_sources,
            electrical_power_startup_time: rolling_stock_model.electrical_power_startup_time,
            raise_pantograph_time: rolling_stock_model.raise_pantograph_time,
            supported_signaling_systems: rolling_stock_model.supported_signaling_systems,
        }
    }
}

impl From<RollingStock> for RollingStockModelChangeset {
    fn from(rolling_stock: RollingStock) -> Self {
        RollingStockModel::changeset()
            .railjson_version(rolling_stock.railjson_version)
            .metadata(rolling_stock.metadata)
            .name(rolling_stock.name)
            .effort_curves(rolling_stock.effort_curves)
            .base_power_class(rolling_stock.base_power_class)
            .length(rolling_stock.length)
            .max_speed(rolling_stock.max_speed)
            .startup_time(rolling_stock.startup_time)
            .startup_acceleration(rolling_stock.startup_acceleration)
            .comfort_acceleration(rolling_stock.comfort_acceleration)
            .gamma(rolling_stock.gamma)
            .inertia_coefficient(rolling_stock.inertia_coefficient)
            .mass(rolling_stock.mass)
            .rolling_resistance(rolling_stock.rolling_resistance)
            .loading_gauge(rolling_stock.loading_gauge)
            .power_restrictions(rolling_stock.power_restrictions)
            .energy_sources(rolling_stock.energy_sources)
            .electrical_power_startup_time(rolling_stock.electrical_power_startup_time)
            .raise_pantograph_time(rolling_stock.raise_pantograph_time)
            .supported_signaling_systems(rolling_stock.supported_signaling_systems)
    }
}

#[cfg(test)]
pub mod tests {
    use rstest::*;
    use serde_json::to_value;
    use std::ops::DerefMut;

    use super::RollingStockModel;
    use crate::error::InternalError;
    use crate::modelsv2::fixtures::create_fast_rolling_stock;
    use crate::modelsv2::fixtures::create_rolling_stock_with_energy_sources;
    use crate::modelsv2::fixtures::rolling_stock_with_energy_sources_changeset;
    use crate::modelsv2::prelude::*;
    use crate::views::rolling_stock::map_diesel_error;
    use crate::views::rolling_stock::RollingStockError;
    use editoast_models::DbConnectionPoolV2;

    #[rstest]
    async fn update_rolling_stock() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let rs_name = "fast_rolling_stock_name";

        let created_fast_rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), rs_name).await;

        // GIVEN
        let rs_name_with_energy_sources_name = "other_rolling_stock_update_rolling_stock";
        let rolling_stock_id = created_fast_rolling_stock.id;

        let rolling_stock_with_energy_sources: Changeset<RollingStockModel> =
            rolling_stock_with_energy_sources_changeset(rs_name_with_energy_sources_name);

        // WHEN
        let updated_rolling_stock = rolling_stock_with_energy_sources
            .update(db_pool.get_ok().deref_mut(), rolling_stock_id)
            .await
            .expect("Failed to update rolling stock")
            .unwrap();

        // THEN
        assert_eq!(updated_rolling_stock.name, rs_name_with_energy_sources_name);
    }

    #[rstest]
    async fn update_rolling_stock_failure_name_already_used() {
        let db_pool = DbConnectionPoolV2::for_tests();

        // GIVEN
        // Creating the first rolling stock
        let rs_name = "fast_rolling_stock_name";
        let created_fast_rolling_stock =
            create_fast_rolling_stock(db_pool.get_ok().deref_mut(), rs_name).await;

        // Creating the second rolling stock
        let rs_name_with_energy_sources_name = "fast_rolling_stock_with_energy_sources_name";
        let created_fast_rolling_stock_with_energy_sources =
            create_rolling_stock_with_energy_sources(
                db_pool.get_ok().deref_mut(),
                rs_name_with_energy_sources_name,
            )
            .await;

        // WHEN
        let result = created_fast_rolling_stock_with_energy_sources
            .into_changeset()
            .update(db_pool.get_ok().deref_mut(), created_fast_rolling_stock.id)
            .await
            .map_err(|e| map_diesel_error(e, rs_name));

        let error: InternalError = RollingStockError::NameAlreadyUsed {
            name: String::from(rs_name),
        }
        .into();

        // THEN
        assert_eq!(
            to_value(result.unwrap_err()).unwrap(),
            to_value(error).unwrap()
        );
    }
}
