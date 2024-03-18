use crate::error::Result;
use crate::models::List;
use crate::modelsv2::{Model, Ordering, Row, Tags};
use crate::views::pagination::{Paginate, PaginatedResponse};
use async_trait::async_trait;
use chrono::NaiveDateTime;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Text};
use diesel::{ExpressionMethods, QueryDsl};
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use editoast_derive::ModelV2;
use serde_derive::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, ModelV2, Deserialize, Serialize, ToSchema)]
#[schema(as = ScenarioV2)]
#[model(table = crate::tables::scenario_v2)]
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
}

#[derive(Debug, Clone, QueryableByName, Deserialize, Serialize, ToSchema)]
#[schema(as = ScenarioWithDetailsV2)]
#[diesel(table_name = scenario_v2)]
pub struct ScenarioWithDetails {
    #[diesel(embed)]
    #[serde(flatten)]
    #[schema(value_type = ScenarioV2)]
    pub scenario: Scenario,
    #[diesel(sql_type = Text)]
    pub infra_name: String,
    #[diesel(sql_type = BigInt)]
    pub trains_count: i64,
}

#[derive(QueryableByName)]
#[diesel(table_name = scenario_v2)]
pub struct ScenarioWithDetailsRow {
    #[diesel(embed)]
    pub scenario: ScenarioRow,
    #[diesel(sql_type = Text)]
    pub infra_name: String,
    #[diesel(sql_type = BigInt)]
    pub trains_count: i64,
}

impl From<ScenarioWithDetailsRow> for ScenarioWithDetails {
    fn from(row: ScenarioWithDetailsRow) -> Self {
        Self {
            scenario: row.scenario.into(),
            infra_name: row.infra_name,
            trains_count: row.trains_count,
        }
    }
}

impl ScenarioWithDetails {
    pub async fn from_scenario(scenario: Scenario, conn: &mut PgConnection) -> Result<Self> {
        Ok(Self {
            infra_name: scenario.infra_name(conn).await?,
            trains_count: scenario.trains_count(conn).await?,
            scenario,
        })
    }
}

impl Scenario {
    pub async fn infra_name(&self, conn: &mut PgConnection) -> Result<String> {
        use crate::tables::infra::dsl as infra_dsl;
        let infra_name = infra_dsl::infra
            .filter(infra_dsl::id.eq(self.infra_id))
            .select(infra_dsl::name)
            .first::<String>(conn)
            .await?;
        Ok(infra_name)
    }

    pub async fn trains_count(&self, conn: &mut PgConnection) -> Result<i64> {
        use crate::tables::train_schedule_v2::dsl::*;
        let trains_count = train_schedule_v2
            .filter(timetable_id.eq(self.timetable_id))
            .count()
            .get_result(conn)
            .await?;
        Ok(trains_count)
    }
}

#[async_trait]
impl List<(i64, Ordering)> for ScenarioWithDetails {
    /// List all scenarios with the number of trains and infra name.
    async fn list_conn(
        conn: &mut PgConnection,
        page: i64,
        page_size: i64,
        params: (i64, Ordering),
    ) -> Result<PaginatedResponse<Self>> {
        let study_id = params.0;
        let ordering = params.1.to_sql();

        let scenario_rows = sql_query(format!(
            r#"
            SELECT 
                scenario_v2.*, 
                infra.name AS infra_name, 
                COUNT(train_schedule_v2.id) AS trains_count
            FROM scenario_v2
                LEFT JOIN infra ON infra.id = scenario_v2.infra_id
                LEFT JOIN train_schedule_v2 ON train_schedule_v2.timetable_id = scenario_v2.timetable_id
            WHERE scenario_v2.study_id = $1
            GROUP BY scenario_v2.id, infra.name
            ORDER BY {ordering}
            "#
        ))
        .bind::<BigInt, _>(study_id)
        .paginate(page, page_size)
        .load_and_count::<ScenarioWithDetailsRow>(conn)
        .await?;

        let results: Vec<ScenarioWithDetails> = scenario_rows
            .results
            .into_iter()
            .map(|s| s.into())
            .collect();
        Ok(PaginatedResponse {
            count: scenario_rows.count,
            previous: scenario_rows.previous,
            next: scenario_rows.next,
            results,
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
