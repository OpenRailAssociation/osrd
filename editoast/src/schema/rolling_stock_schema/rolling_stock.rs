use crate::diesel::{QueryDsl, RunQueryDsl};
use crate::error::{InternalError, Result};
use crate::schema::rolling_stock_livery::RollingStockLiveryMetadata;
use crate::tables::osrd_infra_rollingstock;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::{block, Data};
use diesel::expression_methods::ExpressionMethods;
use diesel::result::Error as DieselError;
use diesel::{sql_query, SelectableHelper};
use diesel_json::Json as DieselJson;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use thiserror::Error;

#[derive(Debug, Deserialize, Serialize)]
pub struct RollingStock {
    pub id: i64,
    pub name: String,
    pub version: String,
    pub effort_curves: JsonValue,
    pub base_power_class: String,
    pub length: f64,
    pub max_speed: f64,
    pub startup_time: f64,
    pub startup_acceleration: f64,
    pub comfort_acceleration: f64,
    pub gamma: DieselJson<Gamma>,
    pub inertia_coefficient: f64,
    pub features: Vec<String>,
    pub mass: f64,
    pub rolling_resistance: DieselJson<RollingResistance>,
    pub loading_gauge: String,
    pub metadata: DieselJson<RollingStockMetadata>,
    pub power_restrictions: Option<JsonValue>,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Gamma {
    #[serde(rename = "type")]
    gamma_type: String,
    value: f64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
#[allow(non_snake_case)]
pub struct RollingResistance {
    #[serde(rename = "type")]
    rolling_resistance_type: String,
    A: f64,
    B: f64,
    C: f64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RollingStockMetadata {
    detail: String,
    family: String,
    rolling_stock_type: String,
    grouping: String,
    series: String,
    subseries: String,
    unit: String,
    number: String,
    reference: String,
}

#[derive(Debug, Serialize)]
pub struct RollingStockWithLiveries {
    #[serde(flatten)]
    pub rolling_stock: RollingStock,
    pub liveries: Vec<RollingStockLiveryMetadata>,
}

#[derive(Debug, Queryable, QueryableByName, Serialize, Selectable)]
#[diesel(table_name = osrd_infra_rollingstock)]
pub struct LightRollingStock {
    pub id: i64,
    name: String,
    version: String,
    base_power_class: String,
    length: f64,
    max_speed: f64,
    startup_time: f64,
    startup_acceleration: f64,
    comfort_acceleration: f64,
    gamma: JsonValue,
    inertia_coefficient: f64,
    features: Vec<String>,
    mass: f64,
    rolling_resistance: JsonValue,
    loading_gauge: String,
    metadata: JsonValue,
    power_restrictions: Option<JsonValue>,
}

#[derive(Debug, Serialize)]
pub struct LightRollingStockWithLiveries {
    #[serde(flatten)]
    pub rolling_stock: LightRollingStock,
    pub liveries: Vec<RollingStockLiveryMetadata>,
}

impl LightRollingStock {
    /// List the rolling stocks without their effort curves
    pub async fn list(
        db_pool: Data<DbPool>,
        page: i64,
        page_size: i64,
    ) -> Result<PaginatedResponse<LightRollingStock>> {
        block::<_, Result<_>>(move || {
            let mut conn = db_pool.get()?;
            sql_query(
                "WITH liveries_by_rs AS (SELECT rolling_stock_id, json_build_object('id', livery.id, 'name', livery.name) AS liveries
                FROM osrd_infra_rollingstocklivery livery)
                SELECT
                    rolling_stock.*,
                    COALESCE(ARRAY_AGG(liveries_by_rs.liveries), ARRAY[]::json[]) AS liveries
                FROM osrd_infra_rollingstock rolling_stock
                LEFT JOIN liveries_by_rs liveries_by_rs ON liveries_by_rs.rolling_stock_id = rolling_stock.id
                GROUP BY rolling_stock.id"
            )
            .paginate(page, page_size)
            .load_and_count(&mut conn)
        })
        .await.unwrap()
    }

    /// Retrieve a rolling stock without its effort curves
    pub async fn retrieve(
        db_pool: Data<DbPool>,
        rolling_stock_id: i64,
    ) -> Result<LightRollingStockWithLiveries> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_rollingstock::dsl as rolling_stock_dsl;
            use crate::tables::osrd_infra_rollingstocklivery::dsl as livery_dsl;
            let mut conn = db_pool.get()?;
            let rolling_stock = match rolling_stock_dsl::osrd_infra_rollingstock
                .find(rolling_stock_id)
                .select(LightRollingStock::as_select())
                .first(&mut conn)
            {
                Ok(rolling_stock) => Ok::<_, InternalError>(rolling_stock),
                Err(DieselError::NotFound) => {
                    Err(RollingStockError::NotFound { rolling_stock_id }.into())
                }
                Err(e) => Err(e.into()),
            }?;
            let liveries = livery_dsl::osrd_infra_rollingstocklivery
                .filter(livery_dsl::rolling_stock_id.eq(rolling_stock_id))
                .select(RollingStockLiveryMetadata::as_select())
                .load(&mut conn)?;
            Ok(LightRollingStockWithLiveries {
                rolling_stock,
                liveries,
            })
        })
        .await
        .unwrap()
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "rollingstocks")]
pub enum RollingStockError {
    #[error("Rolling stock '{rolling_stock_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { rolling_stock_id: i64 },
}

#[cfg(test)]
mod tests {
    use super::LightRollingStock;
    use crate::client::PostgresConfig;
    use crate::models::rolling_stock_models::rolling_stock::tests::get_rolling_stock_example;
    use crate::models::RollingStockModel;
    use crate::models::{Create, Delete};
    use actix_web::test as actix_test;
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;

    #[actix_test]
    async fn get_light_rolling_stock() {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        let rolling_stock: RollingStockModel =
            get_rolling_stock_example(String::from("very_fast_rolling_stock"));
        let rolling_stock = rolling_stock.create(db_pool.clone()).await.unwrap();
        let rolling_stock_id = rolling_stock.id.unwrap();

        LightRollingStock::retrieve(db_pool.clone(), rolling_stock_id)
            .await
            .unwrap();

        assert!(RollingStockModel::delete(db_pool.clone(), rolling_stock_id)
            .await
            .is_ok());
    }

    #[actix_test]
    async fn list_light_rolling_stock() {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        assert!(LightRollingStock::list(db_pool.clone(), 1, 1000)
            .await
            .is_ok());
    }
}
