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

impl TrainCategory {
    pub fn from_main_or_sub_category(
        main_category: Option<TrainMainCategory>,
        sub_category_code: Option<String>,
    ) -> Option<Self> {
        match (main_category, sub_category_code) {
            (Some(main_category), None) => Some(Self::Main { main_category }),
            (None, Some(sub_category_code)) => Some(Self::Sub { sub_category_code }),
            _ => None,
        }
    }
}
