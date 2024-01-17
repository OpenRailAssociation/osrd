use crate::error::Result;
use crate::models::rolling_stock::rolling_stock_livery::RollingStockLiveryMetadata;
use crate::schema::rolling_stock::light_rolling_stock::{
    LightEffortCurves, LightRollingStock, LightRollingStockWithLiveries,
};
use crate::schema::rolling_stock::{
    EnergySource, Gamma, RollingResistance, RollingStockMetadata, SignalingSystem,
};
use crate::tables::rolling_stock;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::Data;
use diesel::result::Error as DieselError;
use diesel::{sql_query, ExpressionMethods, QueryDsl, SelectableHelper};
use diesel_async::RunQueryDsl;
use diesel_json::Json as DieselJson;
use editoast_derive::Model;
use serde::Serialize;
use std::collections::HashMap;
use utoipa::ToSchema;

#[derive(Debug, Model, Queryable, QueryableByName, Serialize, ToSchema)]
#[model(table = "rolling_stock")]
#[model(retrieve)]
#[diesel(table_name = rolling_stock)]
pub struct LightRollingStockModel {
    pub id: i64,
    railjson_version: String,
    name: String,
    #[schema(value_type = LightEffortCurves)]
    effort_curves: DieselJson<LightEffortCurves>,
    #[schema(value_type = RollingStockLiveryMetadata)]
    metadata: DieselJson<RollingStockMetadata>,
    length: f64,
    max_speed: f64,
    startup_time: f64,
    startup_acceleration: f64,
    comfort_acceleration: f64,
    gamma: DieselJson<Gamma>,
    inertia_coefficient: f64,
    pub base_power_class: Option<String>,
    features: Vec<Option<String>>,
    mass: f64,
    #[schema(value_type = RollingResistance)]
    rolling_resistance: DieselJson<RollingResistance>,
    #[schema(value_type = LoadingGaugeType)]
    loading_gauge: String,
    #[schema(value_type = HashMap<String, String>)]
    power_restrictions: Option<DieselJson<HashMap<String, String>>>,
    #[schema(value_type = Vec<EnergySource>)]
    energy_sources: DieselJson<Vec<EnergySource>>,
    locked: bool,
    electrical_power_startup_time: Option<f64>,
    raise_pantograph_time: Option<f64>,
    pub version: i64,
    #[schema(value_type = Vec<SignalingSystem>)]
    supported_signaling_systems: DieselJson<Vec<SignalingSystem>>,
}

impl LightRollingStockModel {
    pub async fn with_liveries(
        self,
        db_pool: Data<DbPool>,
    ) -> Result<LightRollingStockWithLiveries> {
        use crate::tables::rolling_stock_livery::dsl as livery_dsl;
        let mut conn = db_pool.get().await?;
        let liveries = livery_dsl::rolling_stock_livery
            .filter(livery_dsl::rolling_stock_id.eq(self.id))
            .select(RollingStockLiveryMetadata::as_select())
            .load(&mut conn)
            .await?;
        Ok(LightRollingStockWithLiveries {
            rolling_stock: self.into(),
            liveries: liveries.into_iter().map(DieselJson).collect(),
        })
    }

    /// List the rolling stocks with their simplified effort curves
    pub async fn list(
        db_pool: Data<DbPool>,
        page: i64,
        per_page: i64,
    ) -> Result<PaginatedResponse<LightRollingStockWithLiveries>> {
        let mut conn = db_pool.get().await?;
        sql_query(
            "WITH liveries_by_rs AS (SELECT rolling_stock_id, jsonb_build_object('id', livery.id, 'name', livery.name, 'compound_image_id', livery.compound_image_id) AS liveries
            FROM rolling_stock_livery livery)
            SELECT
                rolling_stock.*,
                COALESCE(ARRAY_AGG(liveries_by_rs.liveries) FILTER (WHERE liveries_by_rs.liveries is not NULL), ARRAY[]::jsonb[]) AS liveries
            FROM rolling_stock
            LEFT JOIN liveries_by_rs liveries_by_rs ON liveries_by_rs.rolling_stock_id = rolling_stock.id
            GROUP BY rolling_stock.id
            ORDER BY rolling_stock.id"
        )
        .paginate(page, per_page)
        .load_and_count(&mut conn).await
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
            features: rolling_stock_model.features.into_iter().flatten().collect(),
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
    use crate::fixtures::tests::{db_pool, named_fast_rolling_stock};
    use crate::models::Retrieve;
    use crate::DbPool;
    use actix_web::web::Data;
    use rstest::*;

    use super::LightRollingStockModel;

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
        assert!(LightRollingStockModel::retrieve(db_pool, rolling_stock_id)
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
