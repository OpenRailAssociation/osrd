use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use strum::EnumString;
use strum::IntoStaticStr;
use utoipa::ToSchema;

// This enum maps to a Postgres enum type, specifically `train_category`.
// Any changes made to this enum must be reflected in the corresponding Postgres enum,
// and vice versa, to ensure consistency between the application and the database.
#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Serialize,
    Deserialize,
    ToSchema,
    EnumString,
    IntoStaticStr,
    Display,
)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TrainMainCategory {
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
pub struct TrainMainCategories(pub Vec<TrainMainCategory>);

impl From<Vec<Option<TrainMainCategory>>> for TrainMainCategories {
    fn from(categories: Vec<Option<TrainMainCategory>>) -> Self {
        Self(categories.into_iter().flatten().collect())
    }
}

impl From<TrainMainCategories> for Vec<Option<TrainMainCategory>> {
    fn from(categories: TrainMainCategories) -> Self {
        categories.0.into_iter().map(Some).collect()
    }
}
