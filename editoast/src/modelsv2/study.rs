use chrono::NaiveDate;
use chrono::NaiveDateTime;
use chrono::Utc;

use editoast_derive::ModelV2;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::Result;
use crate::modelsv2::prelude::*;
use crate::modelsv2::projects::Tags;
use crate::modelsv2::DbConnection;
use crate::modelsv2::Scenario;

#[derive(Clone, Debug, Serialize, Deserialize, ModelV2, ToSchema)]
#[model(table = crate::tables::study)]
pub struct Study {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub business_code: Option<String>,
    pub service_code: Option<String>,
    pub creation_date: NaiveDateTime,
    pub last_modification: NaiveDateTime,
    pub start_date: Option<NaiveDate>,
    pub expected_end_date: Option<NaiveDate>,
    pub actual_end_date: Option<NaiveDate>,
    pub budget: Option<i32>,
    #[model(remote = "Vec<Option<String>>")]
    pub tags: Tags,
    pub state: String,
    pub study_type: Option<String>,
    pub project_id: i64,
}

impl Study {
    pub async fn update_last_modified(&mut self, conn: &mut DbConnection) -> Result<()> {
        self.last_modification = Utc::now().naive_utc();
        self.save(conn).await?;
        Ok(())
    }

    pub async fn scenarios_count(&self, conn: &mut DbConnection) -> Result<u64> {
        let study_id = self.id;
        let count = Scenario::count(
            conn,
            SelectionSettings::new().filter(move || Scenario::STUDY_ID.eq(study_id)),
        )
        .await?;
        // Remove this when train schedule V1 support is dropped
        let count_tsv1 = {
            use diesel::prelude::*;
            use diesel_async::RunQueryDsl;
            crate::tables::scenario::table
                .count()
                .filter(crate::tables::scenario::study_id.eq(study_id))
                .get_result::<i64>(conn)
                .await?
        };
        Ok(count + count_tsv1 as u64)
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

#[cfg(test)]
pub mod test {
    use rstest::rstest;
    use std::ops::DerefMut;
    use std::sync::Arc;

    use super::*;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::study_fixture_set;
    use crate::fixtures::tests::StudyFixtureSet;
    use crate::fixtures::tests::TestFixture;
    use crate::modelsv2::DbConnectionPool;

    #[rstest]
    async fn create_delete_study(
        #[future] study_fixture_set: StudyFixtureSet,
        db_pool: Arc<DbConnectionPool>,
    ) {
        let StudyFixtureSet {
            study,
            project: _project,
        } = study_fixture_set.await;

        // Delete the study
        let conn = &mut db_pool.get().await.unwrap();
        Study::delete_static(conn, study.id()).await.unwrap();

        // Second delete should fail
        assert!(!Study::delete_static(conn, study.id()).await.unwrap());
    }

    #[rstest]
    async fn get_study(
        #[future] study_fixture_set: StudyFixtureSet,
        db_pool: Arc<DbConnectionPool>,
    ) {
        let StudyFixtureSet {
            study,
            project: _project,
        } = study_fixture_set.await;

        // Get a study
        let conn = &mut db_pool.get().await.unwrap();
        assert!(Study::retrieve(conn, study.id()).await.is_ok());
        assert!(Study::list(conn, Default::default()).await.is_ok());
    }

    #[rstest]
    async fn sort_study(
        #[future] study_fixture_set: StudyFixtureSet,
        db_pool: Arc<DbConnectionPool>,
    ) {
        let StudyFixtureSet {
            study,
            project: _project,
        } = study_fixture_set.await;

        // Create second study
        let study_2 = study
            .model
            .clone()
            .into_changeset()
            .name(study.model.name.clone() + "_bis");

        let _: TestFixture<Study> = TestFixture::create(study_2, db_pool.clone()).await;

        let studies = Study::list(
            db_pool.get().await.unwrap().deref_mut(),
            SelectionSettings::new().order_by(|| Study::NAME.desc()),
        )
        .await
        .unwrap();
        for (s1, s2) in studies.iter().zip(studies.iter().skip(1)) {
            let name_1 = s1.name.to_lowercase();
            let name_2 = s2.name.to_lowercase();
            assert!(name_1.ge(&name_2));
        }
    }
}
