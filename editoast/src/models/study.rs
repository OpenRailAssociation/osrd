use crate::error::Result;
use crate::models::Project;
use crate::models::{Identifiable, Update};
use crate::tables::osrd_infra_study;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::{block, Data};
use chrono::NaiveDate;
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::Associations;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel::RunQueryDsl;
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
    #[derivative(Default(value = "Some(String::new())"))]
    pub name: Option<String>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    pub description: Option<String>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    pub business_code: Option<String>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
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
    #[derivative(Default(value = "Some(0)"))]
    pub budget: Option<i32>,
    #[diesel(deserialize_as = Vec<String>)]
    #[derivative(Default(value = "Some(Vec::new())"))]
    pub tags: Option<Vec<String>>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    pub state: Option<String>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    pub study_type: Option<String>,
}

impl Identifiable for Study {
    fn get_id(&self) -> i64 {
        self.id.expect("Study id not found")
    }
}

#[derive(Debug, Clone, Serialize, QueryableByName)]
pub struct StudyWithScenarios {
    #[serde(flatten)]
    #[diesel(embed)]
    pub study: Study,
    #[diesel(sql_type = BigInt)]
    pub scenarios_count: i64,
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
            let scenarios_count = scenario_dsl::osrd_infra_scenario
                .filter(scenario_dsl::study_id.eq(self.id.unwrap()))
                .count()
                .get_result(&mut conn)?;
            Ok(StudyWithScenarios {
                study: self,
                scenarios_count,
            })
        })
        .await
        .unwrap()
    }
}

impl List<(i64, Ordering)> for StudyWithScenarios {
    fn list_conn(
        conn: &mut diesel::PgConnection,
        page: i64,
        page_size: i64,
        params: (i64, Ordering),
    ) -> Result<PaginatedResponse<Self>> {
        let project_id = params.0;
        let ordering = params.1.to_sql();
        sql_query(format!("SELECT t.*, COUNT(scenario.*) as scenarios_count FROM osrd_infra_study t
            LEFT JOIN osrd_infra_scenario scenario ON scenario.study_id = t.id WHERE t.project_id = $1
            GROUP BY t.id ORDER BY {ordering} "))
            .bind::<BigInt, _>(project_id)
            .paginate(page, page_size)
            .load_and_count(conn)
    }
}

#[cfg(test)]
pub mod test {

    use super::{Project, Study};
    use crate::client::PostgresConfig;
    use crate::models::projects::test::build_test_project;
    use crate::models::Create;
    use crate::models::Delete;
    use crate::models::List;
    use crate::models::Ordering;
    use crate::models::Retrieve;
    use crate::models::StudyWithScenarios;
    use actix_web::test as actix_test;
    use actix_web::web::Data;
    use chrono::Utc;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;

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
        assert!(StudyWithScenarios::list(
            pool.clone(),
            1,
            25,
            (project_id, Ordering::LastModifiedAsc)
        )
        .await
        .is_ok());

        // Delete the study
        Study::delete(pool.clone(), study.id.unwrap())
            .await
            .unwrap();
        Project::delete(pool.clone(), project_id).await.unwrap();
    }

    #[actix_test]
    async fn sort_study() {
        let project = build_test_project();
        let manager = ConnectionManager::<PgConnection>::new(PostgresConfig::default().url());
        let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());

        // Create a project
        let project = project.clone().create(pool.clone()).await.unwrap();
        let project_id = project.id.unwrap();

        // Create first study
        let mut study = build_test_study(project_id);
        study.clone().create(pool.clone()).await.unwrap();

        // Create second study
        study.name = Some("study_test".into());
        study.create(pool.clone()).await.unwrap();

        let studies =
            StudyWithScenarios::list(pool.clone(), 1, 25, (project_id, Ordering::NameDesc))
                .await
                .unwrap()
                .results;
        for (p1, p2) in studies.iter().zip(studies.iter().skip(1)) {
            let name_1 = p1.study.name.as_ref().unwrap().to_lowercase();
            let name_2 = p2.study.name.as_ref().unwrap().to_lowercase();
            assert!(name_1.ge(&name_2));
        }

        // Delete the project
        Project::delete(pool.clone(), project_id).await.unwrap();
    }
}
