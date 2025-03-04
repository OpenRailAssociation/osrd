use crate::primitives::PositiveDuration;
use crate::train_schedule::TrainScheduleBase;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    PacedTrain,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct Paced {
    /// Duration of the paced train, an ISO 8601 format is expected
    #[schema(value_type = chrono::Duration, example = "PT2H")]
    pub duration: PositiveDuration,
    /// Time between two occurrences, an ISO 8601 format is expected
    #[schema(value_type = chrono::Duration, example = "PT15M")]
    pub step: PositiveDuration,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct PacedTrain {
    #[serde(flatten)]
    pub train_schedule_base: TrainScheduleBase,
    #[schema(inline)]
    pub paced: Paced,
}
