use crate::error::Result;
use crate::models::rolling_stock::rolling_stock_livery::RollingStockLiveryMetadata;
use crate::schema::rolling_stock::light_rolling_stock::{
    LightEffortCurves, LightRollingStock, LightRollingStockWithLiveries,
};
use crate::schema::rolling_stock::{EnergySource, Gamma, RollingResistance, RollingStockMetadata};
use crate::tables::osrd_infra_rollingstock;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::{block, Data};
use diesel::result::Error as DieselError;
use diesel::sql_query;
use diesel::ExpressionMethods;
use diesel::SelectableHelper;
use diesel::{QueryDsl, RunQueryDsl};
use diesel_json::Json as DieselJson;
use editoast_derive::Model;
use serde::Serialize;
use serde_json::Value as JsonValue;

#[derive(Debug, Model, Queryable, QueryableByName, Serialize)]
#[model(table = "osrd_infra_rollingstock")]
#[model(retrieve)]
#[diesel(table_name = osrd_infra_rollingstock)]
pub struct LightRollingStockModel {
    pub id: i64,
    name: String,
    railjson_version: String,
    locked: bool,
    effort_curves: DieselJson<LightEffortCurves>,
    base_power_class: String,
    length: f64,
    max_speed: f64,
    startup_time: f64,
    startup_acceleration: f64,
    comfort_acceleration: f64,
    gamma: DieselJson<Gamma>,
    inertia_coefficient: f64,
    features: Vec<String>,
    mass: f64,
    rolling_resistance: DieselJson<RollingResistance>,
    loading_gauge: String,
    metadata: DieselJson<RollingStockMetadata>,
    power_restrictions: Option<JsonValue>,
    energy_sources: DieselJson<Vec<EnergySource>>,
    electrical_power_startup_time: Option<f64>,
    raise_pantograph_time: Option<f64>,
    rollingstock_version: i64,
}

impl LightRollingStockModel {
    pub async fn with_liveries(
        self,
        db_pool: Data<DbPool>,
    ) -> Result<LightRollingStockWithLiveries> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_rollingstocklivery::dsl as livery_dsl;
            let mut conn = db_pool.get()?;
            let liveries = livery_dsl::osrd_infra_rollingstocklivery
                .filter(livery_dsl::rolling_stock_id.eq(self.id))
                .select(RollingStockLiveryMetadata::as_select())
                .load(&mut conn)?;
            Ok(LightRollingStockWithLiveries {
                rolling_stock: self.into(),
                liveries: liveries.into_iter().map(DieselJson).collect(),
            })
        })
        .await
        .unwrap()
    }

    /// List the rolling stocks with their simplified effort curves
    pub async fn list(
        db_pool: Data<DbPool>,
        page: i64,
        per_page: i64,
    ) -> Result<PaginatedResponse<LightRollingStockWithLiveries>> {
        let mut conn = db_pool.get()?;
        sql_query(
            "WITH liveries_by_rs AS (SELECT rolling_stock_id, jsonb_build_object('id', livery.id, 'name', livery.name, 'compound_image_id', livery.compound_image_id) AS liveries
            FROM osrd_infra_rollingstocklivery livery)
            SELECT
                rolling_stock.*,
                COALESCE(ARRAY_AGG(liveries_by_rs.liveries) FILTER (WHERE liveries_by_rs.liveries is not NULL), ARRAY[]::jsonb[]) AS liveries
            FROM osrd_infra_rollingstock rolling_stock
            LEFT JOIN liveries_by_rs liveries_by_rs ON liveries_by_rs.rolling_stock_id = rolling_stock.id
            GROUP BY rolling_stock.id"
        )
        .paginate(page, per_page)
        .load_and_count(&mut conn)
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
            features: rolling_stock_model.features,
            mass: rolling_stock_model.mass,
            rolling_resistance: rolling_stock_model.rolling_resistance,
            loading_gauge: rolling_stock_model.loading_gauge,
            metadata: rolling_stock_model.metadata,
            power_restrictions: rolling_stock_model.power_restrictions,
            energy_sources: rolling_stock_model.energy_sources,
            rollingstock_version: rolling_stock_model.rollingstock_version,
        }
    }
}

#[cfg(test)]
pub mod tests {
    use crate::fixtures::tests::{db_pool, fast_rolling_stock, TestFixture};
    use crate::models::{Retrieve, RollingStockModel};
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use rstest::*;

    use super::LightRollingStockModel;

    #[rstest]
    async fn get_light_rolling_stock(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
    ) {
        let rolling_stock = fast_rolling_stock.await;
        let rolling_stock_id = rolling_stock.id();

        assert!(
            LightRollingStockModel::retrieve(db_pool.clone(), rolling_stock_id)
                .await
                .is_ok()
        );
    }

    #[rstest]
    async fn list_light_rolling_stock(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
    ) {
        let rolling_stock = fast_rolling_stock.await;
        let rolling_stocks = LightRollingStockModel::list(db_pool.clone(), 1, 1000)
            .await
            .unwrap();
        assert!(rolling_stocks.count >= 1);
        let ids: Vec<i64> = rolling_stocks
            .results
            .iter()
            .map(|x| x.rolling_stock.id)
            .collect();
        assert!(ids.contains(&rolling_stock.id()));
    }
}
