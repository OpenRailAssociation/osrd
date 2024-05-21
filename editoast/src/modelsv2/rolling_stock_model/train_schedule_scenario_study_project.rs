use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

editoast_common::schemas! {
    TrainScheduleScenarioStudyProject,
}

#[derive(Debug, QueryableByName, Serialize, Deserialize, PartialEq, ToSchema)]
pub struct TrainScheduleScenarioStudyProject {
    #[diesel(sql_type = BigInt)]
    pub train_schedule_id: i64,
    #[diesel(sql_type = Text)]
    pub train_name: String,
    #[diesel(sql_type = BigInt)]
    pub project_id: i64,
    #[diesel(sql_type = Text)]
    pub project_name: String,
    #[diesel(sql_type = BigInt)]
    pub study_id: i64,
    #[diesel(sql_type = Text)]
    pub study_name: String,
    #[diesel(sql_type = BigInt)]
    pub scenario_id: i64,
    #[diesel(sql_type = Text)]
    pub scenario_name: String,
}
