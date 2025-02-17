mod power_restrictions;

use std::collections::HashMap;

use editoast_common::units;
use editoast_common::units::quantities::{
    Acceleration, Deceleration, Length, Mass, Ratio, Time, Velocity,
};
use editoast_derive::Model;
use editoast_models::model;
use editoast_models::rolling_stock::RollingStockCategories;
use editoast_models::rolling_stock::RollingStockCategory;
use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::EtcsBrakeParams;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStock;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use power_restrictions::PowerRestriction;
use serde::Deserialize;
use serde::Serialize;

use utoipa::ToSchema;
use validator::ValidationError;
use validator::ValidationErrors;

use crate::models::prelude::*;

mod schedules_from_rolling_stock;
pub use schedules_from_rolling_stock::ScenarioReference;

editoast_common::schemas! {
    RollingStockModel,
    PowerRestriction,
}

#[editoast_derive::annotate_units]
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Model, ToSchema)]
#[model(table = editoast_models::tables::rolling_stock, error = Error)]
#[model(gen(ops = crud, batch_ops = r, list))]
#[model(changeset(derive(Deserialize), public))]
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
    #[serde(with = "units::meter")]
    #[model(uom_unit = "units::meter")]
    pub length: Length,
    #[serde(with = "units::meter_per_second")]
    #[model(uom_unit = "units::meter_per_second")]
    pub max_speed: Velocity,
    #[serde(with = "units::second")]
    #[model(uom_unit = "units::second")]
    pub startup_time: Time,
    #[serde(with = "units::meter_per_second_squared")]
    #[model(uom_unit = "units::meter_per_second_squared")]
    pub startup_acceleration: Acceleration,
    #[serde(with = "units::meter_per_second_squared")]
    #[model(uom_unit = "units::meter_per_second_squared")]
    pub comfort_acceleration: Acceleration,
    #[serde(with = "units::meter_per_second_squared")]
    #[model(uom_unit = "units::meter_per_second_squared")]
    pub const_gamma: Deceleration,
    #[model(json)]
    #[schema(required)]
    pub etcs_brake_params: Option<EtcsBrakeParams>,
    #[serde(with = "units::basis_point")]
    #[model(uom_unit = "units::basis_point")]
    pub inertia_coefficient: Ratio,
    #[schema(required)]
    pub base_power_class: Option<String>,
    #[serde(with = "units::kilogram")]
    #[model(uom_unit = "units::kilogram")]
    pub mass: Mass,
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
    #[serde(default, with = "units::second::option")]
    #[model(uom_unit = "units::second::option")]
    pub electrical_power_startup_time: Option<Time>,
    #[schema(required)]
    #[serde(default, with = "units::second::option")]
    #[model(uom_unit = "units::second::option")]
    pub raise_pantograph_time: Option<Time>,
    pub version: i64,
    #[schema(value_type = Vec<String>)]
    #[model(remote = "Vec<Option<String>>")]
    pub supported_signaling_systems: RollingStockSupportedSignalingSystems,
    pub primary_category: RollingStockCategory,
    #[model(remote = "Vec<Option<RollingStockCategory>>")]
    pub other_categories: RollingStockCategories,
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Rolling stock name already used: {name}")]
    NameAlreadyUsed { name: String },
    #[error("Rolling stock base power class cannot be an empty string")]
    BasePowerClassEmpty,
    #[error(transparent)]
    Database(editoast_models::model::Error),
}

impl From<model::Error> for Error {
    fn from(e: model::Error) -> Self {
        match e {
            model::Error::UniqueViolation {
                constraint,
                column,
                value,
            } if constraint == "rolling_stock_name_key" && column == "name" => {
                Self::NameAlreadyUsed { name: value }
            }
            model::Error::CheckViolation { constraint }
                if constraint == "base_power_class_null_or_non_empty" =>
            {
                Self::BasePowerClassEmpty
            }
            e => Self::Database(e),
        }
    }
}

impl RollingStockModelChangeset {
    pub fn validate(&self) -> std::result::Result<(), ValidationErrors> {
        let mut validation_errors = ValidationErrors::new();

        self.validate_primary_category(&mut validation_errors);

        self.validate_effort_curves(&mut validation_errors);

        if !validation_errors.is_empty() {
            return Err(validation_errors);
        }

        Ok(())
    }

