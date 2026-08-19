mod power_restrictions;

use std::collections::HashMap;
use std::collections::HashSet;

use schemas::rolling_stock::EffortCurves;
use schemas::rolling_stock::EnergySource;
use schemas::rolling_stock::LoadingGaugeType;
use schemas::rolling_stock::RollingResistancePerWeight;
use schemas::rolling_stock::RollingResistanceRaw;
use schemas::rolling_stock::RollingStockMetadata;
use schemas::rolling_stock::SupportedSignalingSystem;
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
use crate::sea_orm_types::Seconds;

mod schedules_from_rolling_stock;
pub use schedules_from_rolling_stock::ScenarioReference;

mod train_main_category;
pub use train_main_category::TrainMainCategory;

#[derive(Clone, Debug, DeriveValueType, Deserialize, Eq, PartialEq, Serialize, ToSchema)]
#[serde(transparent)]
pub struct SubCategoryColor(String);

impl From<schemas::rolling_stock::SubCategoryColor> for SubCategoryColor {
    fn from(value: schemas::rolling_stock::SubCategoryColor) -> Self {
        Self(value.into())
    }
}

impl From<SubCategoryColor> for schemas::rolling_stock::SubCategoryColor {
    fn from(value: SubCategoryColor) -> Self {
        value.0.into()
    }
}

impl From<String> for SubCategoryColor {
    fn from(value: String) -> Self {
        Self(value)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, DeriveEntityModel, ToSchema)]
#[sea_orm(table_name = "rolling_stock")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub railjson_version: String,
    #[sea_orm(unique)]
    pub name: String,
    #[sea_orm(column_type = "JsonBinary")]
    pub effort_curves: ForeignJson<EffortCurves>,
    #[sea_orm(column_type = "JsonBinary")]
    #[schema(required)]
    pub metadata: ForeignJson<Option<RollingStockMetadata>>,
    #[sea_orm(column_type = "Double")]
    pub length: Meters,
    #[sea_orm(column_type = "Double")]
    pub max_speed: MetersPerSecond,
    #[sea_orm(column_type = "Double")]
    pub startup_time: Seconds,
    #[sea_orm(column_type = "Double")]
    pub startup_acceleration: MetersPerSecondSquared,
    #[sea_orm(column_type = "Double")]
    pub comfort_acceleration: MetersPerSecondSquared,
    #[sea_orm(column_type = "Double")]
    pub const_gamma: MetersPerSecondSquared,
    pub inertia_coefficient: f64,
    #[schema(required)]
    pub base_power_class: Option<String>,
    #[sea_orm(column_type = "Double")]
    pub mass: Kilograms,
    #[sea_orm(column_type = "JsonBinary")]
    pub rolling_resistance: ForeignJson<RollingResistancePerWeight>,
    pub loading_gauge: LoadingGauge,
    #[sea_orm(column_type = "JsonBinary")]
    pub power_restrictions: ForeignJson<HashMap<String, String>>,
    #[sea_orm(column_type = "JsonBinary")]
    pub energy_sources: ForeignJson<Vec<EnergySource>>,
    pub locked: bool,
    #[schema(required)]
    #[sea_orm(column_type = "Double", nullable)]
    pub electrical_power_startup_time: Option<Seconds>,
    #[schema(required)]
    #[sea_orm(column_type = "Double", nullable)]
    pub raise_pantograph_time: Option<Seconds>,
    pub version: i64,
    #[sea_orm(column_type = "JsonBinary")]
    pub supported_signaling_systems: ForeignJson<HashSet<SupportedSignalingSystem>>,
    pub primary_category: TrainMainCategory,
    pub other_categories: Vec<TrainMainCategory>,
}

#[derive(
    Clone, Copy, Debug, Deserialize, DeriveActiveEnum, EnumIter, Eq, PartialEq, Serialize, ToSchema,
)]
#[sea_orm(rs_type = "i16", db_type = "SmallInteger")]
pub enum LoadingGauge {
    G1 = 0,
    G2 = 1,
    GA = 2,
    GB = 3,
    GB1 = 4,
    GC = 5,
    #[serde(rename = "FR3.3")]
    Fr3_3 = 6,
    #[serde(rename = "FR3.3/GB/G2")]
    Fr3_3GbG2 = 7,
    #[serde(rename = "GLOTT")]
    Glott = 8,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::rolling_stock_livery::Entity")]
    RollingStockLivery,
}

impl Related<super::rolling_stock_livery::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::RollingStockLivery.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

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
        if let Some(violation) = e.unique_violation()
            && violation.constraint == "rolling_stock_name_key"
            && violation.column == "name"
        {
            return Self::NameAlreadyUsed {
                name: violation.value,
            };
        }
        if e.is_check_violation("base_power_class_null_or_non_empty") {
            return Self::BasePowerClassEmpty;
        }
        Self::Database(e)
    }
}

