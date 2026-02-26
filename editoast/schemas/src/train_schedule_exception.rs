use serde::Deserialize;
use serde::Serialize;
use serde_with::serde_as;
use serde_with::skip_serializing_none;
use utoipa::ToSchema;

use crate::paced_train::ConstraintDistributionChangeGroup;
use crate::paced_train::InitialSpeedChangeGroup;
use crate::paced_train::LabelsChangeGroup;
use crate::paced_train::OptionsChangeGroup;
use crate::paced_train::PathAndScheduleChangeGroup;
use crate::paced_train::RollingStockCategoryChangeGroup;
use crate::paced_train::RollingStockChangeGroup;
use crate::paced_train::SpeedLimitTagChangeGroup;
use crate::paced_train::StartTimeChangeGroup;
use crate::paced_train::TrainNameChangeGroup;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct TrainScheduleException {
    pub id: i64,
    pub key: Option<String>,
    pub timetable_id: i64,
    pub train_schedule_id: i64,
    /// If None the exception is created, otherwise it is a modified exception
    pub occurrence_index: Option<i64>,
    pub disabled: bool,
    pub change_groups: TrainScheduleExceptionChangeGroups,
}

#[skip_serializing_none]
#[serde_as]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[cfg_attr(feature = "testing", derive(Default))]
pub struct TrainScheduleExceptionChangeGroups {
    #[schema(nullable = false)]
    pub train_name: Option<TrainNameChangeGroup>,
    #[schema(nullable = false)]
    pub rolling_stock: Option<RollingStockChangeGroup>,
    #[schema(nullable = false)]
    pub rolling_stock_category: Option<RollingStockCategoryChangeGroup>,
    #[schema(nullable = false)]
    pub labels: Option<LabelsChangeGroup>,
    #[schema(nullable = false)]
    pub speed_limit_tag: Option<SpeedLimitTagChangeGroup>,
    #[schema(nullable = false)]
    pub start_time: Option<StartTimeChangeGroup>,
    #[schema(nullable = false)]
    pub constraint_distribution: Option<ConstraintDistributionChangeGroup>,
    #[schema(nullable = false)]
    pub initial_speed: Option<InitialSpeedChangeGroup>,
    #[schema(nullable = false)]
    pub options: Option<OptionsChangeGroup>,
    #[schema(nullable = false)]
    pub path_and_schedule: Option<PathAndScheduleChangeGroup>,
}
