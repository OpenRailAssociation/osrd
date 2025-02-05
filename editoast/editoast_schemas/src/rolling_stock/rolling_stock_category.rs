use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use strum::EnumString;
use strum::IntoStaticStr;
use utoipa::ToSchema;

editoast_common::schemas! {
    RollingStockCategory,
    RollingStockCategories,
}

// This enum maps to a Postgres enum type, specifically `rolling_stock_category`.
// Any changes made to this enum must be reflected in the corresponding Postgres enum,
// and vice versa, to ensure consistency between the application and the database.
#[derive(
    Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema, EnumString, IntoStaticStr, Display,
)]
#[strum(serialize_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RollingStockCategory {
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
pub struct RollingStockCategories(pub Vec<RollingStockCategory>);

impl From<Vec<Option<RollingStockCategory>>> for RollingStockCategories {
    fn from(categories: Vec<Option<RollingStockCategory>>) -> Self {
        Self(categories.into_iter().flatten().collect())
    }
}

impl From<RollingStockCategories> for Vec<Option<RollingStockCategory>> {
    fn from(categories: RollingStockCategories) -> Self {
        categories.0.into_iter().map(Some).collect()
    }
}
