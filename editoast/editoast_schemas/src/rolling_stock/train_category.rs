use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use strum::EnumString;
use strum::IntoStaticStr;
use utoipa::ToSchema;

editoast_common::schemas! {
    TrainCategory,
    TrainCategories,
}

// This enum maps to a Postgres enum type, specifically `rolling_stock_category`.
// Any changes made to this enum must be reflected in the corresponding Postgres enum,
// and vice versa, to ensure consistency between the application and the database.
#[derive(
    Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema, EnumString, IntoStaticStr, Display,
)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TrainCategory {
    HighSpeedTrain,
    IntercityTrain,
    RegionalTrain,
    NightTrain,
    CommuterTrain,
    FreightTrain,
    FastFreightTrain,
    TramTrain,
    TouristicTrain,
    WorkTrain,
}

#[derive(Clone, Debug, PartialEq, Deserialize, Serialize, ToSchema)]
pub struct TrainCategories(pub Vec<TrainCategory>);

impl From<Vec<Option<TrainCategory>>> for TrainCategories {
    fn from(categories: Vec<Option<TrainCategory>>) -> Self {
        Self(categories.into_iter().flatten().collect())
    }
}

impl From<TrainCategories> for Vec<Option<TrainCategory>> {
    fn from(categories: TrainCategories) -> Self {
        categories.0.into_iter().map(Some).collect()
    }
}