    fn validate_effort_curves(&self, validation_errors: &mut ValidationErrors) {
        if let Some(effort_curves) = &self.effort_curves {
            if effort_curves.is_electric() {
                if self
                    .electrical_power_startup_time
                    .flatten()
                    .map(units::second::new)
                    .is_none()
                {
                    let mut error = ValidationError::new("electrical_power_startup_time");
                    error.message = Some(
                        "electrical_power_startup_time is required for electric rolling stocks"
                            .into(),
                    );
                    validation_errors.add("effort_curves", error);
                }
                if self
                    .raise_pantograph_time
                    .flatten()
                    .map(units::second::new)
                    .is_none()
                {
                    let mut error = ValidationError::new("raise_pantograph_time");
                    error.message = Some(
                        "raise_pantograph_time is required for electric rolling stocks".into(),
                    );
                    validation_errors.add("effort_curves", error);
                }
            }
        } else {
            validation_errors.add(
                "effort_curves",
                ValidationError::new("effort_curves is required"),
            );
        }
    }

    fn validate_primary_category(&self, validation_errors: &mut ValidationErrors) {
        if let Some(primary_category) = &self.primary_category {
            if let Some(other_categories) = &self.other_categories {
                if other_categories
                    .iter()
                    .flatten()
                    .collect::<Vec<_>>()
                    .contains(&primary_category)
                {
                    let mut error = ValidationError::new("primary_category");
                    error.message = Some("The primary_category cannot be listed in other_categories for rolling stocks.".into(),);
                    validation_errors.add("primary_category", error);
                }
            }
        } else {
            validation_errors.add(
                "primary_category",
                ValidationError::new("primary_category is required"),
            );
        }
    }
}

impl From<RollingStockModel> for RollingStock {
    fn from(rolling_stock_model: RollingStockModel) -> Self {
        RollingStock {
            railjson_version: rolling_stock_model.railjson_version,
            locked: rolling_stock_model.locked,
            metadata: rolling_stock_model.metadata,
            name: rolling_stock_model.name,
            effort_curves: rolling_stock_model.effort_curves,
            base_power_class: rolling_stock_model.base_power_class,
            length: rolling_stock_model.length,
            max_speed: rolling_stock_model.max_speed,
            startup_time: rolling_stock_model.startup_time,
            startup_acceleration: rolling_stock_model.startup_acceleration,
            comfort_acceleration: rolling_stock_model.comfort_acceleration,
            const_gamma: rolling_stock_model.const_gamma,
            etcs_brake_params: rolling_stock_model.etcs_brake_params,
            inertia_coefficient: rolling_stock_model.inertia_coefficient,
            mass: rolling_stock_model.mass,
            rolling_resistance: rolling_stock_model.rolling_resistance,
            loading_gauge: rolling_stock_model.loading_gauge,
            power_restrictions: rolling_stock_model.power_restrictions,
            energy_sources: rolling_stock_model.energy_sources,
            electrical_power_startup_time: rolling_stock_model.electrical_power_startup_time,
            raise_pantograph_time: rolling_stock_model.raise_pantograph_time,
            supported_signaling_systems: rolling_stock_model.supported_signaling_systems,
            primary_category: rolling_stock_model.primary_category.0,
            other_categories: editoast_schemas::rolling_stock::RollingStockCategories(
                rolling_stock_model
                    .other_categories
                    .0
                    .into_iter()
                    .map(|x| x.0)
                    .collect::<Vec<_>>(),
            ),
        }
    }
}

impl From<RollingStock> for RollingStockModelChangeset {
    fn from(rolling_stock: RollingStock) -> Self {
        RollingStockModel::changeset()
            .railjson_version(rolling_stock.railjson_version)
            .locked(rolling_stock.locked)
            .metadata(rolling_stock.metadata)
            .name(rolling_stock.name)
            .effort_curves(rolling_stock.effort_curves)
            .base_power_class(rolling_stock.base_power_class)
            .length(rolling_stock.length)
            .max_speed(rolling_stock.max_speed)
            .startup_time(rolling_stock.startup_time)
            .startup_acceleration(rolling_stock.startup_acceleration)
            .comfort_acceleration(rolling_stock.comfort_acceleration)
            .const_gamma(rolling_stock.const_gamma)
            .etcs_brake_params(rolling_stock.etcs_brake_params)
            .inertia_coefficient(rolling_stock.inertia_coefficient)
            .mass(rolling_stock.mass)
            .rolling_resistance(rolling_stock.rolling_resistance)
            .loading_gauge(rolling_stock.loading_gauge)
            .power_restrictions(rolling_stock.power_restrictions)
            .energy_sources(rolling_stock.energy_sources)
            .electrical_power_startup_time(rolling_stock.electrical_power_startup_time)
            .raise_pantograph_time(rolling_stock.raise_pantograph_time)
            .supported_signaling_systems(rolling_stock.supported_signaling_systems)
            .primary_category(RollingStockCategory(rolling_stock.primary_category))
            .other_categories(RollingStockCategories(
                rolling_stock
                    .other_categories
                    .0
                    .into_iter()
                    .map(RollingStockCategory)
                    .collect::<Vec<_>>(),
            ))
    }
}

