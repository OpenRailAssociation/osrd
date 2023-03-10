use crate::diesel::{QueryDsl, RunQueryDsl};
use crate::error::Result;
use crate::tables::osrd_infra_rollingstock;
use crate::tables::osrd_infra_rollingstock::dsl;
use crate::DbPool;
use actix_web::web::{block, Data};
use diesel::expression_methods::ExpressionMethods;
use diesel::result::Error as DieselError;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use thiserror::Error;

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

#[derive(Debug, PartialEq, Queryable, Identifiable, Serialize)]
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

impl RollingStock {
    pub async fn retrieve(db_pool: Data<DbPool>, rolling_stock_id: i64) -> Result<RollingStock> {
        block::<_, Result<RollingStock>>(move || {
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match dsl::osrd_infra_rollingstock
                .find(rolling_stock_id)
                .first(&mut conn)
            {
                Ok(rolling_stock) => Ok(rolling_stock),
                Err(DieselError::NotFound) => {
                    Err(RollingStockError::NotFound { rolling_stock_id }.into())
                }
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }

    pub async fn create(
        db_pool: Data<DbPool>,
        rolling_stock_data: RollingStockForm,
    ) -> Result<RollingStock> {
        block::<_, Result<_>>(move || {
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match diesel::insert_into(dsl::osrd_infra_rollingstock)
                .values(&rolling_stock_data)
                .get_result::<RollingStock>(&mut conn)
            {
                Ok(rolling_stock) => Ok(rolling_stock),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }

    pub async fn delete(db_pool: Data<DbPool>, rolling_stock_id: i64) -> Result<()> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_rollingstock::dsl::*;
            let mut conn = db_pool.get().expect("Failed to get DB connection");
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

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "rollingstocks")]
enum RollingStockError {
    #[error("Rolling stock '{rolling_stock_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { rolling_stock_id: i64 },
}

#[cfg(test)]
mod tests {
    use super::{RollingStock, RollingStockForm};
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
        assert_eq!(rolling_stock_retrieved.id, rolling_stock.id);

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
}
