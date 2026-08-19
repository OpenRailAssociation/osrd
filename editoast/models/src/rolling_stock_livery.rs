use database::Db;
use sea_orm::EntityTrait as _;
use sea_orm::entity::prelude::*;
use utoipa::ToSchema;

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
#[derive(Clone, Debug, Default, DeriveEntityModel, Eq, PartialEq, ToSchema)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[sea_orm(table_name = "rolling_stock_livery")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique_key = "rolling_stock_livery_rolling_stock_id_name_key")]
    pub name: String,
    #[sea_orm(unique_key = "rolling_stock_livery_rolling_stock_id_name_key")]
    pub rolling_stock_id: i64,
    #[sea_orm(unique)]
    pub compound_image_id: Option<i64>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::document::Entity",
        from = "Column::CompoundImageId",
        to = "super::document::Column::Id",
        on_delete = "SetNull"
    )]
    Document,
    #[sea_orm(
        belongs_to = "super::rolling_stock::Entity",
        from = "Column::RollingStockId",
        to = "super::rolling_stock::Column::Id",
        on_delete = "Cascade"
    )]
    RollingStock,
    #[sea_orm(has_many = "super::rolling_stock_image::Entity")]
    RollingStockImage,
}

impl Related<super::document::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Document.def()
    }
}

impl Related<super::rolling_stock::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::RollingStock.def()
    }
}

impl Related<super::rolling_stock_image::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::RollingStockImage.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

impl From<Model> for schemas::rolling_stock::RollingStockLivery {
    fn from(model: Model) -> Self {
        Self {
            id: model.id,
            name: model.name,
            rolling_stock_id: model.rolling_stock_id,
            compound_image_id: model.compound_image_id,
        }
    }
}

impl Model {
    pub async fn delete_with_compound_image(&self, db: Db) -> Result<bool, crate::Error> {
        let livery_deleted = Entity::delete_by_id(self.id).exec(&db).await?.rows_affected > 0;
        let document_deleted = if let Some(image_id) = self.compound_image_id {
            super::document::Entity::delete_by_id(image_id)
                .exec(&db)
                .await?
                .rows_affected
                > 0
        } else {
            livery_deleted
        };
        Ok(document_deleted)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    use crate::document;
    use crate::rolling_stock;
    use crate::rolling_stock_livery;
    use database::Db;
    use sea_orm::Set;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn create_delete_rolling_stock_livery() {
        let db = Db::for_tests().await;

        let image = document::ActiveModel {
            content_type: Set("text/fake_data".into()),
            data: Set(vec![]),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create document");

        let rolling_stock = schemas::RollingStock::<
            schemas::rolling_stock::RollingResistancePerWeight,
        >::from(schemas::fixtures::simple_rolling_stock());
        let mut rolling_stock: rolling_stock::ActiveModel = rolling_stock.into();
        rolling_stock.name = Set("test_create_delete_rolling_stock_livery".into());
        let rs = rolling_stock
            .insert(&db)
            .await
            .expect("Failed to create rolling stock");

        let rs_livery = rolling_stock_livery::ActiveModel {
            name: Set("test_create_delete_rolling_stock_livery".into()),
            rolling_stock_id: Set(rs.id),
            compound_image_id: Set(Some(image.id)),
            ..Default::default()
        }
        .insert(&db)
        .await
        .expect("Failed to create rolling stock livery");

        assert!(Entity::find_by_id(rs_livery.id).one(&db).await.is_ok());

        assert!(
            crate::document::Entity::find_by_id(image.id)
                .one(&db)
                .await
                .is_ok()
        );

        let livery_id = rs_livery.id;
        assert!(
            rs_livery
                .delete_with_compound_image(db.clone())
                .await
                .is_ok()
        );

        assert!(
            Entity::find_by_id(livery_id)
                .one(&db)
                .await
                .expect("Failed to retrieve rolling stock livery")
                .is_none()
        );

        assert!(
            crate::document::Entity::find_by_id(image.id)
                .one(&db)
                .await
                .expect("Failed to retrieve document")
                .is_none()
        );
    }
}
