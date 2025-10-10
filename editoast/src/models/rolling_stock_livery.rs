use database::DbConnection;
use editoast_derive::Model;
use editoast_models::Document;
use editoast_models::prelude::*;
use utoipa::ToSchema;

#[cfg(test)]
use serde::Deserialize;

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
#[derive(Debug, Clone, Default, Model, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
#[model(table = database::tables::rolling_stock_livery)]
#[model(gen(ops = crd, list))]
pub struct RollingStockLivery {
    pub id: i64,
    pub name: String,
    pub rolling_stock_id: i64,
    pub compound_image_id: Option<i64>,
}

impl From<RollingStockLivery> for schemas::rolling_stock::RollingStockLivery {
    fn from(livery_model: RollingStockLivery) -> Self {
        Self {
            id: livery_model.id,
            name: livery_model.name,
            rolling_stock_id: livery_model.rolling_stock_id,
            compound_image_id: livery_model.compound_image_id,
        }
    }
}

impl RollingStockLivery {
    pub async fn delete_with_compound_image(
        &self,
        conn: &mut DbConnection,
    ) -> Result<bool, editoast_models::Error> {
        let livery = RollingStockLivery::delete_static(conn, self.id).await?;
        if let Some(image_id) = self.compound_image_id {
            let doc_delete_result = Document::delete_static(conn, image_id).await?;
            return Ok(doc_delete_result);
        }
        Ok(livery)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    use database::DbConnectionPoolV2;

    use crate::models::fixtures::create_rolling_stock_livery_fixture;
    use editoast_models::Document;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_delete_rolling_stock_livery() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let (rs_livery, _, image) =
            create_rolling_stock_livery_fixture(&mut db_pool.get_ok(), "rs_livery_name").await;

        assert!(
            RollingStockLivery::retrieve(db_pool.get_ok(), rs_livery.id)
                .await
                .is_ok()
        );

        assert!(Document::retrieve(db_pool.get_ok(), image.id).await.is_ok());

        assert!(
            rs_livery
                .delete_with_compound_image(&mut db_pool.get_ok())
                .await
                .is_ok()
        );

        assert!(
            RollingStockLivery::retrieve(db_pool.get_ok(), rs_livery.id)
                .await
                .expect("Failed to retrieve rolling stock livery")
                .is_none()
        );

        assert!(
            Document::retrieve(db_pool.get_ok(), image.id)
                .await
                .expect("Failed to retrieve document")
                .is_none()
        );
    }
}
