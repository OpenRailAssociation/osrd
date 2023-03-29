use crate::diesel::{QueryDsl, RunQueryDsl};
use crate::error::{InternalError, Result};
use crate::tables::osrd_infra_rollingstock;
use crate::tables::osrd_infra_rollingstock::dsl;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::{block, Data};
use diesel::expression_methods::ExpressionMethods;
use diesel::result::Error as DieselError;
use diesel::{sql_query, SelectableHelper};
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use thiserror::Error;

use super::rolling_stock_livery::RollingStockLiveryMetadata;

#[derive(Debug, Insertable, Deserialize)]
#[diesel(table_name = osrd_infra_rollingstock)]
pub struct RollingStockForm {
    pub name: String,
    pub version: String,
    pub effort_curves: JsonValue,
    pub base_power_class: String,
    pub length: f64,
    pub max_speed: f64,
    pub startup_time: f64,
    pub startup_acceleration: f64,
    pub comfort_acceleration: f64,
    pub gamma: JsonValue,
    pub inertia_coefficient: f64,
    pub features: Vec<String>,
    pub mass: f64,
    pub rolling_resistance: JsonValue,
    pub loading_gauge: String,
    pub metadata: JsonValue,
    pub power_restrictions: Option<JsonValue>,
}

#[derive(Debug, Queryable, Identifiable, Serialize)]
#[diesel(table_name = osrd_infra_rollingstock)]
pub struct RollingStock {
    pub id: i64,
    name: String,
    version: String,
    effort_curves: JsonValue,
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
pub struct RollingStockWithLiveries {
    #[serde(flatten)]
    pub rolling_stock: RollingStock,
    pub liveries: Vec<RollingStockLiveryMetadata>,
}

impl RollingStock {
    /// Retrieve a rolling stock with its curves and liveries
    pub async fn retrieve(
        db_pool: Data<DbPool>,
        rolling_stock_id: i64,
    ) -> Result<RollingStockWithLiveries> {
        block::<_, Result<RollingStockWithLiveries>>(move || {
            use crate::tables::osrd_infra_rollingstock::dsl as rolling_stock_dsl;
            use crate::tables::osrd_infra_rollingstocklivery::dsl as livery_dsl;
            let mut conn = db_pool.get()?;
            let rolling_stock = match rolling_stock_dsl::osrd_infra_rollingstock
                .find(rolling_stock_id)
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
            Ok(RollingStockWithLiveries {
                rolling_stock,
                liveries,
            })
        })
        .await
        .unwrap()
    }

    /// Create a rolling stock
    pub async fn create(
        db_pool: Data<DbPool>,
        rolling_stock_data: RollingStockForm,
    ) -> Result<RollingStock> {
        block::<_, Result<_>>(move || {
            let mut conn = db_pool.get()?;
            Ok(diesel::insert_into(dsl::osrd_infra_rollingstock)
                .values(&rolling_stock_data)
                .get_result::<RollingStock>(&mut conn)?)
        })
        .await
        .unwrap()
    }

    /// Delete a rolling stock
    pub async fn delete(db_pool: Data<DbPool>, rolling_stock_id: i64) -> Result<()> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_rollingstock::dsl::*;
            let mut conn = db_pool.get()?;
            match diesel::delete(osrd_infra_rollingstock.filter(id.eq(rolling_stock_id)))
                .execute(&mut conn)
            {
                Ok(1) => Ok(()),
                Ok(_) => Err(RollingStockError::NotFound { rolling_stock_id }.into()),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }
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
enum RollingStockError {
    #[error("Rolling stock '{rolling_stock_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { rolling_stock_id: i64 },
}

#[cfg(test)]
mod tests {
    use super::{LightRollingStock, RollingStock, RollingStockForm};
    use crate::client::PostgresConfig;
    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;

    #[actix_test]
    async fn create_get_delete_rolling_stock() {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        let rolling_stock_form: RollingStockForm =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");

        let rolling_stock = RollingStock::create(db_pool.clone(), rolling_stock_form)
            .await
            .unwrap();

        let rolling_stock_retrieved = RollingStock::retrieve(db_pool.clone(), rolling_stock.id)
            .await
            .unwrap();
        assert_eq!(rolling_stock_retrieved.rolling_stock.id, rolling_stock.id);

        RollingStock::delete(db_pool.clone(), rolling_stock.id)
            .await
            .unwrap();

        assert_eq!(
            RollingStock::retrieve(db_pool.clone(), rolling_stock.id)
                .await
                .unwrap_err()
                .get_status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            RollingStock::delete(db_pool.clone(), rolling_stock.id)
                .await
                .unwrap_err()
                .get_status(),
            StatusCode::NOT_FOUND
        );
    }

    #[actix_test]
    async fn get_light_rolling_stock() {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        let mut rolling_stock_form: RollingStockForm =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");
        rolling_stock_form.name = String::from("very_fast_rolling_stock");

        let rolling_stock = RollingStock::create(db_pool.clone(), rolling_stock_form)
            .await
            .unwrap();

        let rolling_stock_retrieved =
            LightRollingStock::retrieve(db_pool.clone(), rolling_stock.id)
                .await
                .unwrap();
        assert_eq!(rolling_stock_retrieved.rolling_stock.id, rolling_stock.id);

        RollingStock::delete(db_pool.clone(), rolling_stock.id)
            .await
            .unwrap();
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
