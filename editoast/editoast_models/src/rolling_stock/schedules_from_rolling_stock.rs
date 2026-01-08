use std::ops::DerefMut;

use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use itertools::Itertools;
use serde::Serialize;
use utoipa::ToSchema;

use database::DbConnection;
use database::tables::paced_train;
use database::tables::project;
use database::tables::rolling_stock;
use database::tables::scenario;
use database::tables::study;

use super::RollingStock;

#[derive(Debug, Serialize, ToSchema)]
#[cfg_attr(
    any(test, feature = "testing"),
    derive(PartialEq, Eq, PartialOrd, Ord, serde::Deserialize)
)]
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

impl RollingStock {
    pub async fn get_usage(
        &self,
        conn: &mut DbConnection,
    ) -> Result<Vec<ScenarioReference>, database::DatabaseError> {
        let schedules: Vec<_> = paced_train::table
            .inner_join(
                rolling_stock::table.on(paced_train::rolling_stock_name.eq(rolling_stock::name)),
            )
            .inner_join(
                (scenario::table.on(scenario::timetable_id.eq(paced_train::timetable_id)))
                    .inner_join(study::table.inner_join(project::table)),
            )
            .select((
                project::id,
                project::name,
                study::id,
                study::name,
                scenario::id,
                scenario::name,
            ))
            .filter(rolling_stock::id.eq(self.id))
            .filter(paced_train::id.is_not_null())
            .load::<SchedulesFromRollingStock>(conn.write().await.deref_mut())
            .await?;
        let schedules = schedules.into_iter().map_into().collect();
        Ok(schedules)
    }
}
