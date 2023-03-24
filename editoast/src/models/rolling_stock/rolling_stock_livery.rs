use crate::diesel::{delete, QueryDsl, RunQueryDsl};
use crate::error::Result;
use crate::models::{Delete, Document, Identifiable};
use crate::schema::rolling_stock::rolling_stock_livery::RollingStockLivery;
use crate::tables::osrd_infra_rollingstocklivery;
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
/// A livery has a compound_image_id field which refers to a document. The separated images of the livery also have
/// a image_id field which refers to a document.
///
/// /!\ Its compound image is not deleted by cascade if the livery is removed.
///
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

impl Identifiable for RollingStockLiveryModel {
    fn get_id(&self) -> i64 {
        self.id.expect("Id not found")
    }
}

impl Delete for RollingStockLiveryModel {
    fn delete_conn(conn: &mut diesel::PgConnection, livery_id: i64) -> Result<bool> {
        use crate::tables::osrd_infra_rollingstocklivery::dsl::*;
        // Delete livery
        let livery: RollingStockLivery =
            match delete(osrd_infra_rollingstocklivery.filter(id.eq(livery_id)))
                .get_result::<RollingStockLiveryModel>(conn)
            {
                Ok(livery) => livery.into(),
                Err(DieselError::NotFound) => return Ok(false),
                Err(err) => return Err(err.into()),
            };
        // Delete compound_image if any
        if let Some(image_id) = livery.compound_image_id {
            let _ = Document::delete_conn(conn, image_id);
        };
        Ok(true)
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
    #[diesel(sql_type = BigInt)]
    #[diesel(deserialize_as = Option<i64>)]
    compound_image_id: Option<i64>,
}

#[cfg(test)]
pub mod tests {
    use super::RollingStockLiveryModel;
    use crate::fixtures::tests::{db_pool, rolling_stock_livery, TestFixture};
    use crate::models::{Delete, Document, Retrieve};
    use actix_web::web::Data;
    use diesel::r2d2::{ConnectionManager, Pool};
    use rstest::*;

    #[rstest]
    async fn create_get_delete_rolling_stock_livery(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] rolling_stock_livery: TestFixture<RollingStockLiveryModel>,
    ) {
        let rolling_stock_livery = rolling_stock_livery.await;
        let livery_id = rolling_stock_livery.id();
        let image_id = rolling_stock_livery
            .model
            .compound_image_id
            .unwrap()
            .unwrap();

        assert!(
            RollingStockLiveryModel::retrieve(db_pool.clone(), livery_id)
                .await
                .is_ok()
        );
        assert!(Document::retrieve(db_pool.clone(), image_id).await.is_ok());

        // delete RollingStockLivery
        assert!(RollingStockLiveryModel::delete(db_pool.clone(), livery_id)
            .await
            .is_ok());

        assert!(
            RollingStockLiveryModel::retrieve(db_pool.clone(), livery_id)
                .await
                .unwrap()
                .is_none(),
        );
        assert!(Document::retrieve(db_pool.clone(), image_id)
            .await
            .unwrap()
            .is_none(),);
    }
}
