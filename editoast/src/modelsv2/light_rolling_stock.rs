use std::collections::HashMap;

use actix_web::web::Data;
use diesel::sql_query;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel::SelectableHelper;
use diesel_async::RunQueryDsl;
use editoast_derive::ModelV2;
use editoast_schemas::rolling_stock::EnergySource;
use editoast_schemas::rolling_stock::Gamma;
use editoast_schemas::rolling_stock::LoadingGaugeType;
use editoast_schemas::rolling_stock::RollingResistance;
use editoast_schemas::rolling_stock::RollingStockMetadata;
use editoast_schemas::rolling_stock::RollingStockSupportedSignalingSystems;
use serde::Serialize;
use utoipa::ToSchema;

use super::Row;
use crate::error::Result;
use crate::modelsv2::rolling_stock_livery::RollingStockLiveryMetadataModel;
use crate::modelsv2::Model;
use crate::schema::rolling_stock::light_rolling_stock::LightEffortCurves;
use crate::schema::rolling_stock::light_rolling_stock::LightRollingStock;
use crate::schema::rolling_stock::light_rolling_stock::LightRollingStockWithLiveriesModel;
use crate::views::pagination::Paginate;
use crate::views::pagination::PaginatedResponse;
use crate::DbPool;

#[derive(Debug, Clone, ModelV2, Serialize, ToSchema)]
#[model(table = crate::tables::rolling_stock)]
pub struct LightRollingStockModel {
    pub id: i64,
    pub railjson_version: String,
    pub name: String,
    #[model(json)]
    pub effort_curves: LightEffortCurves,
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
    #[model(remote = "Vec<Option<String>>")]
    pub supported_signaling_systems: RollingStockSupportedSignalingSystems,
}

impl LightRollingStockModel {
    pub async fn with_liveries(
        self,
        db_pool: Data<DbPool>,
    ) -> Result<LightRollingStockWithLiveriesModel> {
        use crate::tables::rolling_stock_livery::dsl as livery_dsl;
        let mut conn = db_pool.get().await?;
        let liveries = livery_dsl::rolling_stock_livery
            .filter(livery_dsl::rolling_stock_id.eq(self.id))
            .select(RollingStockLiveryMetadataModel::as_select())
            .load(&mut conn)
            .await?;
        Ok(LightRollingStockWithLiveriesModel {
            rolling_stock: self.into(),
            liveries,
        })
    }

    /// List the rolling stocks with their simplified effort curves
    pub async fn list(
        db_pool: Data<DbPool>,
        page: i64,
        per_page: i64,
    ) -> Result<PaginatedResponse<LightRollingStockWithLiveriesModel>> {
        let conn = &mut db_pool.get().await?;
        let light_rolling_stocks = sql_query("SELECT * FROM rolling_stock ORDER BY id")
            .paginate(page, per_page)
            .load_and_count::<Row<LightRollingStockModel>>(conn)
            .await?;

        let lrs_results: Vec<LightRollingStockModel> = light_rolling_stocks
            .results
            .into_iter()
            .map(Self::from_row)
            .collect();

        let mut results = Vec::new();
        for lrs in lrs_results.into_iter() {
            results.push(lrs.with_liveries(db_pool.clone()).await?);
        }

        Ok(PaginatedResponse {
            count: light_rolling_stocks.count,
            previous: light_rolling_stocks.previous,
            next: light_rolling_stocks.next,
            results,
        })
    }
}

impl From<LightRollingStockModel> for LightRollingStock {
    fn from(rolling_stock_model: LightRollingStockModel) -> Self {
        LightRollingStock {
            id: rolling_stock_model.id,
            name: rolling_stock_model.name,
            railjson_version: rolling_stock_model.railjson_version,
            locked: rolling_stock_model.locked,
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
            metadata: rolling_stock_model.metadata,
            power_restrictions: rolling_stock_model.power_restrictions,
            energy_sources: rolling_stock_model.energy_sources,
            version: rolling_stock_model.version,
            supported_signaling_systems: rolling_stock_model.supported_signaling_systems,
        }
    }
}

#[cfg(test)]
pub mod tests {
    use actix_web::web::Data;
    use rstest::*;

    use super::LightRollingStockModel;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::named_fast_rolling_stock;
    use crate::modelsv2::Retrieve;
    use crate::DbPool;

    #[rstest]
    async fn get_light_rolling_stock(db_pool: Data<DbPool>) {
        // GIVEN
        let rolling_stock = named_fast_rolling_stock(
            "fast_rolling_stock_get_light_rolling_stock",
            db_pool.clone(),
        )
        .await;
        let rolling_stock_id = rolling_stock.id();

        // THEN
        let conn = &mut db_pool.get().await.unwrap();
        assert!(LightRollingStockModel::retrieve(conn, rolling_stock_id)
            .await
            .is_ok());
    }

    #[rstest]
    async fn list_light_rolling_stock(db_pool: Data<DbPool>) {
        // GIVEN
        let rolling_stock = named_fast_rolling_stock(
            "fast_rolling_stock_list_light_rolling_stock",
            db_pool.clone(),
        )
        .await;

        // WHEN
        let rolling_stocks = LightRollingStockModel::list(db_pool, 1, 1000)
            .await
            .unwrap();

        // THEN
        assert!(rolling_stocks.count >= 1);
        let ids: Vec<i64> = rolling_stocks
            .results
            .iter()
            .map(|x| x.rolling_stock.id)
            .collect();
        assert!(ids.contains(&rolling_stock.id()));
    }
}
