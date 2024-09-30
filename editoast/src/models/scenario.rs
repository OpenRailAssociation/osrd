use std::ops::DerefMut;

use chrono::NaiveDateTime;
use chrono::Utc;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::models::prelude::*;
use crate::models::timetable::Timetable;
use crate::models::Tags;
use editoast_derive::Model;
use editoast_models::DbConnection;

#[derive(Debug, Clone, Model, Deserialize, Serialize, ToSchema)]
#[model(table = editoast_models::tables::scenario)]
#[model(gen(ops = crud, list))]
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
    pub async fn infra_name(&self, conn: &mut DbConnection) -> Result<String> {
        use editoast_models::tables::infra::dsl as infra_dsl;
        let infra_name = infra_dsl::infra
            .filter(infra_dsl::id.eq(self.infra_id))
            .select(infra_dsl::name)
            .first::<String>(conn.write().await.deref_mut())
            .await?;
        Ok(infra_name)
    }

    pub async fn trains_count(&self, conn: &mut DbConnection) -> Result<i64> {
        Timetable::trains_count(self.timetable_id, conn).await
    }

    pub async fn update_last_modified(&mut self, conn: &mut DbConnection) -> Result<()> {
        self.last_modification = Utc::now().naive_utc();
        self.save(conn).await?;
        Ok(())
    }
}
