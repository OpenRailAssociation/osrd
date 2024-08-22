use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use itertools::Itertools;
#[cfg(test)]
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::modelsv2::rolling_stock_model::RollingStockModel;
use editoast_models::db_connection_pool::DbConnectionV2;
use editoast_models::tables::{project, rolling_stock, scenario_v2, study, train_schedule_v2};

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(test, derive(PartialEq, Eq, PartialOrd, Ord, Deserialize))]
pub struct ScenarioReference {
    pub project_id: i64,
    pub project_name: String,
    pub study_id: i64,
    pub study_name: String,
    pub scenario_id: i64,
    pub scenario_name: String,
}

impl From<SchedulesFromRollingStock> for ScenarioReference {
    fn from(value: SchedulesFromRollingStock) -> Self {
        let (project_id, project_name, study_id, study_name, scenario_id, scenario_name) = value;
        ScenarioReference {
            project_id,
            project_name,
            study_id,
            study_name,
            scenario_id,
            scenario_name,
        }
    }
}

type SchedulesFromRollingStock = (i64, String, i64, String, i64, String);

impl RollingStockModel {
    pub async fn get_usage(&self, conn: &mut DbConnectionV2) -> Result<Vec<ScenarioReference>> {
        let schedules: Vec<_> = train_schedule_v2::table
            .inner_join(
                rolling_stock::table
                    .on(train_schedule_v2::rolling_stock_name.eq(rolling_stock::name)),
            )
            .inner_join(
                (scenario_v2::table
                    .on(scenario_v2::timetable_id.eq(train_schedule_v2::timetable_id)))
                .inner_join(study::table.inner_join(project::table)),
            )
            .select((
                project::id,
                project::name,
                study::id,
                study::name,
                scenario_v2::id,
                scenario_v2::name,
            ))
            .filter(rolling_stock::id.eq(self.id))
            .filter(train_schedule_v2::id.is_not_null())
            .load::<SchedulesFromRollingStock>(conn)
            .await?;
        let schedules = schedules.into_iter().map_into().collect();
        Ok(schedules)
    }
}
