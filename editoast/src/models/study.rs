use crate::error::Result;
use crate::models::TextArray;
use crate::models::{Identifiable, Update};
use crate::tables::study;
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::Data;
use async_trait::async_trait;
use chrono::NaiveDate;
use chrono::{NaiveDateTime, Utc};
use derivative::Derivative;
use diesel::result::Error as DieselError;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::Associations;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use editoast_derive::Model;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::List;
use crate::modelsv2::projects::{Ordering, Project};

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
    ToSchema,
)]
#[derivative(Default)]
#[diesel(belongs_to(Project))]
#[model(table = "study")]
#[model(create, delete, retrieve, update)]
#[diesel(table_name = study)]
#[serde(deny_unknown_fields)]
pub struct Study {
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
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    #[schema(value_type = String)]
    pub business_code: Option<String>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    #[schema(value_type = String)]
    pub service_code: Option<String>,
    #[diesel(deserialize_as = NaiveDateTime)]
    #[schema(value_type = NaiveDateTime)]
    pub creation_date: Option<NaiveDateTime>,
    #[derivative(Default(value = "Utc::now().naive_utc()"))]
    pub last_modification: NaiveDateTime,
    #[diesel(deserialize_as = Option<NaiveDate>)]
    #[schema(value_type = Option<NaiveDate>)]
    pub start_date: Option<Option<NaiveDate>>,
    #[diesel(deserialize_as = Option<NaiveDate>)]
    #[schema(value_type = Option<NaiveDate>)]
    pub expected_end_date: Option<Option<NaiveDate>>,
    #[diesel(deserialize_as = Option<NaiveDate>)]
    #[schema(value_type = Option<NaiveDate>)]
    pub actual_end_date: Option<Option<NaiveDate>>,
    #[diesel(deserialize_as = i32)]
    #[derivative(Default(value = "Some(0)"))]
    #[schema(value_type = i32)]
    pub budget: Option<i32>,
    #[diesel(deserialize_as = TextArray)]
    #[derivative(Default(value = "Some(Vec::new())"))]
    #[schema(value_type = Vec<String>)]
    pub tags: Option<Vec<String>>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    #[schema(value_type = String)]
    pub state: Option<String>,
    #[diesel(deserialize_as = String)]
    #[derivative(Default(value = "Some(String::new())"))]
    #[schema(value_type = String)]
    pub study_type: Option<String>,
    #[diesel(deserialize_as = i64)]
    #[schema(value_type = i64)]
    pub project_id: Option<i64>,
}

impl Identifiable for Study {
    fn get_id(&self) -> i64 {
        self.id.expect("Study id not found")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, QueryableByName, ToSchema)]
pub struct StudyWithScenarios {
    #[serde(flatten)]
    #[diesel(embed)]
    pub study: Study,
    #[diesel(sql_type = BigInt)]
    pub scenarios_count: i64,
}

impl Study {
    pub async fn update_last_modified(self, db_pool: Data<DbPool>) -> Result<Option<Study>> {
        let mut conn = db_pool.get().await?;
        self.update_last_modified_conn(&mut conn).await
    }

    pub async fn update_last_modified_conn(
        mut self,
        conn: &mut PgConnection,
    ) -> Result<Option<Study>> {
        self.last_modification = Utc::now().naive_utc();
        let study_id = self.id.unwrap();
        self.update_conn(conn, study_id).await
    }

    /// This function adds the list of scenarios ID that are linked to the study
    pub async fn with_scenarios(self, db_pool: Data<DbPool>) -> Result<StudyWithScenarios> {
        let mut conn = db_pool.get().await?;
        self.with_scenarios_conn(&mut conn).await
    }

    pub async fn with_scenarios_conn(self, conn: &mut PgConnection) -> Result<StudyWithScenarios> {
        use crate::tables::scenario::dsl as scenario_dsl;
        scenario_dsl::scenario
            .filter(scenario_dsl::study_id.eq(self.id.unwrap()))
            .count()
            .get_result(conn)
            .await
            .map(|scenarios_count| StudyWithScenarios {
                study: self,
                scenarios_count,
            })
            .map_err(|err| err.into())
    }

    pub fn validate(&self) -> Result<()> {
        if !dates_in_order(self.start_date, self.expected_end_date)
            || !dates_in_order(self.start_date, self.actual_end_date)
        {
            return Err(crate::views::study::StudyError::StartDateAfterEndDate.into());
        }

        Ok(())
    }
}

fn dates_in_order(a: Option<Option<NaiveDate>>, b: Option<Option<NaiveDate>>) -> bool {
    match (a, b) {
        (Some(Some(a)), Some(Some(b))) => a <= b,
        _ => true,
    }
}

#[async_trait]
impl List<(i64, Ordering)> for StudyWithScenarios {
    async fn list_conn(
        conn: &mut PgConnection,
        page: i64,
        page_size: i64,
        params: (i64, Ordering),
    ) -> Result<PaginatedResponse<Self>> {
        let project_id = params.0;
        let ordering = params.1.to_sql();
        sql_query(format!(
            "SELECT t.*, COUNT(scenario.*) as scenarios_count FROM study as t
            LEFT JOIN scenario ON scenario.study_id = t.id WHERE t.project_id = $1
            GROUP BY t.id ORDER BY {ordering} "
        ))
        .bind::<BigInt, _>(project_id)
        .paginate(page, page_size)
        .load_and_count(conn)
        .await
    }
}

#[cfg(test)]
pub mod test {
    use super::*;
    use crate::fixtures::tests::{db_pool, study_fixture_set, StudyFixtureSet, TestFixture};
    use crate::models::Delete;
    use crate::models::List;
    use crate::models::Retrieve;
    use crate::modelsv2::Ordering;
    use rstest::rstest;

    #[rstest]
    async fn create_delete_study(
        #[future] study_fixture_set: StudyFixtureSet,
        db_pool: Data<DbPool>,
    ) {
        let StudyFixtureSet { study, .. } = study_fixture_set.await;

        // Delete the study
        Study::delete(db_pool.clone(), study.id()).await.unwrap();

        // Second delete should fail
        assert!(!Study::delete(db_pool.clone(), study.id()).await.unwrap());
    }

    #[rstest]
    async fn get_study(#[future] study_fixture_set: StudyFixtureSet, db_pool: Data<DbPool>) {
        let StudyFixtureSet { study, project } = study_fixture_set.await;

        // Get a study
        assert!(Study::retrieve(db_pool.clone(), study.id()).await.is_ok());
        assert!(StudyWithScenarios::list(
            db_pool.clone(),
            1,
            25,
            (project.id(), Ordering::LastModifiedAsc)
        )
        .await
        .is_ok());
    }

    #[rstest]
    async fn sort_study(#[future] study_fixture_set: StudyFixtureSet, db_pool: Data<DbPool>) {
        let StudyFixtureSet { study, project } = study_fixture_set.await;

        // Create second study
        let study_2 = Study {
            id: None,
            name: Some(study.model.name.clone().unwrap() + "_bis"),
            ..study.model.clone()
        };
        TestFixture::create_legacy(study_2, db_pool.clone()).await;

        let studies =
            StudyWithScenarios::list(db_pool.clone(), 1, 25, (project.id(), Ordering::NameDesc))
                .await
                .unwrap()
                .results;
        for (p1, p2) in studies.iter().zip(studies.iter().skip(1)) {
            let name_1 = p1.study.name.as_ref().unwrap().to_lowercase();
            let name_2 = p2.study.name.as_ref().unwrap().to_lowercase();
            assert!(name_1.ge(&name_2));
        }
    }
}
