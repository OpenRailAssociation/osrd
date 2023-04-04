use crate::error::Result;
use crate::models::Project;
use crate::models::Update;
use crate::tables::osrd_infra_study;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::{block, Data};
use chrono::NaiveDate;
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::sql_query;
use diesel::sql_types::{Array, BigInt};
use diesel::Associations;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel::RunQueryDsl;
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

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
    Associations,
    Model,
)]
#[derivative(Default)]
#[diesel(belongs_to(Project))]
#[model(table = "osrd_infra_study")]
#[model(create, delete, retrieve, update)]
#[diesel(table_name = osrd_infra_study)]
pub struct Study {
    #[diesel(deserialize_as = i64)]
    pub id: Option<i64>,
    #[diesel(deserialize_as = i64)]
    pub project_id: Option<i64>,
    #[diesel(deserialize_as = String)]
    pub name: Option<String>,
    #[diesel(deserialize_as = String)]
    pub description: Option<String>,
    #[diesel(deserialize_as = String)]
    pub business_code: Option<String>,
    #[diesel(deserialize_as = String)]
    pub service_code: Option<String>,
    #[diesel(deserialize_as = NaiveDateTime)]
    pub creation_date: Option<NaiveDateTime>,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub last_modification: NaiveDateTime,
    #[diesel(deserialize_as = Option<NaiveDate>)]
    pub start_date: Option<Option<NaiveDate>>,
    #[diesel(deserialize_as = Option<NaiveDate>)]
    pub expected_end_date: Option<Option<NaiveDate>>,
    #[diesel(deserialize_as = Option<NaiveDate>)]
    pub actual_end_date: Option<Option<NaiveDate>>,
    #[diesel(deserialize_as = i32)]
    pub budget: Option<i32>,
    #[diesel(deserialize_as = Vec<String>)]
    pub tags: Option<Vec<String>>,
    #[diesel(deserialize_as = String)]
    pub state: Option<String>,
    #[diesel(deserialize_as = String)]
    pub study_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, QueryableByName)]
pub struct StudyWithScenarios {
    #[serde(flatten)]
    #[diesel(embed)]
    pub study: Study,
    #[diesel(sql_type = Array<BigInt>)]
    pub scenarios: Vec<i64>,
}

impl Study {
    pub async fn update_last_modified(mut self, db_pool: Data<DbPool>) -> Result<Option<Study>> {
        self.last_modification = Utc::now().naive_utc();
        let study_id = self.id.unwrap();
        self.update(db_pool, study_id).await
    }

    /// This function adds the list of scenarios ID that are linked to the study
    pub async fn with_scenarios(self, db_pool: Data<DbPool>) -> Result<StudyWithScenarios> {
        block::<_, Result<_>>(move || {
            use crate::tables::osrd_infra_scenario::dsl as scenario_dsl;
            let mut conn = db_pool.get()?;
            let scenarios = scenario_dsl::osrd_infra_scenario
                .filter(scenario_dsl::study_id.eq(self.id.unwrap()))
                .select(scenario_dsl::id)
                .load(&mut conn)?;
            Ok(StudyWithScenarios {
                study: self,
                scenarios,
            })
        })
        .await
        .unwrap()
    }
}

impl List<i64> for StudyWithScenarios {
    fn list_conn(
        conn: &mut diesel::PgConnection,
        page: i64,
        page_size: i64,
        project_id: i64,
    ) -> Result<PaginatedResponse<Self>> {
        sql_query(
            "SELECT study.*, COALESCE(ARRAY_AGG(scenario.id) FILTER (WHERE scenario.id is not NULL), ARRAY[]::bigint[]) as scenarios FROM osrd_infra_study study
            LEFT JOIN osrd_infra_scenario scenario ON scenario.study_id = study.id WHERE study.project_id = $1
            GROUP BY study.id"
        ).bind::<BigInt,_>(project_id)
        .paginate(page, page_size)
        .load_and_count(conn)
    }
}

#[cfg(test)]
pub mod test {
    use super::{Project, Study};
    use crate::fixtures::tests::{db_pool, project, TestFixture};
    use crate::models::Create;
    use crate::models::Delete;
    use crate::models::List;
    use crate::models::Retrieve;
    use crate::models::StudyWithScenarios;
    use actix_web::web::Data;
    use chrono::Utc;
    use diesel::r2d2::{ConnectionManager, Pool};
    use rstest::rstest;

    pub fn build_test_study(project_id: i64) -> Study {
        Study {
            name: Some("test".into()),
            project_id: Some(project_id),
            description: Some("test".into()),
            creation_date: Some(Utc::now().naive_utc()),
            business_code: Some("AAA".into()),
            service_code: Some("BBB".into()),
            state: Some("some_type".into()),
            study_type: Some("some_type".into()),
            budget: Some(0),
            tags: Some(vec![]),
            ..Default::default()
        }
    }

    #[rstest]
    async fn create_delete_study(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] project: TestFixture<Project>,
    ) {
        let project = project.await;
        // Create a study
        let study = build_test_study(project.id());
        let study: Study = study.create(db_pool.clone()).await.unwrap();

        // Delete the study
        Study::delete(db_pool.clone(), study.id.unwrap())
            .await
            .unwrap();

        // Second delete should fail
        assert!(!Study::delete(db_pool.clone(), study.id.unwrap())
            .await
            .unwrap());
    }

    #[rstest]
    async fn get_study(
        db_pool: Data<Pool<ConnectionManager<diesel::PgConnection>>>,
        #[future] project: TestFixture<Project>,
    ) {
        let project = project.await;

        // Create a study
        let study = build_test_study(project.id());
        let study: Study = study.create(db_pool.clone()).await.unwrap();

        // Get a study
        assert!(Study::retrieve(db_pool.clone(), study.id.unwrap())
            .await
            .is_ok());
        assert!(
            StudyWithScenarios::list(db_pool.clone(), 1, 25, project.id())
                .await
                .is_ok()
        );

        // Delete the study
        Study::delete(db_pool.clone(), study.id.unwrap())
            .await
            .unwrap();
    }
}
