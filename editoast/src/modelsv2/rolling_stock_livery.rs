use crate::schema::rolling_stock::rolling_stock_livery::RollingStockLivery;
use crate::tables::rolling_stock_livery;
use derivative::Derivative;
use diesel::sql_types::{BigInt, Text};
use diesel_async::AsyncPgConnection;
use serde::{Deserialize, Serialize};

use crate::error::Result;
use editoast_derive::ModelV2;
use utoipa::ToSchema;

use super::Document;

/// Rolling Stock Livery
///
/// A rolling stock can have several liveries, which are deleted on cascade if the rolling stock is removed.
/// It can have several liveries, and each livery can have one or several separated
/// images and one compound image (created by aggregating the separated images together).
///
/// A livery has a compound_image_id field which refers to a document. The separated images of the livery also have
/// a image_id field which refers to a document.
///
/// /!\ Its compound image is not deleted by cascade if the livery is removed.
///
#[derive(Debug, Clone, Derivative, ModelV2)]
#[derivative(Default)]
#[model(table = crate::tables::rolling_stock_livery)]
pub struct RollingStockLiveryModel {
    pub id: i64,
    pub name: String,
    pub rolling_stock_id: i64,
    pub compound_image_id: Option<i64>,
}

impl From<RollingStockLiveryModel> for RollingStockLivery {
    fn from(livery_model: RollingStockLiveryModel) -> Self {
        RollingStockLivery {
            id: livery_model.id,
            name: livery_model.name,
            rolling_stock_id: livery_model.rolling_stock_id,
            compound_image_id: livery_model.compound_image_id,
        }
    }
}

impl RollingStockLiveryModel {
    pub async fn delete_with_compound_image(&self, conn: &mut AsyncPgConnection) -> Result<bool> {
        use crate::modelsv2::DeleteStatic;
        let livery = RollingStockLiveryModel::delete_static(conn, self.id).await?;
        if let Some(image_id) = self.compound_image_id {
            let doc_delete_result = Document::delete_static(conn, image_id).await?;
            return Ok(doc_delete_result);
        }
        Ok(livery)
    }
}

#[derive(Debug, Deserialize, Queryable, QueryableByName, Selectable, Serialize, ToSchema)]
#[diesel(table_name = rolling_stock_livery)]
pub struct RollingStockLiveryMetadataModel {
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
    use crate::fixtures::tests::{db_pool, rolling_stock_livery};
    use crate::modelsv2::Document;
    use actix_web::web::Data;
    use rstest::*;

    #[rstest]
    async fn create_get_delete_rolling_stock_livery(db_pool: Data<crate::DbPool>) {
        use crate::modelsv2::prelude::*;
        let mut conn = db_pool.get().await.unwrap();
        let rolling_stock_livery = rolling_stock_livery("", db_pool.clone()).await;
        let livery_id = rolling_stock_livery.rolling_stock_livery.id();
        let rolling_stock_livery = &rolling_stock_livery.rolling_stock_livery.model;
        let image_id = rolling_stock_livery.compound_image_id.unwrap();

        assert!(RollingStockLiveryModel::retrieve(&mut conn, livery_id)
            .await
            .is_ok());

        assert!(Document::retrieve(&mut conn, image_id).await.is_ok());

        assert!(rolling_stock_livery
            .delete_with_compound_image(&mut conn)
            .await
            .is_ok());

        assert!(RollingStockLiveryModel::retrieve(&mut conn, livery_id)
            .await
            .unwrap()
            .is_none());

        assert!(Document::retrieve(&mut conn, image_id)
            .await
            .unwrap()
            .is_none(),);
    }
}
