use std::ops::DerefMut;

use chrono::NaiveDateTime;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use editoast_derive::ModelV2;
use editoast_models::DbConnection;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::modelsv2::Tags;

#[derive(Debug, Clone, ModelV2, Deserialize, Serialize, ToSchema)]
#[schema(as = ScenarioV2)]
#[model(table = editoast_models::tables::scenario_v2)]
#[cfg_attr(test, derive(PartialEq))]
pub struct Scenario {
    pub id: i64,
    pub infra_id: i64,
    pub name: String,
    pub description: String,
    pub creation_date: NaiveDateTime,
    pub last_modification: NaiveDateTime,
    #[model(remote = "Vec<Option<String>>")]
    pub tags: Tags,
    pub timetable_id: i64,
    pub study_id: i64,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub electrical_profile_set_id: Option<i64>,
}

impl Scenario {
    pub async fn infra_name(&self, conn: &DbConnection) -> Result<String> {
        use editoast_models::tables::infra::dsl as infra_dsl;
        let infra_name = infra_dsl::infra
            .filter(infra_dsl::id.eq(self.infra_id))
            .select(infra_dsl::name)
            .first::<String>(conn.write().await.deref_mut())
            .await?;
        Ok(infra_name)
    }

    pub async fn trains_count(&self, conn: &DbConnection) -> Result<i64> {
        use editoast_models::tables::train_schedule_v2::dsl::*;
        let trains_count = train_schedule_v2
            .filter(timetable_id.eq(self.timetable_id))
            .count()
            .get_result(conn.write().await.deref_mut())
            .await?;
        Ok(trains_count)
    }
}
