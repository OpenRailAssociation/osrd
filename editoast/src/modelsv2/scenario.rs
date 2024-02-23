use crate::error::Result;
use crate::models::List;
use crate::modelsv2::Ordering;
use crate::modelsv2::Model;
use crate::modelsv2::Row;
use crate::views::pagination::Paginate;
use crate::views::pagination::PaginatedResponse;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Text};
use diesel::{ExpressionMethods, QueryDsl};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use editoast_derive::ModelV2;
use serde_derive::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, ModelV2, Deserialize, Serialize)]
#[model(table = crate::tables::scenario_v2)]
#[model(changeset(public))]
pub struct Scenario {
    pub id: i64,
    pub infra_id: i64,
    pub name: String,
    pub description: String,
    pub creation_date: NaiveDateTime,
    pub last_modification: NaiveDateTime,
    pub tags: Vec<Option<String>>,
    pub timetable_id: i64,
    pub study_id: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize, QueryableByName, ToSchema)]
pub struct ScenarioWithDetails {
    #[serde(flatten)]
    #[diesel(embed)]
    pub scenario: Scenario,
    #[diesel(sql_type = Text)]
    pub infra_name: String,
    #[diesel(sql_type = BigInt)]
    pub trains_count: i64,
}

impl Scenario {
    pub async fn with_details_conn(self, conn: &mut PgConnection) -> Result<ScenarioWithDetails> {
        use crate::tables::infra::dsl as infra_dsl;
        use crate::tables::train_schedule_v2::dsl::*;

        let infra_name = infra_dsl::infra
            .filter(infra_dsl::id.eq(self.infra_id))
            .select(infra_dsl::name)
            .first::<String>(conn)
            .await?;

        let trains_count = train_schedule_v2
            .filter(timetable_id.eq(self.timetable_id))
            .count()
            .get_result(conn)
            .await?;

        Ok(ScenarioWithDetails {
            scenario: self,
            infra_name,
            trains_count,
        })
    }
}

#[async_trait]
impl List<(i64, Ordering)> for Scenario {
    /// List all scenarios with the number of trains.
    /// This functions takes a study_id to filter scenarios.
    async fn list_conn(
        conn: &mut PgConnection,
        page: i64,
        page_size: i64,
        params: (i64, Ordering),
    ) -> Result<PaginatedResponse<Self>> {
        let study_id = params.0;
        let ordering = params.1.to_sql();
        let scenario_rows = sql_query(format!(
            "SELECT t.* FROM scenario_v2 as t WHERE t.study_id = $1 ORDER BY {ordering}"
        ))
        .bind::<BigInt, _>(study_id)
        .paginate(page, page_size)
        .load_and_count::<Row<Scenario>>(conn)
        .await?;

        let results: Vec<Scenario> = scenario_rows
            .results
            .into_iter()
            .map(Self::from_row)
            .collect();
        Ok(PaginatedResponse {
            count: scenario_rows.count,
            previous: scenario_rows.previous,
            next: scenario_rows.next,
            results,
        })
    }
}
