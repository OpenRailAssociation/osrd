use database::Db;
use sea_orm::ActiveModelTrait as _;
use sea_orm::ActiveValue::Set;
use sea_orm::ColumnTrait as _;
use sea_orm::EntityTrait as _;
use sea_orm::QueryFilter as _;
use sea_orm::TransactionTrait as _;
use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(
    Clone, Debug, DeriveEntityModel, Eq, Hash, PartialEq, Deserialize, Serialize, ToSchema,
)]
#[sea_orm(table_name = "authn_group")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(column_type = "Text", unique)]
    pub name: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

impl Model {
    #[tracing::instrument(skip(db), fields(%name), ret(level = "debug"), err)]
    pub async fn upsert(db: Db, name: String) -> Result<Self, crate::Error> {
        db.transaction::<_, _, crate::Error>(move |txn| {
            Box::pin(async move {
                let group = match Entity::find()
                    .filter(Column::Name.eq(&name))
                    .one(txn)
                    .await?
                {
                    Some(group) => group,
                    None => {
                        ActiveModel {
                            name: Set(name),
                            ..Default::default()
                        }
                        .insert(txn)
                        .await?
                    }
                };
                Ok(group)
            })
        })
        .await
        .map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::authn::group;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn group_upsert() {
        let db = Db::for_tests().await;

        let created = group::Model::upsert(db.clone(), "tom and jerry".to_string())
            .await
            .expect("failed to insert group");
        assert_eq!(created.name, "tom and jerry");

        let updated = group::Model::upsert(db, "tom and jerry".to_string())
            .await
            .expect("failed to upsert existing group");
        assert_eq!(updated, created);
    }
}
