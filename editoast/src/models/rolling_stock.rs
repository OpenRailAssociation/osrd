mod power_restrictions;

use std::collections::HashMap;

use common::units;
use common::units::quantities::Acceleration;
use common::units::quantities::Deceleration;
use common::units::quantities::Length;
use common::units::quantities::Mass;
use common::units::quantities::Time;
use common::units::quantities::Velocity;
use editoast_derive::Model;
use editoast_models::rolling_stock::TrainMainCategories;
use editoast_models::rolling_stock::TrainMainCategory;
use schemas::rolling_stock::EffortCurves;
use schemas::rolling_stock::EnergySource;
use schemas::rolling_stock::EtcsBrakeParams;
use schemas::rolling_stock::LoadingGaugeType;
use schemas::rolling_stock::RollingResistance;
use schemas::rolling_stock::RollingStockMetadata;
use schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use editoast_models::prelude::*;

mod schedules_from_rolling_stock;
pub use schedules_from_rolling_stock::ScenarioReference;

#[editoast_derive::annotate_units]
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Model, ToSchema)]
#[model(table = database::tables::rolling_stock)]
#[model(error(create = Error, update = Error))]
#[model(gen(ops = crud, batch_ops = r, list))]
#[model(changeset(derive(Deserialize), public))]
pub struct RollingStock {
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
    pub inertia_coefficient: f64,
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
    pub primary_category: TrainMainCategory,
    #[model(remote = "Vec<Option<TrainMainCategory>>")]
    pub other_categories: TrainMainCategories,
}

#[derive(Debug, thiserror::Error)]
#[cfg_attr(test, derive(PartialEq))]
pub enum Error {
    #[error("Rolling stock name already used: {name}")]
    NameAlreadyUsed { name: String },
    #[error("Rolling stock base power class cannot be an empty string")]
    BasePowerClassEmpty,
    #[error(transparent)]
    Database(editoast_models::Error),
}

impl From<editoast_models::Error> for Error {
    fn from(e: editoast_models::Error) -> Self {
        match e {
            editoast_models::Error::UniqueViolation {
                constraint,
                column,
                value,
            } if constraint == "rolling_stock_name_key" && column == "name" => {
                Self::NameAlreadyUsed { name: value }
            }
            editoast_models::Error::CheckViolation { constraint }
                if constraint == "base_power_class_null_or_non_empty" =>
            {
                Self::BasePowerClassEmpty
            }
            e => Self::Database(e),
        }
    }
}

impl From<RollingStock> for schemas::RollingStock {
    fn from(rolling_stock: RollingStock) -> Self {
        schemas::RollingStock {
            railjson_version: rolling_stock.railjson_version,
            metadata: rolling_stock.metadata,
            name: rolling_stock.name,
            effort_curves: rolling_stock.effort_curves,
            base_power_class: rolling_stock.base_power_class,
            length: rolling_stock.length,
            max_speed: rolling_stock.max_speed,
            startup_time: rolling_stock.startup_time,
            startup_acceleration: rolling_stock.startup_acceleration,
            comfort_acceleration: rolling_stock.comfort_acceleration,
            const_gamma: rolling_stock.const_gamma,
            etcs_brake_params: rolling_stock.etcs_brake_params,
            inertia_coefficient: rolling_stock.inertia_coefficient,
            mass: rolling_stock.mass,
            rolling_resistance: rolling_stock.rolling_resistance,
            loading_gauge: rolling_stock.loading_gauge,
            power_restrictions: rolling_stock.power_restrictions,
            energy_sources: rolling_stock.energy_sources,
            electrical_power_startup_time: rolling_stock.electrical_power_startup_time,
            raise_pantograph_time: rolling_stock.raise_pantograph_time,
            supported_signaling_systems: rolling_stock.supported_signaling_systems,
            primary_category: *rolling_stock.primary_category,
            other_categories: schemas::rolling_stock::TrainMainCategories(
                rolling_stock
                    .other_categories
                    .iter()
                    .map(|c| c.0)
                    .collect::<Vec<_>>(),
            ),
        }
    }
}

impl From<schemas::RollingStock> for RollingStockChangeset {
    fn from(rolling_stock: schemas::RollingStock) -> Self {
        RollingStock::changeset()
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
            .primary_category(TrainMainCategory(rolling_stock.primary_category))
            .other_categories(TrainMainCategories(
                rolling_stock
                    .other_categories
                    .0
                    .into_iter()
                    .map(TrainMainCategory)
                    .collect::<Vec<_>>(),
            ))
    }
}

#[cfg(test)]
pub mod tests {
    use editoast_models::rolling_stock::TrainMainCategories;
    use editoast_models::rolling_stock::TrainMainCategory;

    use super::RollingStock;
    use crate::models::fixtures::create_fast_rolling_stock;
    use crate::models::fixtures::create_rolling_stock_with_energy_sources;
    use crate::models::fixtures::fast_rolling_stock_changeset;
    use crate::models::fixtures::rolling_stock_with_energy_sources_changeset;
    use database::DbConnectionPoolV2;
    use editoast_models::prelude::*;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let rs_name = "fast_rolling_stock_name";

        let created_fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), rs_name).await;

        // GIVEN
        let rs_name_with_energy_sources_name = "other_rolling_stock_update_rolling_stock";
        let rolling_stock_id = created_fast_rolling_stock.id;

        let rolling_stock_with_energy_sources: Changeset<RollingStock> =
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock_failure_name_already_used() {
        let db_pool = DbConnectionPoolV2::for_tests();

        // GIVEN
        // Creating the first rolling stock
        let original_name = "micheline";
        let _ = create_fast_rolling_stock(&mut db_pool.get_ok(), original_name).await;

        // Creating the second rolling stock
        let new_name = "wrong name";
        let mut other_rs =
            create_rolling_stock_with_energy_sources(&mut db_pool.get_ok(), new_name).await;

        // WHEN
        other_rs.name = original_name.to_owned();
        let error = other_rs
            .save(&mut db_pool.get_ok())
            .await
            .expect_err("update should fail - name already used");

        assert_eq!(
            error,
            super::Error::NameAlreadyUsed {
                name: String::from(original_name)
            }
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_primary_category_with_empty_other_categories() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let created_fast_rolling_stock =
            create_fast_rolling_stock(&mut db_pool.get_ok(), "fast_rolling_stock_name").await;

        assert_eq!(
            created_fast_rolling_stock.primary_category,
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::CommuterTrain)
        );
        assert_eq!(
            created_fast_rolling_stock.other_categories,
            TrainMainCategories(vec![])
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_rolling_stock_with_categories() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let rolling_stock = fast_rolling_stock_changeset("fast_rolling_stock_with_categories")
            .primary_category(TrainMainCategory(
                schemas::rolling_stock::TrainMainCategory::HighSpeedTrain,
            ))
            .other_categories(TrainMainCategories(vec![
                TrainMainCategory(schemas::rolling_stock::TrainMainCategory::TramTrain),
                TrainMainCategory(schemas::rolling_stock::TrainMainCategory::CommuterTrain),
            ]))
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");
        assert_eq!(
            rolling_stock.primary_category,
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::HighSpeedTrain,),
        );
        assert_eq!(
            rolling_stock.other_categories,
            TrainMainCategories(vec![
                TrainMainCategory(schemas::rolling_stock::TrainMainCategory::TramTrain,),
                TrainMainCategory(schemas::rolling_stock::TrainMainCategory::CommuterTrain,),
            ])
        );
    }
}
