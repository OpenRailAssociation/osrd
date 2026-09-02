mod power_restrictions;

use std::collections::HashMap;
use std::collections::HashSet;

use common::units;
use common::units::quantities::Acceleration;
use common::units::quantities::Deceleration;
use common::units::quantities::Length;
use common::units::quantities::Mass;
use common::units::quantities::Time;
use common::units::quantities::Velocity;
use editoast_derive::Model;
use schemas::rolling_stock::EffortCurves;
use schemas::rolling_stock::EnergySource;
use schemas::rolling_stock::LoadingGaugeType;
use schemas::rolling_stock::RollingResistancePerWeight;
use schemas::rolling_stock::RollingResistanceRaw;
use schemas::rolling_stock::RollingStockMetadata;
use schemas::rolling_stock::SupportedSignalingSystem;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::prelude::*;

mod schedules_from_rolling_stock;
pub use schedules_from_rolling_stock::ScenarioReference;

mod train_main_category;
pub use train_main_category::TrainMainCategories;
pub use train_main_category::TrainMainCategory;

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
    pub inertia_coefficient: f64,
    #[schema(required)]
    pub base_power_class: Option<String>,
    #[serde(with = "units::kilogram")]
    #[model(uom_unit = "units::kilogram")]
    pub mass: Mass,
    #[model(json)]
    pub rolling_resistance: RollingResistancePerWeight,
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
    #[model(json)]
    pub supported_signaling_systems: HashSet<SupportedSignalingSystem>,
    pub primary_category: TrainMainCategory,
    #[model(non_null_array = "TrainMainCategory")]
    pub other_categories: Vec<TrainMainCategory>,
}

#[derive(Debug, thiserror::Error)]
#[cfg_attr(test, derive(PartialEq))]
pub enum Error {
    #[error("Rolling stock name already used: {name}")]
    NameAlreadyUsed { name: String },
    #[error("Rolling stock base power class cannot be an empty string")]
    BasePowerClassEmpty,
    #[error(transparent)]
    Database(crate::Error),
}

impl From<crate::Error> for Error {
    fn from(e: crate::Error) -> Self {
        match e {
            crate::Error::UniqueViolation {
                constraint,
                column,
                value,
            } if constraint == "rolling_stock_name_key" && column == "name" => {
                Self::NameAlreadyUsed { name: value }
            }
            crate::Error::CheckViolation { constraint }
                if constraint == "base_power_class_null_or_non_empty" =>
            {
                Self::BasePowerClassEmpty
            }
            e => Self::Database(e),
        }
    }
}

impl From<RollingStock> for schemas::RollingStock<RollingResistancePerWeight> {
    fn from(rolling_stock: RollingStock) -> Self {
        Self {
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
            other_categories: rolling_stock
                .other_categories
                .iter()
                .map(|category| **category)
                .collect(),
        }
    }
}

impl From<RollingStock> for schemas::RollingStock<RollingResistanceRaw> {
    fn from(rolling_stock: RollingStock) -> Self {
        schemas::RollingStock::<RollingResistanceRaw>::from(schemas::RollingStock::<
            RollingResistancePerWeight,
        >::from(rolling_stock))
    }
}

impl From<schemas::RollingStock<RollingResistancePerWeight>> for RollingStockChangeset {
    fn from(rolling_stock: schemas::RollingStock<RollingResistancePerWeight>) -> Self {
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
            .other_categories(
                rolling_stock
                    .other_categories
                    .iter()
                    .map(|category| TrainMainCategory(*category))
                    .collect(),
            )
    }
}

#[cfg(test)]
pub mod tests {
    use super::RollingStock;
    use super::TrainMainCategory;

    use crate::prelude::*;
    use database::DbConnectionPoolV2;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let rs_name = "fast_rolling_stock_name";

        let created_fast_rolling_stock =
            Changeset::<RollingStock>::from(schemas::fixtures::fast_rolling_stock())
                .name(rs_name.to_string())
                .locked(false)
                .version(0)
                .create(&mut db_pool.get_ok())
                .await
                .expect("Failed to create rolling stock");
        // GIVEN
        let rs_name_with_energy_sources_name = "other_rolling_stock_update_rolling_stock";
        let rolling_stock_id = created_fast_rolling_stock.id;
        let rolling_stock_with_energy_sources =
            Changeset::<RollingStock>::from(schemas::fixtures::rolling_stock_with_energy_sources())
                .name(rs_name_with_energy_sources_name.to_string())
                .locked(false)
                .version(0);
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
        let _ = Changeset::<RollingStock>::from(schemas::fixtures::fast_rolling_stock())
            .name(original_name.to_string())
            .locked(false)
            .version(0)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create rolling stock");
        // Creating the second rolling stock
        let new_name = "wrong name";
        let mut other_rs =
            Changeset::<RollingStock>::from(schemas::fixtures::rolling_stock_with_energy_sources())
                .name(new_name.to_string())
                .locked(false)
                .version(0)
                .create(&mut db_pool.get_ok())
                .await
                .expect("Failed to create rolling stock");
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
            Changeset::<RollingStock>::from(schemas::fixtures::fast_rolling_stock())
                .name("fast_rolling_stock_name".to_owned())
                .locked(false)
                .version(0)
                .create(&mut db_pool.get_ok())
                .await
                .expect("Failed to create rolling stock");
        assert_eq!(
            created_fast_rolling_stock.primary_category,
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::CommuterTrain)
        );
        assert_eq!(created_fast_rolling_stock.other_categories, vec![]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_rolling_stock_with_categories() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock =
            Changeset::<RollingStock>::from(schemas::fixtures::fast_rolling_stock())
                .name("fast_rolling_stock_with_categories".to_string())
                .locked(false)
                .version(0)
                .primary_category(TrainMainCategory(
                    schemas::rolling_stock::TrainMainCategory::HighSpeedTrain,
                ))
                .other_categories(vec![
                    TrainMainCategory(schemas::rolling_stock::TrainMainCategory::TramTrain),
                    TrainMainCategory(schemas::rolling_stock::TrainMainCategory::CommuterTrain),
                ])
                .create(&mut db_pool.get_ok())
                .await
                .expect("Failed to create rolling stock");
        assert_eq!(
            rolling_stock.primary_category,
            TrainMainCategory(schemas::rolling_stock::TrainMainCategory::HighSpeedTrain,),
        );
        assert_eq!(
            rolling_stock.other_categories,
            vec![
                TrainMainCategory(schemas::rolling_stock::TrainMainCategory::TramTrain,),
                TrainMainCategory(schemas::rolling_stock::TrainMainCategory::CommuterTrain,),
            ]
        );
    }
}
