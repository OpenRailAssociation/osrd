use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::rolling_stock::TrainMainCategory;

editoast_common::schemas! {
    TrainCategory,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(untagged)]
pub enum TrainCategory {
    Main { main_category: TrainMainCategory },
    Sub { sub_category_code: String },
}

impl From<TrainMainCategory> for TrainCategory {
    fn from(main_category: TrainMainCategory) -> Self {
        Self::Main { main_category }
    }
}

impl From<String> for TrainCategory {
    fn from(sub_category_code: String) -> Self {
        Self::Sub { sub_category_code }
    }
}
