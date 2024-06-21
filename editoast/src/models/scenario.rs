use async_trait::async_trait;
use chrono::NaiveDateTime;
use chrono::Utc;
use derivative::Derivative;
use diesel::delete;
use diesel::result::Error as DieselError;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
use diesel::sql_types::Nullable;
use diesel::sql_types::Text;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use std::sync::Arc;
use utoipa::ToSchema;

use super::List;
use crate::error::Result;
use crate::models::train_schedule::LightTrainSchedule;
use crate::models::Delete;
use crate::models::TextArray;
use crate::tables::scenario;
use crate::views::operational_studies::Ordering;
use crate::views::pagination::Paginate;
use crate::views::pagination::PaginatedResponse;
use editoast_models::DbConnection;
use editoast_models::DbConnectionPool;

#[derive(
    Clone,
    Debug,
    Serialize,
    Deserialize,
    Insertable,
    Derivative,
    Queryable,
    QueryableByName,
    AsChangeset,
    Identifiable,
    Model,
    ToSchema,
)]
#[derivative(Default)]
#[model(table = "scenario")]
#[model(create, retrieve, update)]
#[diesel(table_name = scenario)]
#[serde(deny_unknown_fields)]
pub struct Scenario {
    #[diesel(deserialize_as = i64)]
    #[schema(value_type = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    #[schema(value_type = String)]
    pub name: Option<String>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    #[schema(value_type = String)]
    pub description: Option<String>,
    #[diesel(deserialize_as = NaiveDateTime)]
    #[schema(value_type = NaiveDateTime)]
    pub creation_date: Option<NaiveDateTime>,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub last_modification: NaiveDateTime,
    #[diesel(deserialize_as = TextArray)]
    #[derivative(Default(value = "Some(Vec::new())"))]
    #[schema(value_type = Vec<String>)]
    pub tags: Option<Vec<String>>,
    #[diesel(deserialize_as = i64)]
    #[schema(value_type = i64)]
    pub infra_id: Option<i64>,
    #[diesel(deserialize_as = i64)]
    #[schema(value_type = i64)]
    pub timetable_id: Option<i64>,
    #[diesel(deserialize_as = i64)]
    #[schema(value_type = i64)]
    pub study_id: Option<i64>,
    #[diesel(deserialize_as = Option<i64>)]
    #[schema(value_type = Option<i64>)]
    pub electrical_profile_set_id: Option<Option<i64>>,
}

impl crate::models::Identifiable for Scenario {
    fn get_id(&self) -> i64 {
        self.id.expect("Scenario id not found")
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, QueryableByName, ToSchema)]
pub struct ScenarioWithDetails {
    #[serde(flatten)]
    #[diesel(embed)]
    pub scenario: Scenario,
    #[diesel(sql_type = Text)]
    pub infra_name: String,
    #[diesel(sql_type = Nullable<Text>)]
    pub electrical_profile_set_name: Option<String>,
    #[diesel(sql_type = Array<LightTrainSchedule>)]
    pub train_schedules: Vec<LightTrainSchedule>,
    #[diesel(sql_type = BigInt)]
    pub trains_count: i64,
}

#[derive(Debug, Clone, Serialize, QueryableByName, ToSchema)]
pub struct ScenarioWithCountTrains {
    #[serde(flatten)]
    #[diesel(embed)]
    pub scenario: Scenario,
    #[diesel(sql_type = BigInt)]
    pub trains_count: i64,
    #[diesel(sql_type = Text)]
    pub infra_name: String,
}

impl Scenario {
    pub async fn with_details(self, db_pool: Arc<DbConnectionPool>) -> Result<ScenarioWithDetails> {
        let mut conn = db_pool.get().await?;
        self.with_details_conn(&mut conn).await
    }

    pub async fn with_details_conn(self, conn: &mut DbConnection) -> Result<ScenarioWithDetails> {
        use crate::tables::electrical_profile_set::dsl as elec_dsl;
        use crate::tables::infra::dsl as infra_dsl;
        use crate::tables::train_schedule::dsl::*;

        let infra_name = infra_dsl::infra
            .filter(infra_dsl::id.eq(self.infra_id.unwrap()))
            .select(infra_dsl::name)
            .first::<String>(conn)
            .await?;

        let electrical_profile_set_name = match self.electrical_profile_set_id.unwrap() {
            Some(electrical_profile_set) => Some(
                elec_dsl::electrical_profile_set
                    .filter(elec_dsl::id.eq(electrical_profile_set))
                    .select(elec_dsl::name)
                    .first::<String>(conn)
                    .await?,
            ),
            None => None,
        };

        let train_schedules = train_schedule
            .filter(timetable_id.eq(self.timetable_id.unwrap()))
            .select((id, train_name, departure_time, path_id))
            .load::<LightTrainSchedule>(conn)
            .await?;

        let trains_count = train_schedules.len() as i64;

        Ok(ScenarioWithDetails {
            scenario: self,
            infra_name,
            electrical_profile_set_name,
            train_schedules,
            trains_count,
        })
    }
}

