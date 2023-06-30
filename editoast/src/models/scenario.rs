use crate::error::Result;
use crate::models::train_schedule::LightTrainSchedule;
use crate::models::Delete;
use crate::tables::osrd_infra_scenario;
use crate::views::pagination::Paginate;
use crate::views::pagination::PaginatedResponse;
use crate::DbPool;
use actix_web::web::{block, Data};
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::sql_query;
use diesel::sql_types::{Array, BigInt, Nullable, Text};
use diesel::{delete, QueryDsl};
use diesel::{ExpressionMethods, RunQueryDsl};
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

use super::projects::Ordering;
use super::List;

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
)]
#[derivative(Default)]
#[model(table = "osrd_infra_scenario")]
#[model(create, retrieve, update)]
#[diesel(table_name = osrd_infra_scenario)]
pub struct Scenario {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = i64)]
    pub study_id: Option<i64>,
    #[diesel(deserialize_as = i64)]
    pub infra_id: Option<i64>,
    #[diesel(deserialize_as = Option<i64>)]
    pub electrical_profile_set_id: Option<Option<i64>>,
    #[diesel(deserialize_as = i64)]
    pub timetable_id: Option<i64>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    pub name: Option<String>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    pub description: Option<String>,
    #[diesel(deserialize_as = NaiveDateTime)]
    pub creation_date: Option<NaiveDateTime>,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub last_modification: NaiveDateTime,
    #[diesel(deserialize_as = Vec<String>)]
    #[derivative(Default(value = "Some(Vec::new())"))]
    pub tags: Option<Vec<String>>,
}

impl crate::models::Identifiable for Scenario {
    fn get_id(&self) -> i64 {
        self.id.expect("Scenario id not found")
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, QueryableByName)]
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

#[derive(Debug, Clone, Serialize, QueryableByName)]
pub struct ScenarioWithCountTrains {
    #[serde(flatten)]
    #[diesel(embed)]
    pub scenario: Scenario,
    #[diesel(sql_type = BigInt)]
    pub trains_count: i64,
}

impl Scenario {
    pub async fn with_details(self, db_pool: Data<DbPool>) -> Result<ScenarioWithDetails> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_electricalprofileset::dsl as elec_dsl;
            use crate::tables::osrd_infra_infra::dsl as infra_dsl;
            use crate::tables::osrd_infra_trainschedule::dsl::*;
            let mut conn = db_pool.get()?;
            let infra_name = infra_dsl::osrd_infra_infra
                .filter(infra_dsl::id.eq(self.infra_id.unwrap()))
                .select(infra_dsl::name)
                .first::<String>(&mut conn)?;

            let electrical_profile_set_name = match self.electrical_profile_set_id.unwrap() {
                Some(electrical_profile_set) => Some(
                    elec_dsl::osrd_infra_electricalprofileset
                        .filter(elec_dsl::id.eq(electrical_profile_set))
                        .select(elec_dsl::name)
                        .first::<String>(&mut conn)?,
                ),
                None => None,
            };

            let train_schedules = osrd_infra_trainschedule
                .filter(timetable_id.eq(self.timetable_id.unwrap()))
                .select((id, train_name, departure_time, path_id))
                .load::<LightTrainSchedule>(&mut conn)?;

            let trains_count = train_schedules.len() as i64;

            Ok(ScenarioWithDetails {
                scenario: self,
                infra_name,
                electrical_profile_set_name,
                train_schedules,
                trains_count,
            })
        })
        .await
        .unwrap()
    }
}

/// Delete a scenario.
/// When we delete a scenario, the associated timetable is deleted too.
impl Delete for Scenario {
    fn delete_conn(conn: &mut diesel::PgConnection, scenario_id: i64) -> Result<bool> {
        use crate::tables::osrd_infra_scenario::dsl as scenario_dsl;
        use crate::tables::osrd_infra_timetable::dsl as timetable_dsl;

        // Delete scenario
        let scenario = match delete(
            scenario_dsl::osrd_infra_scenario.filter(scenario_dsl::id.eq(scenario_id)),
        )
        .get_result::<Scenario>(conn)
        {
            Ok(scenario) => scenario,
            Err(DieselError::NotFound) => return Ok(false),
            Err(err) => return Err(err.into()),
        };

        // Delete timetable
        delete(
            timetable_dsl::osrd_infra_timetable
                .filter(timetable_dsl::id.eq(scenario.timetable_id.unwrap())),
        )
        .execute(conn)?;
        Ok(true)
    }
}

impl List<(i64, Ordering)> for ScenarioWithCountTrains {
    /// List all scenarios with the number of trains.
    /// This functions takes a study_id to filter scenarios.
    fn list_conn(
        conn: &mut diesel::PgConnection,
        page: i64,
        page_size: i64,
        params: (i64, Ordering),
    ) -> Result<PaginatedResponse<Self>> {
        let study_id = params.0;
        let ordering = params.1.to_sql();
        sql_query(format!("SELECT t.*,COUNT(trainschedule.id) as trains_count FROM osrd_infra_scenario t
            LEFT JOIN osrd_infra_trainschedule trainschedule ON t.timetable_id = trainschedule.timetable_id WHERE t.study_id = $1
            GROUP BY t.id ORDER BY {ordering}"))
            .bind::<BigInt, _>(study_id)
            .paginate(page, page_size)
            .load_and_count(conn)
    }
}

#[cfg(test)]
pub mod test {
    use super::*;
    use crate::fixtures::tests::{db_pool, scenario_fixture_set, ScenarioFixtureSet, TestFixture};
    use crate::models::Delete;
    use crate::models::List;
    use crate::models::Ordering;
    use crate::models::Retrieve;
    use crate::models::Timetable;
    use rstest::rstest;

    #[rstest]
    async fn create_delete_scenario(
        #[future] scenario_fixture_set: ScenarioFixtureSet,
        db_pool: Data<DbPool>,
    ) {
        let ScenarioFixtureSet { scenario, .. } = scenario_fixture_set.await;

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
    async fn get_study(#[future] scenario_fixture_set: ScenarioFixtureSet, db_pool: Data<DbPool>) {
        let ScenarioFixtureSet { study, .. } = scenario_fixture_set.await;

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
    async fn sort_scenario(
        #[future] scenario_fixture_set: ScenarioFixtureSet,
        db_pool: Data<DbPool>,
    ) {
        let ScenarioFixtureSet {
            scenario,
            study,
            timetable,
            ..
        } = scenario_fixture_set.await;

        // Create second timetable
        let timetable_2 = TestFixture::create(
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
        let _scenario_2 = TestFixture::create(scenario_2, db_pool.clone());

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
