//! This module manage rolling stock images in the database.
//! You can add, retrieve and delete rolling stock images.
//!
//! A rolling stock can have several liveries, and each livery can have one or several separated
//! images and one compound image (created by aggregating the seperated images together).

use crate::diesel::{insert_into, QueryDsl, RunQueryDsl};
use crate::error::Result;
use crate::tables::osrd_infra_rollingstockimage;
use crate::DbPool;
use actix_web::web::{block, Data};
use diesel::expression_methods::ExpressionMethods;
use diesel::result::Error as DieselError;
use diesel::SelectableHelper;
use editoast_derive::EditoastError;
use serde::Serialize;
use thiserror::Error;

/// Rolling Stock Livery Compound Image
/// It is created by aggregating all the separated images together. Can be nullable.
///
/// /!\ It is not deleted by cascade if the livery is removed.
#[derive(Debug, Identifiable, Queryable, Selectable)]
#[diesel(table_name = osrd_infra_rollingstockimage)]
pub struct RollingStockCompoundImage {
    id: i64,
    image: Vec<u8>, // binary field
}

#[derive(Debug, Identifiable, Queryable, Serialize)]
#[diesel(belongs_to(RollingStockLivery, foreign_key = livery_id))]
#[diesel(table_name = osrd_infra_rollingstockimage)]
pub struct RollingStockSeparatedImage {
    id: i64,
    image: Vec<u8>, // binary field
    livery_id: i64,
    order: i64,
}

#[derive(Debug, Insertable)]
#[diesel(table_name = osrd_infra_rollingstockimage)]
struct RollingStockImageForm {
    image: Vec<u8>,
    order: Option<i64>,
    livery_id: Option<i64>,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "rollingstockliverycompoundimages")]
enum CompoundImageError {
    #[error("Compound image {image_id} of rolling stock livery '{livery_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { image_id: i64, livery_id: i64 },
    #[error("Image '{image_id}' of livery {livery_id} cannot be deleted. It is probably used.")]
    CanNotDelete { image_id: i64, livery_id: i64 },
}

impl RollingStockCompoundImage {
    /// Return the owned image
    pub fn inner_data(self) -> Vec<u8> {
        self.image
    }

    /// Return the compound image
    pub async fn retrieve(
        db_pool: Data<DbPool>,
        livery_id: i64,
        image_id: i64,
    ) -> Result<RollingStockCompoundImage> {
        use crate::tables::osrd_infra_rollingstockimage::dsl;
        block(move || {
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match dsl::osrd_infra_rollingstockimage
                .find(image_id)
                .select(RollingStockCompoundImage::as_select())
                .first(&mut conn)
            {
                Ok(livery) => Ok(livery),
                Err(DieselError::NotFound) => Err(CompoundImageError::NotFound {
                    image_id,
                    livery_id,
                }
                .into()),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }

    /// Create a compound image
    pub async fn create(db_pool: Data<DbPool>, image: Vec<u8>) -> Result<i64> {
        let form = RollingStockImageForm {
            image,
            order: None,
            livery_id: None,
        };
        block(move || {
            use crate::tables::osrd_infra_rollingstockimage::dsl;
            let mut conn = db_pool.get().expect("Failed to get DB connection");
            match insert_into(dsl::osrd_infra_rollingstockimage)
                .values(&form)
                .returning(dsl::id)
                .get_result(&mut conn)
            {
                Ok(image_id) => Ok(image_id),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }

    /// Delete a compound image and set the compound_image_id to null in its livery
    pub async fn delete(db_pool: Data<DbPool>, livery_id: i64, image_id: i64) -> Result<()> {
        block::<_, Result<()>>(move || {
            use crate::tables::osrd_infra_rollingstockimage::dsl;
            let mut conn = db_pool.get().expect("Failed to get DB connection");

            match diesel::delete(dsl::osrd_infra_rollingstockimage.filter(dsl::id.eq(image_id)))
                .execute(&mut conn)
            {
                Ok(1) => Ok(()),
                Ok(_) => Err(CompoundImageError::NotFound {
                    image_id,
                    livery_id,
                }
                .into()),
                Err(DieselError::DatabaseError { .. }) => Err(CompoundImageError::CanNotDelete {
                    image_id,
                    livery_id,
                }
                .into()),
                Err(e) => Err(e.into()),
            }
        })
        .await
        .unwrap()
    }
}

#[cfg(test)]
mod tests {
    use crate::client::PostgresConfig;
    use crate::models::rolling_stock_models::rolling_stock::tests::get_rolling_stock_example;
    use crate::models::RollingStockModel;
    use crate::models::{Create, Delete};
    use crate::schema::rolling_stock_image::RollingStockCompoundImage;
    use crate::schema::rolling_stock_livery::{RollingStockLivery, RollingStockLiveryForm};
    use actix_web::test as actix_test;
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;
    use std::io::Cursor;

    #[actix_test]
    async fn create_get_delete_rolling_stock_compound_image() {
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let db_pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        // create and set up
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

        let rolling_stock: RollingStockModel = get_rolling_stock_example(String::from(
            "create_get_delete_rolling_stock_compound_image",
        ));
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

        // get
        assert!(
            RollingStockCompoundImage::retrieve(db_pool.clone(), livery_id, image_id)
                .await
                .is_ok()
        );

        // delete: the livery should not be removed
        assert!(
            RollingStockCompoundImage::delete(db_pool.clone(), livery_id, image_id)
                .await
                .is_ok()
        );
        assert!(RollingStockLivery::retrieve(db_pool.clone(), livery_id)
            .await
            .is_ok());

        // clean
        assert!(RollingStockModel::delete(db_pool.clone(), rolling_stock_id)
            .await
            .is_ok());
    }
}
