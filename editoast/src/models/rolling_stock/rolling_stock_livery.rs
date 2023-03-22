use crate::diesel::{QueryDsl, RunQueryDsl};
use crate::error::Result;
use crate::models::Retrieve;
use crate::schema::rolling_stock::rolling_stock_livery::RollingStockLivery;
use crate::schema::rolling_stock_image::RollingStockCompoundImage;
use crate::tables::osrd_infra_rollingstocklivery;
use crate::views::rolling_stocks::RollingStockLiveryError;
use crate::DbPool;
use actix_web::web::{block, Data};
use diesel::expression_methods::ExpressionMethods;
use diesel::result::Error as DieselError;
use diesel::sql_types::{BigInt, Text};
use serde::{Deserialize, Serialize};

use editoast_derive::Model;

/// Rolling Stock Livery
///
/// A rolling stock can have several liveries, which are deleted on cascade if the rolling stock is removed.
/// It can have several liveries, and each livery can have one or several separated
/// images and one compound image (created by aggregating the seperated images together).
///
/// /!\ Its compound image is not deleted by cascade if the livery is removed.
#[derive(Debug, Identifiable, Insertable, Model, Queryable, Serialize)]
#[model(table = "osrd_infra_rollingstocklivery")]
#[model(create, retrieve)]
#[diesel(belongs_to(RollingStockModel, foreign_key = rolling_stock_id))]
#[diesel(table_name = osrd_infra_rollingstocklivery)]
pub struct RollingStockLiveryModel {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
    #[diesel(deserialize_as = i64)]
    pub rolling_stock_id: Option<i64>,
    #[diesel(deserialize_as = Option<i64>)]
    pub compound_image_id: Option<Option<i64>>,
}

// TODO: implement Delete Trait once RollingStockCompoundImage implements Model
impl RollingStockLiveryModel {
    /// Delete a rolling stock livery and its compound image (if existing)
    pub async fn delete(db_pool: Data<DbPool>, livery_id: i64) -> Result<()> {
        let livery: RollingStockLivery =
            match RollingStockLiveryModel::retrieve(db_pool.clone(), livery_id).await? {
                Some(livery) => livery.into(),
                None => return Err(RollingStockLiveryError::NotFound { livery_id }.into()),
            };

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

impl From<RollingStockLiveryModel> for RollingStockLivery {
    fn from(livery_model: RollingStockLiveryModel) -> Self {
        RollingStockLivery {
            id: livery_model.id.unwrap(),
            name: livery_model.name.unwrap(),
            rolling_stock_id: livery_model.rolling_stock_id.unwrap(),
            compound_image_id: livery_model.compound_image_id.unwrap(),
        }
    }
}

#[derive(Debug, Deserialize, Queryable, QueryableByName, Selectable, Serialize)]
#[diesel(table_name = osrd_infra_rollingstocklivery)]
pub struct RollingStockLiveryMetadata {
    #[diesel(sql_type = BigInt)]
    #[diesel(deserialize_as = i64)]
    id: i64,
    #[diesel(sql_type = Text)]
    #[diesel(deserialize_as = String)]
    name: String,
}

#[cfg(test)]
pub mod tests {
    use super::RollingStockLiveryModel;
    use crate::fixtures::tests::{db_pool, fast_rolling_stock, TestFixture};
    use crate::models::RollingStockModel;
    use crate::models::{Create, Retrieve};
    use crate::schema::rolling_stock_image::RollingStockCompoundImage;
    use actix_http::StatusCode;
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use rstest::*;
    use std::io::Cursor;

    pub fn get_rolling_stock_livery_example(
        rolling_stock_id: i64,
        image_id: i64,
    ) -> RollingStockLiveryModel {
        RollingStockLiveryModel {
            id: None,
            name: Some(String::from("test_livery")),
            rolling_stock_id: Some(rolling_stock_id),
            compound_image_id: Some(Some(image_id)),
        }
    }

    #[rstest]
    async fn create_get_delete_rolling_stock_livery(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] fast_rolling_stock: TestFixture<RollingStockModel>,
    ) {
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

        let rolling_stock = fast_rolling_stock.await;

        let livery = get_rolling_stock_livery_example(rolling_stock.id(), image_id);
        let livery = livery.create(db_pool.clone()).await.unwrap();
        let livery_id = livery.id.unwrap();

        assert!(
            RollingStockLiveryModel::retrieve(db_pool.clone(), livery_id)
                .await
                .is_ok()
        );
        assert!(
            RollingStockCompoundImage::retrieve(db_pool.clone(), livery_id, image_id)
                .await
                .is_ok()
        );

        assert!(RollingStockLiveryModel::delete(db_pool.clone(), livery_id)
            .await
            .is_ok());
        assert!(
            RollingStockLiveryModel::retrieve(db_pool.clone(), livery_id)
                .await
                .unwrap()
                .is_none(),
        );
        assert_eq!(
            RollingStockCompoundImage::retrieve(db_pool.clone(), livery_id, image_id)
                .await
                .unwrap_err()
                .get_status(),
            StatusCode::NOT_FOUND
        );
    }
}
