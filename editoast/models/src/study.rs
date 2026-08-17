use chrono::DateTime;
use chrono::NaiveDate;
use chrono::Utc;

use database::DbConnection;
use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::prelude::*;
use crate::project::Project;
use crate::tags::Tags;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Model, ToSchema)]
#[model(table = database::tables::study)]
#[model(gen(ops = crud, list))]
pub struct Study {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub business_code: Option<String>,
    pub service_code: Option<String>,
    pub creation_date: DateTime<Utc>,
    pub last_modification: DateTime<Utc>,
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

#[derive(thiserror::Error, derive_more::From, Debug)]
pub enum Error {
    #[error("Study with id {study_id} not found")]
    NotFound { study_id: i64 },
    #[error(transparent)]
    #[from(forward)]
    Database(crate::Error),
}

impl Study {
    pub async fn update_last_modified(
        &mut self,
        conn: &mut DbConnection,
    ) -> Result<(), crate::Error> {
        self.last_modification = Utc::now();
        self.save(conn).await?;
        Ok(())
    }

    pub async fn scenarios_count(&self, conn: DbConnection) -> Result<u64, crate::Error> {
        use database::tables::scenario::dsl;
        use diesel::dsl::*;
        use diesel::prelude::*;
        use diesel_async::RunQueryDsl;

        let count = dsl::scenario
            .select(count_star())
            .filter(dsl::study_id.eq(self.id))
            .get_result::<i64>(&mut conn.write().await)
            .await?;
        Ok(count as u64)
    }

    /// Opens a transaction, retrieves the [Study] and its [Project] and calls the provided closure with these
    ///
    /// The last modification field of these objects are updated before the transaction is committed.
    #[tracing::instrument(skip(conn, f), err)]
    pub async fn transactional_content_update<T, E, F, Fut>(
        conn: DbConnection,
        study_id: i64,
        f: F,
    ) -> Result<Result<T, E>, Error>
    where
        F: FnOnce(DbConnection, Self, Project) -> Fut,
        Fut: Future<Output = Result<T, E>>,
    {
        conn.transaction(async move |mut conn| {
            let study =
                Self::retrieve_or_fail(conn.clone(), study_id, || Error::NotFound { study_id })
                    .await?;

            let id = study.id;
            let t = Project::transactional_content_update(
                conn.clone(),
                study.project_id,
                async move |conn, project| f(conn, study, project).await,
            )
            .await;

            let t = match t {
                Ok(Ok(t)) => t,
                Ok(Err(e)) => return Ok(Err(e)),
                Err(super::project::Error::NotFound { .. }) => {
                    unreachable!("Database integrity error: Study's project not found")
                }
                Err(super::project::Error::Database(e)) => return Err(e.into()),
            };

            Study::changeset()
                .last_modification(Utc::now())
                .update(&mut conn, id)
                .await?;

            Ok(Ok(t))
        })
        .await
    }
}

#[cfg(any(test, feature = "testing"))]
impl Study {
    pub fn fake(name: impl Into<String>, project_id: i64) -> Changeset<Self> {
        Self::changeset()
            .name(name.into())
            .creation_date(Utc::now())
            .last_modification(Utc::now())
            .budget(Some(0))
            .tags(Tags::default())
            .state("some_state".into())
            .project_id(project_id)
    }
}

#[cfg(test)]
pub mod tests {
    use pretty_assertions::assert_eq;

    use super::*;
    use database::DbConnectionPoolV2;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_retrieve() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let created_project = Project::fake("test_project_name")
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create project");

        let study_name = "test_study_name";
        let created_study = Study::fake(study_name, created_project.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create study");

        // Retrieve a study
        let study = Study::retrieve(db_pool.get_ok(), created_study.id)
            .await
            .expect("Failed to retrieve study")
            .expect("Study not found");

        assert_eq!(&created_study, &study);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn sort_study() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let created_project = Project::fake("test_project_name")
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create project");

        let _created_study_1 = Study::fake("test_study_name_1", created_project.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create study");

        let _created_study_2 = Study::fake("test_study_name_2", created_project.id)
            .create(&mut db_pool.get_ok())
            .await
            .expect("Failed to create study");

        let studies = Study::list(
            &mut db_pool.get_ok(),
            SelectionSettings::new().order_by(|| Study::NAME.desc()),
        )
        .await
        .expect("Failed to retrieve studies");

        for (s1, s2) in studies.iter().zip(studies.iter().skip(1)) {
            let name_1 = s1.name.to_lowercase();
            let name_2 = s2.name.to_lowercase();
            assert!(name_1.ge(&name_2));
        }
    }
}
