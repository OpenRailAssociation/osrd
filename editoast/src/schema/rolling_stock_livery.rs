use crate::diesel::{insert_into, QueryDsl, RunQueryDsl};
use crate::error::Result;
use crate::tables::osrd_infra_rollingstocklivery;
use crate::DbPool;
use actix_web::web::{block, Data};
use diesel::expression_methods::ExpressionMethods;
use diesel::result::Error as DieselError;
use editoast_derive::EditoastError;
use serde::Serialize;
use thiserror::Error;

use super::rolling_stock_image::RollingStockCompoundImage;

/// Rolling Stock Livery
///
/// A rolling stock can have several liveries, which are deleted on cascade if the rolling stock is removed.
/// It can have several liveries, and each livery can have one or several separated
/// images and one compound image (created by aggregating the seperated images together).
///
/// /!\ Its compound image is not deleted by cascade if the livery is removed.
#[derive(Debug, Identifiable, Queryable, Serialize)]
#[diesel(belongs_to(RollingStock, foreign_key = rolling_stock_id))]
#[diesel(table_name = osrd_infra_rollingstocklivery)]
pub struct RollingStockLivery {
    pub id: i64,
    name: String,
    pub rolling_stock_id: i64,
    pub compound_image_id: Option<i64>,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = osrd_infra_rollingstocklivery)]
pub struct RollingStockLiveryForm {
    pub name: String,
    pub rolling_stock_id: i64,
    pub compound_image_id: Option<i64>,
}

#[derive(Debug, Queryable, Selectable, Serialize)]
#[diesel(table_name = osrd_infra_rollingstocklivery)]
pub struct RollingStockLiveryMetadata {
    id: i64,
    name: String,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "rollingstockliveries")]
enum RollingStockLiveryError {
    #[error("Rolling stock livery '{livery_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { livery_id: i64 },
}

impl RollingStockLivery {
    /// Retrieve a rolling stock livery
    pub async fn retrieve(db_pool: Data<DbPool>, livery_id: i64) -> Result<RollingStockLivery> {
        block(move || {
            use crate::tables::osrd_infra_rollingstocklivery::dsl;
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match dsl::osrd_infra_rollingstocklivery
                .find(livery_id)
                .first(&mut conn)
            {
                Ok(livery) => Ok(livery),
                Err(DieselError::NotFound) => {
                    Err(RollingStockLiveryError::NotFound { livery_id }.into())
                }
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }

    /// Create a rolling stock livery
    pub async fn create(db_pool: Data<DbPool>, livery_form: RollingStockLiveryForm) -> Result<i64> {
        block(move || {
            use crate::tables::osrd_infra_rollingstocklivery::dsl;
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match insert_into(dsl::osrd_infra_rollingstocklivery)
                .values(&livery_form)
                .returning(dsl::id)
                .get_result(&mut conn)
            {
                Ok(livery_id) => Ok(livery_id),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }

    /// Delete a rolling stock livery and its compound image (if existing)
    pub async fn delete(db_pool: Data<DbPool>, livery_id: i64) -> Result<()> {
        let livery = RollingStockLivery::retrieve(db_pool.clone(), livery_id)
            .await
            .unwrap();

        if livery.compound_image_id.is_some() {
            RollingStockCompoundImage::delete(
                db_pool.clone(),
                livery_id,
                livery.compound_image_id.unwrap(),
            )
            .await
            .unwrap();
        }

        block(move || {
            use crate::tables::osrd_infra_rollingstocklivery::dsl;
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match diesel::delete(dsl::osrd_infra_rollingstocklivery.filter(dsl::id.eq(livery_id)))
                .execute(&mut conn)
            {
                Ok(1) => Ok(()),
                Ok(_) => Err(RollingStockLiveryError::NotFound { livery_id }.into()),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::{RollingStockLivery, RollingStockLiveryForm};
    use crate::client::PostgresConfig;
    use crate::models::RollingStock;
    use crate::models::{Create, Delete};
    use crate::schema::rolling_stock_image::RollingStockCompoundImage;
    use actix_http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;
    use std::io::Cursor;

    #[actix_test]
    async fn create_get_delete_rolling_stock_livery() {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        let img = image::open("src/tests/example_rolling_stock_image_1.gif").unwrap();
        let mut img_bytes: Vec<u8> = Vec::new();
        assert!(img
            .write_to(
                &mut Cursor::new(&mut img_bytes),
                image::ImageOutputFormat::Png
            )
            .is_ok());
        let image_id = RollingStockCompoundImage::create(db_pool.clone(), img_bytes)
            .await
            .unwrap();

        let mut rolling_stock: RollingStock =
            serde_json::from_str(include_str!("../tests/example_rolling_stock.json"))
                .expect("Unable to parse");
        rolling_stock.name = String::from("create_get_delete_rolling_stock_livery");
        let rolling_stock = rolling_stock.create(db_pool.clone()).await.unwrap();
        let rolling_stock_id = rolling_stock.id.unwrap();

        let livery_form = RollingStockLiveryForm {
            name: String::from("test_livery"),
            rolling_stock_id,
            compound_image_id: Some(image_id),
        };
        let livery_id = RollingStockLivery::create(db_pool.clone(), livery_form)
            .await
            .unwrap();

        assert!(RollingStockLivery::retrieve(db_pool.clone(), livery_id)
            .await
            .is_ok());
        assert!(
            RollingStockCompoundImage::retrieve(db_pool.clone(), livery_id, image_id)
                .await
                .is_ok()
        );

        assert!(RollingStockLivery::delete(db_pool.clone(), livery_id)
            .await
            .is_ok());
        assert_eq!(
            RollingStockLivery::retrieve(db_pool.clone(), livery_id)
                .await
                .unwrap_err()
                .get_status(),
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            RollingStockCompoundImage::retrieve(db_pool.clone(), livery_id, image_id)
                .await
                .unwrap_err()
                .get_status(),
            StatusCode::NOT_FOUND
        );

        assert!(RollingStock::delete(db_pool.clone(), rolling_stock_id)
            .await
            .is_ok());
    }
}
