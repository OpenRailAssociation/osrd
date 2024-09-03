use std::ops::DerefMut;

use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel_async::RunQueryDsl;
use editoast_models::DbConnection;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::RollingStockModel;
use crate::error::Result;

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

impl RollingStockModel {
    pub async fn get_rolling_stock_usage(
        &self,
        conn: &DbConnection,
    ) -> Result<Vec<TrainScheduleScenarioStudyProject>> {
        let result = sql_query(include_str!("sql/get_train_schedules_with_scenario.sql"))
            .bind::<BigInt, _>(self.id)
            .load::<TrainScheduleScenarioStudyProject>(conn.write().await.deref_mut())
            .await?;
        Ok(result)
    }
}
