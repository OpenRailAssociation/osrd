use crate::rolling_stock::TrainMainCategory;
use editoast_derive::Model;
use schemas::rolling_stock::SubCategoryColor;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate as editoast_models;
use crate::prelude::*; // HACK: remove after all models are in this crate

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Model, ToSchema)]
#[model(table = database::tables::sub_categories)]
#[model(error(create = Error, update = Error))]
#[model(gen(ops = crud, batch_ops = crd, list))]
pub struct SubCategory {
    pub id: i64,
    #[model(identifier)]
    pub code: String,
    pub name: String,
    pub main_category: TrainMainCategory,
    #[model(remote = "String")]
    pub color: SubCategoryColor,
    #[model(remote = "String")]
    pub background_color: SubCategoryColor,
    #[model(remote = "String")]
    pub hovered_color: SubCategoryColor,
}

impl From<SubCategory> for schemas::rolling_stock::SubCategory {
    fn from(value: SubCategory) -> Self {
        Self {
            code: value.code,
            name: value.name,
            main_category: value.main_category.0,
            color: value.color,
            background_color: value.background_color,
            hovered_color: value.hovered_color,
        }
    }
}

impl From<schemas::rolling_stock::SubCategory> for SubCategoryChangeset {
    fn from(sub_category: schemas::rolling_stock::SubCategory) -> Self {
        SubCategory::changeset()
            .code(sub_category.code)
            .name(sub_category.name)
            .main_category(TrainMainCategory(sub_category.main_category))
            .color(sub_category.color)
            .background_color(sub_category.background_color)
            .hovered_color(sub_category.hovered_color)
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
    fn from(e: crate::Error) -> Self {
        match e {
            crate::Error::UniqueViolation {
                constraint,
                column,
                value,
            } if constraint == "sub_categories_code_key" && column == "code" => {
                Self::CodeAlreadyUsed { code: value }
            }
            e => Self::Database(e),
        }
    }
}
