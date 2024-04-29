use std::collections::HashMap;

use actix_web::web::Data;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel::SelectableHelper;
use diesel_async::RunQueryDsl;
use editoast_derive::ModelV2;
use editoast_schemas::rolling_stock::EffortCurves;
use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStock;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;
use validator::Validate;
use validator::ValidationError;
use validator::ValidationErrors;

use crate::error::Result;
use crate::modelsv2::prelude::*;
use crate::modelsv2::rolling_stock_livery::RollingStockLiveryMetadataModel;
use crate::modelsv2::ConnectionPool;
use crate::views::rolling_stocks::RollingStockWithLiveries;

editoast_common::schemas! {
    RollingStockModel,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, ModelV2, ToSchema)]
#[model(table = crate::tables::rolling_stock)]
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
    pub async fn with_liveries(
        self,
        db_pool: Data<ConnectionPool>,
    ) -> Result<RollingStockWithLiveries> {
        use crate::tables::rolling_stock_livery::dsl as livery_dsl;
        let mut conn = db_pool.get().await?;
        let liveries = livery_dsl::rolling_stock_livery
            .filter(livery_dsl::rolling_stock_id.eq(self.id))
            .select(RollingStockLiveryMetadataModel::as_select())
            .load(&mut conn)
            .await?;
        Ok(RollingStockWithLiveries {
            rolling_stock: self,
            liveries: liveries.into_iter().map(|livery| livery.into()).collect(),
        })
    }

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
    use actix_web::web::Data;
    use rstest::*;
    use serde_json::to_value;

    use super::RollingStockModel;
    use crate::error::InternalError;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::get_other_rolling_stock_form;
    use crate::fixtures::tests::named_fast_rolling_stock;
    use crate::fixtures::tests::named_other_rolling_stock;
    use crate::modelsv2::Changeset;
    use crate::modelsv2::ConnectionPool;
    use crate::views::rolling_stocks::map_diesel_error;
    use crate::views::rolling_stocks::RollingStockError;

    pub fn get_invalid_effort_curves() -> &'static str {
        include_str!("../tests/example_rolling_stock_3.json")
    }

    #[rstest]
    async fn create_delete_rolling_stock(db_pool: Data<ConnectionPool>) {
        use crate::modelsv2::Retrieve;
        let mut db_conn = db_pool.get().await.expect("Failed to get db connection");
        let name = "fast_rolling_stock_create_delete_rolling_stock";
        let rolling_stock_id: i64;
        {
            let rolling_stock = named_fast_rolling_stock(name, db_pool.clone()).await;
            rolling_stock_id = rolling_stock.id();
            assert_eq!(name, rolling_stock.model.name.clone());
        }

        let rolling_stock = RollingStockModel::retrieve(&mut db_conn, rolling_stock_id)
            .await
            .unwrap();

        assert!(rolling_stock.is_none());
    }

    #[rstest]
    async fn update_rolling_stock(db_pool: Data<ConnectionPool>) {
        use crate::modelsv2::Update;
        let mut db_conn = db_pool.get().await.expect("Failed to get db connection");
        // GIVEN
        let other_rs_name = "other_rolling_stock_update_rolling_stock";
        let rolling_stock =
            named_fast_rolling_stock("fast_rolling_stock_update_rolling_stock", db_pool.clone())
                .await;
        let rolling_stock_id = rolling_stock.id();

        let updated_rolling_stock: Changeset<RollingStockModel> =
            get_other_rolling_stock_form(other_rs_name).into();
        // updated_rolling_stock.id = rolling_stock_id;

        // WHEN
        let updated_rolling_stock = updated_rolling_stock
            .update(&mut db_conn, rolling_stock_id)
            .await
            .unwrap()
            .unwrap();

        // THEN
        assert_eq!(updated_rolling_stock.name, other_rs_name);
    }

    #[rstest]
    async fn update_rolling_stock_failure_name_already_used(db_pool: Data<ConnectionPool>) {
        use crate::modelsv2::*;
        let mut db_conn = db_pool.get().await.expect("Failed to get db connection");
        // GIVEN
        let name = "fast_rolling_stock_update_rolling_stock_failure_name_already_used";
        let _rolling_stock = named_fast_rolling_stock(name, db_pool.clone()).await;
        let other_rolling_stock = named_other_rolling_stock(
            "other_rolling_stock_update_rolling_stock_failure_name_already_used",
            db_pool.clone(),
        )
        .await;

        let other_rolling_stock_id = other_rolling_stock.id();
        let mut other_rolling_stock =
            RollingStockModel::retrieve(&mut db_conn, other_rolling_stock_id)
                .await
                .unwrap()
                .unwrap();
        other_rolling_stock.name = name.to_string();

        // WHEN
        let result = other_rolling_stock
            .into_changeset()
            .update(&mut db_conn, other_rolling_stock_id)
            .await
            .map_err(|e| map_diesel_error(e, name));

        let error: InternalError = RollingStockError::NameAlreadyUsed {
            name: String::from(name),
        }
        .into();

        // THEN
        assert_eq!(
            to_value(result.unwrap_err()).unwrap(),
            to_value(error).unwrap()
        );
    }
}
