#![allow(clippy::enum_variant_names)]

use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[allow(clippy::enum_variant_names)]
#[derive(
    Clone, Copy, Debug, Deserialize, DeriveActiveEnum, EnumIter, Eq, PartialEq, Serialize, ToSchema,
)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sea_orm(rs_type = "Enum", db_type = "Enum", enum_name = "train_main_category")]
pub enum TrainMainCategory {
    #[sea_orm(string_value = "HIGH_SPEED_TRAIN")]
    HighSpeedTrain,
    #[sea_orm(string_value = "INTERCITY_TRAIN")]
    IntercityTrain,
    #[sea_orm(string_value = "REGIONAL_TRAIN")]
    RegionalTrain,
    #[sea_orm(string_value = "NIGHT_TRAIN")]
    NightTrain,
    #[sea_orm(string_value = "COMMUTER_TRAIN")]
    CommuterTrain,
    #[sea_orm(string_value = "FREIGHT_TRAIN")]
    FreightTrain,
    #[sea_orm(string_value = "FAST_FREIGHT_TRAIN")]
    FastFreightTrain,
    #[sea_orm(string_value = "TRAM_TRAIN")]
    TramTrain,
    #[sea_orm(string_value = "TOURISTIC_TRAIN")]
    TouristicTrain,
    #[sea_orm(string_value = "WORK_TRAIN")]
    WorkTrain,
}

impl From<schemas::rolling_stock::TrainMainCategory> for TrainMainCategory {
    fn from(value: schemas::rolling_stock::TrainMainCategory) -> Self {
        match value {
            schemas::rolling_stock::TrainMainCategory::HighSpeedTrain => Self::HighSpeedTrain,
            schemas::rolling_stock::TrainMainCategory::IntercityTrain => Self::IntercityTrain,
            schemas::rolling_stock::TrainMainCategory::RegionalTrain => Self::RegionalTrain,
            schemas::rolling_stock::TrainMainCategory::NightTrain => Self::NightTrain,
            schemas::rolling_stock::TrainMainCategory::CommuterTrain => Self::CommuterTrain,
            schemas::rolling_stock::TrainMainCategory::FreightTrain => Self::FreightTrain,
            schemas::rolling_stock::TrainMainCategory::FastFreightTrain => Self::FastFreightTrain,
            schemas::rolling_stock::TrainMainCategory::TramTrain => Self::TramTrain,
            schemas::rolling_stock::TrainMainCategory::TouristicTrain => Self::TouristicTrain,
            schemas::rolling_stock::TrainMainCategory::WorkTrain => Self::WorkTrain,
        }
    }
}

impl From<TrainMainCategory> for schemas::rolling_stock::TrainMainCategory {
    fn from(value: TrainMainCategory) -> Self {
        match value {
            TrainMainCategory::HighSpeedTrain => Self::HighSpeedTrain,
            TrainMainCategory::IntercityTrain => Self::IntercityTrain,
            TrainMainCategory::RegionalTrain => Self::RegionalTrain,
            TrainMainCategory::NightTrain => Self::NightTrain,
            TrainMainCategory::CommuterTrain => Self::CommuterTrain,
            TrainMainCategory::FreightTrain => Self::FreightTrain,
            TrainMainCategory::FastFreightTrain => Self::FastFreightTrain,
            TrainMainCategory::TramTrain => Self::TramTrain,
            TrainMainCategory::TouristicTrain => Self::TouristicTrain,
            TrainMainCategory::WorkTrain => Self::WorkTrain,
        }
    }
}
