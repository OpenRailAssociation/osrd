use crate::error::Result;
use crate::models::Project;
use crate::tables::osrd_infra_study;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::{block, Data};
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::sql_query;
use diesel::sql_types::{Array, BigInt};
use diesel::Associations;
use diesel::ExpressionMethods;
use diesel::{QueryDsl, RunQueryDsl};
use editoast_derive::Model;
use serde::{Deserialize, Serialize};

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
    Associations,
    Model,
)]
#[derivative(Default)]
#[diesel(belongs_to(Project))]
#[model(table = "osrd_infra_study")]
#[model(create, delete, retrieve)]
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
    #[diesel(deserialize_as = Option<NaiveDateTime>)]
    pub start_date: Option<Option<NaiveDateTime>>,
    #[diesel(deserialize_as = Option<NaiveDateTime>)]
    pub expected_end_date: Option<Option<NaiveDateTime>>,
    #[diesel(deserialize_as = Option<NaiveDateTime>)]
    pub actual_end_date: Option<Option<NaiveDateTime>>,
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

    pub async fn list(
        db_pool: Data<DbPool>,
        page: i64,
        per_page: i64,
        project_id: i64,
    ) -> Result<PaginatedResponse<StudyWithScenarios>> {
        sql_query(
            "SELECT study.*, COALESCE(ARRAY_AGG(scenario.id) FILTER (WHERE scenario.id is not NULL), ARRAY[]::bigint[])  as scenarios FROM osrd_infra_study study
            LEFT JOIN osrd_infra_scenario scenario ON scenario.study_id = study.id WHERE study.project_id = $1
            GROUP BY study.id"
        ).bind::<BigInt,_>(project_id)
        .paginate(page)
        .per_page(per_page)
        .load_and_count(db_pool)
        .await
    }
}

#[cfg(test)]
pub mod test {

    use super::{Project, Study};
    use crate::client::PostgresConfig;
    use crate::models::projects::test::build_test_project;
    use crate::models::Create;
    use crate::models::Delete;
    use crate::models::Retrieve;
    use actix_web::test as actix_test;
    use actix_web::web::Data;
    use chrono::Utc;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;

    fn build_test_study(project_id: i64) -> Study {
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

    #[actix_test]
    async fn create_delete_study() {
        let project = build_test_project();
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        // Create a project
        let project = project.create(pool.clone()).await.unwrap();
        let project_id = project.id.unwrap();

        // Create a study
        let study = build_test_study(project_id);
        let study: Study = study.create(pool.clone()).await.unwrap();

        // Delete the study
        Study::delete(pool.clone(), study.id.unwrap())
            .await
            .unwrap();
        Project::delete(pool.clone(), project_id).await.unwrap();

        // Second delete should fail
        assert!(!Study::delete(pool.clone(), study.id.unwrap())
            .await
            .unwrap());
    }

    #[actix_test]
    async fn get_study() {
        let project = build_test_project();
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        // Create a project
        let project = project.create(pool.clone()).await.unwrap();
        let project_id = project.id.unwrap();

        // Create a study
        let study = build_test_study(project_id);
        let study: Study = study.create(pool.clone()).await.unwrap();

        // Get a study
        assert!(Study::retrieve(pool.clone(), study.id.unwrap())
            .await
            .is_ok());
        assert!(Study::list(pool.clone(), 1, 25, project_id).await.is_ok());

        // Delete the study
        Study::delete(pool.clone(), study.id.unwrap())
            .await
            .unwrap();
        Project::delete(pool.clone(), project_id).await.unwrap();
    }
}
