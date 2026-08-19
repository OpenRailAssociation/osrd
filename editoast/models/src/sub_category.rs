use sea_orm::ActiveValue::Set;
use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::rolling_stock::SubCategoryColor;
use crate::rolling_stock::TrainMainCategory;

#[derive(Clone, Debug, DeriveEntityModel, Eq, PartialEq, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "sub_categories")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub code: String,
    pub name: String,
    pub main_category: TrainMainCategory,
    pub color: SubCategoryColor,
    pub background_color: SubCategoryColor,
    pub hovered_color: SubCategoryColor,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::train_schedule::Entity")]
    TrainSchedule,
}

impl Related<super::train_schedule::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::TrainSchedule.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

impl From<Model> for schemas::rolling_stock::SubCategory {
    fn from(value: Model) -> Self {
        Self {
            code: value.code,
            name: value.name,
            main_category: value.main_category.into(),
            color: value.color.into(),
            background_color: value.background_color.into(),
            hovered_color: value.hovered_color.into(),
        }
    }
}

impl From<schemas::rolling_stock::SubCategory> for ActiveModel {
    fn from(value: schemas::rolling_stock::SubCategory) -> Self {
        Self {
            code: Set(value.code),
            name: Set(value.name),
            main_category: Set(value.main_category.into()),
            color: Set(value.color.into()),
            background_color: Set(value.background_color.into()),
            hovered_color: Set(value.hovered_color.into()),
            ..Default::default()
        }
    }
}

#[derive(Debug, thiserror::Error)]
#[cfg_attr(test, derive(PartialEq))]
pub enum Error {
    #[error("Sub category code already used: {code}")]
    CodeAlreadyUsed { code: String },
    #[error(transparent)]
    Database(crate::Error),
}

impl From<crate::Error> for Error {
    fn from(error: crate::Error) -> Self {
        if let Some(violation) = error.unique_violation()
            && violation.constraint == "sub_categories_code_key"
            && violation.column == "code"
        {
            return Self::CodeAlreadyUsed {
                code: violation.value,
            };
        }
        Self::Database(error)
    }
}

impl From<sea_orm::DbErr> for Error {
    fn from(error: sea_orm::DbErr) -> Self {
        Self::from(crate::Error::from(error))
    }
}

#[cfg(any(test, feature = "testing"))]
impl ActiveModel {
    pub fn fake(
        code: &str,
        name: &str,
        main_category: schemas::rolling_stock::TrainMainCategory,
    ) -> Self {
        Self {
            code: Set(code.to_owned()),
            name: Set(name.to_owned()),
            main_category: Set(main_category.into()),
            color: Set("#FF0000".to_owned().into()),
            background_color: Set("#00FF00".to_owned().into()),
            hovered_color: Set("#0000FF".to_owned().into()),
            ..Default::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sub_category;
    use database::Db;

    #[tokio::test(flavor = "multi_thread")]
    async fn unique_code() {
        let db = Db::for_tests().await;

        let _sub_category1 = sub_category::ActiveModel::fake(
            "code",
            "First Category",
            schemas::rolling_stock::TrainMainCategory::FreightTrain,
        )
        .insert(&db)
        .await
        .expect("Failed to create first sub category");

        let result = sub_category::ActiveModel::fake(
            "code",
            "Second Category",
            schemas::rolling_stock::TrainMainCategory::CommuterTrain,
        )
        .insert(&db)
        .await
        .map_err(Error::from);

        match result {
            Err(Error::CodeAlreadyUsed { code }) => {
                assert_eq!(code, "code");
            }
            other => panic!("Expected CodeAlreadyUsed error, got: {other:?}"),
        }
    }
}
