use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::rolling_stock::TrainMainCategory;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(untagged)]
pub enum TrainCategory {
    Main { main_category: TrainMainCategory },
    Sub { sub_category_code: String },
}

impl TrainCategory {
    pub fn main(main_category: TrainMainCategory) -> Self {
        Self::Main { main_category }
    }

    pub fn sub(sub_category_code: String) -> Self {
        Self::Sub { sub_category_code }
    }

    pub fn as_main(&self) -> Option<&TrainMainCategory> {
        match self {
            Self::Main { main_category } => Some(main_category),
            _ => None,
        }
    }

    pub fn as_sub(&self) -> Option<&str> {
        match self {
            Self::Sub { sub_category_code } => Some(sub_category_code),
            _ => None,
        }
    }

    pub fn into_main(self) -> Option<TrainMainCategory> {
        match self {
            Self::Main { main_category } => Some(main_category),
            _ => None,
        }
    }

    pub fn into_sub(self) -> Option<String> {
        match self {
            Self::Sub { sub_category_code } => Some(sub_category_code),
            _ => None,
        }
    }
}