/// Delete a scenario.
/// When we delete a scenario, the associated timetable is deleted too.
#[async_trait]
impl Delete for Scenario {
    async fn delete_conn(conn: &mut DbConnection, scenario_id: i64) -> Result<bool> {
        use crate::tables::scenario::dsl as scenario_dsl;
        use crate::tables::timetable::dsl as timetable_dsl;

        // Delete scenario
        let scenario = match delete(scenario_dsl::scenario.filter(scenario_dsl::id.eq(scenario_id)))
            .get_result::<Scenario>(conn)
            .await
        {
            Ok(scenario) => scenario,
            Err(DieselError::NotFound) => return Ok(false),
            Err(err) => return Err(err.into()),
        };

        // Delete timetable
        delete(
            timetable_dsl::timetable.filter(timetable_dsl::id.eq(scenario.timetable_id.unwrap())),
        )
        .execute(conn)
        .await?;
        Ok(true)
    }
}

#[async_trait]
impl List<(i64, Ordering)> for ScenarioWithCountTrains {
    /// List all scenarios with the number of trains.
    /// This functions takes a study_id to filter scenarios.
    async fn list_conn(
        conn: &mut DbConnection,
        page: i64,
        page_size: i64,
        params: (i64, Ordering),
    ) -> Result<PaginatedResponse<Self>> {
        let study_id = params.0;
        let ordering = params.1.to_sql();
        sql_query(format!("WITH scenarios_with_train_counts AS (
            SELECT t.*, COUNT(train_schedule.id) as trains_count
            FROM scenario as t
            LEFT JOIN train_schedule ON t.timetable_id = train_schedule.timetable_id WHERE t.study_id = $1
            GROUP BY t.id ORDER BY {ordering}
        )
        SELECT scenarios_with_train_counts.*, infra.name as infra_name
        FROM scenarios_with_train_counts
        JOIN infra ON infra.id = infra_id"))
            .bind::<BigInt, _>(study_id)
            .paginate(page, page_size)
            .load_and_count(conn).await
    }
}

#[cfg(test)]
pub mod test {
    use rstest::rstest;
    use std::sync::Arc;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::scenario_fixture_set;
    use crate::fixtures::tests::ScenarioFixtureSet;
    use crate::fixtures::tests::TestFixture;
    use crate::models::Delete;
    use crate::models::List;
    use crate::models::Retrieve;
    use crate::models::Timetable;
    use crate::views::operational_studies::Ordering;

    #[rstest]
    async fn create_delete_scenario(db_pool: Arc<DbConnectionPool>) {
        let ScenarioFixtureSet { scenario, .. } = scenario_fixture_set().await;

        // Delete the scenario
        Scenario::delete(db_pool.clone(), scenario.id())
            .await
            .unwrap();

        // Second delete should fail
        assert!(!Scenario::delete(db_pool.clone(), scenario.id())
            .await
            .unwrap());
    }

    #[rstest]
    async fn get_study(db_pool: Arc<DbConnectionPool>) {
        let ScenarioFixtureSet { study, .. } = scenario_fixture_set().await;

        // Get a scenario
        assert!(Scenario::retrieve(db_pool.clone(), study.id())
            .await
            .is_ok());
        assert!(ScenarioWithCountTrains::list(
            db_pool.clone(),
            1,
            25,
            (study.id(), Ordering::LastModifiedAsc)
        )
        .await
        .is_ok());
    }

    #[rstest]
    async fn sort_scenario(db_pool: Arc<DbConnectionPool>) {
        let ScenarioFixtureSet {
            scenario,
            study,
            timetable,
            ..
        } = scenario_fixture_set().await;

        // Create second timetable
        let timetable_2 = TestFixture::create_legacy(
            Timetable {
                id: None,
                name: Some(timetable.model.name.clone().unwrap() + "_bis"),
            },
            db_pool.clone(),
        )
        .await;

        // Create second scenario
        let scenario_2 = Scenario {
            name: Some(scenario.model.name.clone().unwrap() + "_bis"),
            id: None,
            timetable_id: Some(timetable_2.id()),
            ..scenario.model.clone()
        };
        let _scenario_2 = TestFixture::create_legacy(scenario_2, db_pool.clone());

        let scenarios =
            ScenarioWithCountTrains::list(db_pool.clone(), 1, 25, (study.id(), Ordering::NameDesc))
                .await
                .unwrap()
                .results;

        for (p1, p2) in scenarios.iter().zip(scenarios.iter().skip(1)) {
            let name_1 = p1.scenario.name.as_ref().unwrap().to_lowercase();
            let name_2 = p2.scenario.name.as_ref().unwrap().to_lowercase();
            assert!(name_1.ge(&name_2));
        }
    }
}