#[cfg(test)]
pub mod tests {
    use editoast_models::rolling_stock::RollingStockCategories;
    use editoast_models::rolling_stock::RollingStockCategory;
    use rstest::rstest;
    use serde_json::to_value;

    use super::RollingStockModel;
    use crate::error::InternalError;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_rolling_stock_with_energy_sources;
    use crate::models::fixtures::fast_rolling_stock_changeset;
    use crate::models::fixtures::rolling_stock_with_energy_sources_changeset;
    use crate::models::prelude::*;
    use crate::views::rolling_stock::map_diesel_error;
    use crate::views::rolling_stock::RollingStockError;
    use editoast_models::DbConnectionPoolV2;

    #[rstest]
    async fn update_rolling_stock() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let rs_name = "fast_rolling_stock_name";

        let created_fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        // GIVEN
        let rs_name_with_energy_sources_name = "other_rolling_stock_update_rolling_stock";
        let rolling_stock_id = created_fast_rolling_stock.id;

        let rolling_stock_with_energy_sources: Changeset<RollingStockModel> =
            rolling_stock_with_energy_sources_changeset(rs_name_with_energy_sources_name);

        // WHEN
        let updated_rolling_stock = rolling_stock_with_energy_sources
            .update(&mut db_pool.get_ok(), rolling_stock_id)
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
            create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        // Creating the second rolling stock
        let rs_name_with_energy_sources_name = "fast_rolling_stock_with_energy_sources_name";
        let created_fast_rolling_stock_with_energy_sources =
            create_rolling_stock_with_energy_sources(
                &mut db_pool.get_ok(),
                rs_name_with_energy_sources_name,
            )
            .await;

        // WHEN
        let result = created_fast_rolling_stock_with_energy_sources
            .into_changeset()
            .update(&mut db_pool.get_ok(), created_fast_rolling_stock.id)
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

    #[rstest]
    async fn test_primary_category_with_empty_other_categories() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let created_fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "fast_rolling_stock_name").await;

        assert_eq!(
            created_fast_rolling_stock.primary_category,
            RollingStockCategory(
                editoast_schemas::rolling_stock::RollingStockCategory::CommuterTrain
            )
        );
        assert_eq!(
            created_fast_rolling_stock.other_categories,
            RollingStockCategories(vec![])
        );
    }

    #[rstest]
    async fn create_rolling_stock_with_categories() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let rolling_stock = fast_rolling_stock_changeset("fast_rolling_stock_with_categories")
            .primary_category(RollingStockCategory(
                editoast_schemas::rolling_stock::RollingStockCategory::HighSpeedTrain,
            ))
            .other_categories(RollingStockCategories(vec![
                RollingStockCategory(
                    editoast_schemas::rolling_stock::RollingStockCategory::TramTrain,
                ),
                RollingStockCategory(
                    editoast_schemas::rolling_stock::RollingStockCategory::CommuterTrain,
                ),
            ]))
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");
        assert_eq!(
            rolling_stock.primary_category,
            RollingStockCategory(
                editoast_schemas::rolling_stock::RollingStockCategory::HighSpeedTrain,
            ),
        );
        assert_eq!(
            rolling_stock.other_categories,
            RollingStockCategories(vec![
                RollingStockCategory(
                    editoast_schemas::rolling_stock::RollingStockCategory::TramTrain,
                ),
                RollingStockCategory(
                    editoast_schemas::rolling_stock::RollingStockCategory::CommuterTrain,
                ),
            ])
        );
    }
}