impl From<sea_orm::DbErr> for Error {
    fn from(error: sea_orm::DbErr) -> Self {
        Self::from(crate::Error::from(error))
    }
}

impl From<LoadingGaugeType> for LoadingGauge {
    fn from(value: LoadingGaugeType) -> Self {
        match value {
            LoadingGaugeType::G1 => Self::G1,
            LoadingGaugeType::G2 => Self::G2,
            LoadingGaugeType::GA => Self::GA,
            LoadingGaugeType::GB => Self::GB,
            LoadingGaugeType::GB1 => Self::GB1,
            LoadingGaugeType::GC => Self::GC,
            LoadingGaugeType::Fr3_3 => Self::Fr3_3,
            LoadingGaugeType::Fr3_3GbG2 => Self::Fr3_3GbG2,
            LoadingGaugeType::Glott => Self::Glott,
        }
    }
}

impl From<LoadingGauge> for LoadingGaugeType {
    fn from(value: LoadingGauge) -> Self {
        match value {
            LoadingGauge::G1 => Self::G1,
            LoadingGauge::G2 => Self::G2,
            LoadingGauge::GA => Self::GA,
            LoadingGauge::GB => Self::GB,
            LoadingGauge::GB1 => Self::GB1,
            LoadingGauge::GC => Self::GC,
            LoadingGauge::Fr3_3 => Self::Fr3_3,
            LoadingGauge::Fr3_3GbG2 => Self::Fr3_3GbG2,
            LoadingGauge::Glott => Self::Glott,
        }
    }
}

impl From<Model> for schemas::RollingStock<RollingResistancePerWeight> {
    fn from(rolling_stock: Model) -> Self {
        Self {
            railjson_version: rolling_stock.railjson_version,
            metadata: rolling_stock.metadata.into_inner(),
            name: rolling_stock.name,
            effort_curves: rolling_stock.effort_curves.into_inner(),
            base_power_class: rolling_stock.base_power_class,
            length: rolling_stock.length.into(),
            max_speed: rolling_stock.max_speed.into(),
            startup_time: rolling_stock.startup_time.into(),
            startup_acceleration: rolling_stock.startup_acceleration.into(),
            comfort_acceleration: rolling_stock.comfort_acceleration.into(),
            const_gamma: rolling_stock.const_gamma.into(),
            inertia_coefficient: rolling_stock.inertia_coefficient,
            mass: rolling_stock.mass.into(),
            rolling_resistance: rolling_stock.rolling_resistance.into_inner(),
            loading_gauge: rolling_stock.loading_gauge.into(),
            power_restrictions: rolling_stock.power_restrictions.into_inner(),
            energy_sources: rolling_stock.energy_sources.into_inner(),
            electrical_power_startup_time: rolling_stock
                .electrical_power_startup_time
                .map(Into::into),
            raise_pantograph_time: rolling_stock.raise_pantograph_time.map(Into::into),
            supported_signaling_systems: rolling_stock.supported_signaling_systems.into_inner(),
            primary_category: rolling_stock.primary_category.into(),
            other_categories: rolling_stock
                .other_categories
                .into_iter()
                .map(Into::into)
                .collect(),
        }
    }
}

impl From<Model> for schemas::RollingStock<RollingResistanceRaw> {
    fn from(rolling_stock: Model) -> Self {
        schemas::RollingStock::<RollingResistanceRaw>::from(schemas::RollingStock::<
            RollingResistancePerWeight,
        >::from(rolling_stock))
    }
}

