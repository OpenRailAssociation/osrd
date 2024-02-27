use crate::error::Result;
use crate::models::List;
use crate::modelsv2::{Changeset, Model, Row, Save};
use crate::views::pagination::{Paginate, PaginatedResponse};
use crate::DbPool;
use actix_web::web::Data;
use async_trait::async_trait;
use chrono::NaiveDate;
use chrono::{NaiveDateTime, Utc};
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::{AsyncPgConnection as PgConnection, RunQueryDsl};
use editoast_derive::ModelV2;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::modelsv2::projects::{Ordering, Tags};

#[derive(Clone, Debug, Serialize, Deserialize, ModelV2, ToSchema)]
#[model(table = crate::tables::study)]
pub struct Study {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub business_code: String,
    pub service_code: String,
    pub creation_date: NaiveDateTime,
    pub last_modification: NaiveDateTime,
    pub start_date: Option<NaiveDate>,
    pub expected_end_date: Option<NaiveDate>,
    pub actual_end_date: Option<NaiveDate>,
    pub budget: i32,
    #[model(remote = "Vec<Option<String>>")]
    pub tags: Tags,
    pub state: String,
    pub study_type: String,
    pub project_id: i64,
}

impl Study {
    pub async fn update_last_modified(&mut self, conn: &mut PgConnection) -> Result<()> {
        self.last_modification = Utc::now().naive_utc();
        self.save(conn).await?;
        Ok(())
    }

    pub async fn scenarios_count(&self, db_pool: Data<DbPool>) -> Result<i64> {
        use crate::tables::scenario::dsl as scenario_dsl;
        let conn = &mut db_pool.get().await?;
        let scenarios_count = scenario_dsl::scenario
            .filter(scenario_dsl::study_id.eq(self.id))
            .count()
            .get_result(conn)
            .await?;
        Ok(scenarios_count)
    }

    pub fn validate(study_changeset: &Changeset<Self>) -> Result<()> {
        if !dates_in_order(
            study_changeset.start_date,
            study_changeset.expected_end_date,
        ) || !dates_in_order(study_changeset.start_date, study_changeset.actual_end_date)
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
impl List<(i64, Ordering)> for Study {
    async fn list_conn(
        conn: &mut PgConnection,
        page: i64,
        page_size: i64,
        params: (i64, Ordering),
    ) -> Result<PaginatedResponse<Self>> {
        let project_id = params.0;
        let ordering = params.1.to_sql();
        let study_row = sql_query(format!(
            "SELECT t.* FROM study as t WHERE t.project_id = $1 ORDER BY {ordering}"
        ))
        .bind::<BigInt, _>(project_id)
        .paginate(page, page_size)
        .load_and_count::<Row<Study>>(conn)
        .await?;

        let results: Vec<Study> = study_row.results.into_iter().map(Self::from_row).collect();

        Ok(PaginatedResponse {
            count: study_row.count,
            previous: study_row.previous,
            next: study_row.next,
            results,
        })
    }
}

#[cfg(test)]
pub mod test {
    use super::*;
    use crate::fixtures::tests::{db_pool, study_fixture_set, StudyFixtureSet, TestFixture};
    use crate::models::List;
    use crate::modelsv2::{DeleteStatic, Model, Ordering, Retrieve};
    use rstest::rstest;

    #[rstest]
    async fn create_delete_study(
        #[future] study_fixture_set: StudyFixtureSet,
        db_pool: Data<DbPool>,
    ) {
        let StudyFixtureSet { study, .. } = study_fixture_set.await;

        // Delete the study
        let conn = &mut db_pool.get().await.unwrap();
        Study::delete_static(conn, study.id()).await.unwrap();

        // Second delete should fail
        assert!(!Study::delete_static(conn, study.id()).await.unwrap());
    }

    #[rstest]
    async fn get_study(#[future] study_fixture_set: StudyFixtureSet, db_pool: Data<DbPool>) {
        let StudyFixtureSet { study, project } = study_fixture_set.await;

        // Get a study
        let conn = &mut db_pool.get().await.unwrap();
        assert!(Study::retrieve(conn, study.id()).await.is_ok());
        assert!(Study::list(
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
        let study_2 = study
            .model
            .clone()
            .into_changeset()
            .name(study.model.name.clone() + "_bis");

        let _: TestFixture<Study> = TestFixture::create(study_2, db_pool.clone()).await;

        let studies = Study::list(db_pool.clone(), 1, 25, (project.id(), Ordering::NameDesc))
            .await
            .unwrap()
            .results;
        for (s1, s2) in studies.iter().zip(studies.iter().skip(1)) {
            let name_1 = s1.name.to_lowercase();
            let name_2 = s2.name.to_lowercase();
            assert!(name_1.ge(&name_2));
        }
    }
}
