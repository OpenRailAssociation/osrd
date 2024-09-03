use std::collections::HashMap;

use editoast_derive::ModelV2;
use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use serde::Serialize;
use utoipa::ToSchema;

use crate::views::rolling_stocks::light_rolling_stock::LightEffortCurves;

#[derive(Debug, Clone, ModelV2, Serialize, ToSchema)]
#[model(table = editoast_models::tables::rolling_stock)]
pub struct LightRollingStockModel {
    pub id: i64,
    pub railjson_version: String,
    #[model(identifier)]
    pub name: String,
    #[model(json)]
    pub effort_curves: LightEffortCurves,
    #[model(json)]
    pub metadata: Option<RollingStockMetadata>,
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
    #[model(remote = "Vec<Option<String>>")]
    pub supported_signaling_systems: RollingStockSupportedSignalingSystems,
}

#[cfg(test)]
pub mod tests {
    use editoast_models::DbConnectionPoolV2;
    use rstest::rstest;

    use super::LightRollingStockModel;
    use crate::modelsv2::fixtures::create_fast_rolling_stock;
    use crate::modelsv2::Retrieve;
    use crate::List;
    use crate::SelectionSettings;

    #[rstest]
    async fn get_light_rolling_stock() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();

        let rs_name = "fast_rolling_stock_name";
        let created_fast_rolling_stock =
            create_fast_rolling_stock(&db_pool.get_ok(), rs_name).await;

        // THEN
        assert!(
            LightRollingStockModel::retrieve(&db_pool.get_ok(), created_fast_rolling_stock.id)
                .await
                .is_ok()
        );
    }

    #[rstest]
    async fn list_light_rolling_stock() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();

        let rs_name = "fast_rolling_stock_name";
        let created_fast_rolling_stock =
            create_fast_rolling_stock(&db_pool.get_ok(), rs_name).await;

        // WHEN
        let rolling_stocks =
            LightRollingStockModel::list(&db_pool.get_ok(), SelectionSettings::new().limit(1000))
                .await
                .unwrap();

        // THEN
        assert!(!rolling_stocks.is_empty());
        let ids: Vec<i64> = rolling_stocks.iter().map(|x| x.id).collect();
        assert!(ids.contains(&created_fast_rolling_stock.id));
    }
}