impl From<schemas::RollingStock<RollingResistancePerWeight>> for ActiveModel {
    fn from(rolling_stock: schemas::RollingStock<RollingResistancePerWeight>) -> Self {
        Self {
            railjson_version: Set(rolling_stock.railjson_version),
            metadata: Set(ForeignJson::new(rolling_stock.metadata)),
            name: Set(rolling_stock.name),
            effort_curves: Set(ForeignJson::new(rolling_stock.effort_curves)),
            base_power_class: Set(rolling_stock.base_power_class),
            length: Set(rolling_stock.length.into()),
            max_speed: Set(rolling_stock.max_speed.into()),
            startup_time: Set(rolling_stock.startup_time.into()),
            startup_acceleration: Set(rolling_stock.startup_acceleration.into()),
            comfort_acceleration: Set(rolling_stock.comfort_acceleration.into()),
            const_gamma: Set(rolling_stock.const_gamma.into()),
            inertia_coefficient: Set(rolling_stock.inertia_coefficient),
            mass: Set(rolling_stock.mass.into()),
            rolling_resistance: Set(ForeignJson::new(rolling_stock.rolling_resistance)),
            loading_gauge: Set(rolling_stock.loading_gauge.into()),
            power_restrictions: Set(ForeignJson::new(rolling_stock.power_restrictions)),
            energy_sources: Set(ForeignJson::new(rolling_stock.energy_sources)),
            electrical_power_startup_time: Set(rolling_stock
                .electrical_power_startup_time
                .map(Into::into)),
            raise_pantograph_time: Set(rolling_stock.raise_pantograph_time.map(Into::into)),
            supported_signaling_systems: Set(ForeignJson::new(
                rolling_stock.supported_signaling_systems,
            )),
            primary_category: Set(rolling_stock.primary_category.into()),
            other_categories: Set(rolling_stock
                .other_categories
                .into_iter()
                .map(Into::into)
                .collect()),
            locked: Set(false),
            version: Set(0),
            ..Default::default()
        }
    }
}

#[cfg(test)]
pub mod tests {
    use super::TrainMainCategory;

    use crate::rolling_stock;
    use database::Db;
    use sea_orm::ActiveModelTrait as _;
    use sea_orm::IntoActiveModel as _;
    use sea_orm::Set;

    async fn insert(
        db: &Db,
        rolling_stock: schemas::RollingStock<schemas::rolling_stock::RollingResistancePerWeight>,
        name: &str,
    ) -> rolling_stock::Model {
        let mut active: rolling_stock::ActiveModel = rolling_stock.into();
        active.name = Set(name.to_owned());
        active
            .insert(db)
            .await
            .expect("Failed to create rolling stock")
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock() {
        let db = Db::for_tests().await;
        let rs_name = "fast_rolling_stock_name";

        let created_fast_rolling_stock =
            insert(&db, schemas::fixtures::fast_rolling_stock(), rs_name).await;
        // GIVEN
        let rs_name_with_energy_sources_name = "other_rolling_stock_update_rolling_stock";
        let rolling_stock_id = created_fast_rolling_stock.id;
        let mut rolling_stock_with_energy_sources: rolling_stock::ActiveModel =
            schemas::fixtures::rolling_stock_with_energy_sources().into();
        rolling_stock_with_energy_sources.id = Set(rolling_stock_id);
        rolling_stock_with_energy_sources.name = Set(rs_name_with_energy_sources_name.to_string());
        // WHEN
        let updated_rolling_stock = rolling_stock_with_energy_sources
            .update(&db)
            .await
            .expect("Failed to update rolling stock");

        // THEN
        assert_eq!(updated_rolling_stock.name, rs_name_with_energy_sources_name);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn update_rolling_stock_failure_name_already_used() {
        let db = Db::for_tests().await;

        // GIVEN
        // Creating the first rolling stock
        let original_name = "micheline";
        let _ = insert(&db, schemas::fixtures::fast_rolling_stock(), original_name).await;
        // Creating the second rolling stock
        let new_name = "wrong name";
        let other_rs = insert(
            &db,
            schemas::fixtures::rolling_stock_with_energy_sources(),
            new_name,
        )
        .await;
        // WHEN
        let mut other_rs = other_rs.into_active_model();
        other_rs.name = Set(original_name.to_owned());
        let error = other_rs
            .update(&db)
            .await
            .map_err(super::Error::from)
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
        let db = Db::for_tests().await;

        let created_fast_rolling_stock = insert(
            &db,
            schemas::fixtures::fast_rolling_stock(),
            "fast_rolling_stock_name",
        )
        .await;
        assert_eq!(
            created_fast_rolling_stock.primary_category,
            TrainMainCategory::CommuterTrain
        );
        assert_eq!(created_fast_rolling_stock.other_categories, vec![]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_rolling_stock_with_categories() {
        let db = Db::for_tests().await;
        let mut active: rolling_stock::ActiveModel = schemas::fixtures::fast_rolling_stock().into();
        active.name = Set("fast_rolling_stock_with_categories".to_string());
        active.primary_category = Set(TrainMainCategory::HighSpeedTrain);
        active.other_categories = Set(vec![
            TrainMainCategory::TramTrain,
            TrainMainCategory::CommuterTrain,
        ]);
        let rolling_stock = active
            .insert(&db)
            .await
            .expect("Failed to create rolling stock");
        assert_eq!(
            rolling_stock.primary_category,
            TrainMainCategory::HighSpeedTrain,
        );
        assert_eq!(
            rolling_stock.other_categories,
            vec![
                TrainMainCategory::TramTrain,
                TrainMainCategory::CommuterTrain,
            ]
        );
    }
}
