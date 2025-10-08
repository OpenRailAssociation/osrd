use chrono::DateTime;
use chrono::NaiveDate;
use chrono::Utc;

use database::DbConnection;
use diesel_async::scoped_futures::ScopedBoxFuture;
use diesel_async::scoped_futures::ScopedFutureExt;
use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::models::Scenario;
use crate::views::study::StudyError;
use editoast_models::prelude::*;
use editoast_models::tags::Tags;

use super::Project;

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

impl Study {
    pub async fn update_last_modified(
        &mut self,
        conn: &mut DbConnection,
    ) -> Result<(), editoast_models::Error> {
        self.last_modification = Utc::now();
        self.save(conn).await?;
        Ok(())
    }

    pub async fn scenarios_count(
        &self,
        conn: &mut DbConnection,
    ) -> Result<u64, editoast_models::Error> {
        let study_id = self.id;
        let count = Scenario::count(
            conn,
            SelectionSettings::new().filter(move || Scenario::STUDY_ID.eq(study_id)),
        )
        .await?;
        Ok(count)
    }

    /// Opens a transaction, retrieves the [Study] and its [Project] and calls the provided closure with these
    ///
    /// The last modification field of these objects are updated before the transaction is committed.
    #[tracing::instrument(skip(conn, f), err)]
    pub async fn transactional_content_update<T, E, F>(
        conn: DbConnection,
        study_id: i64,
        f: F,
    ) -> Result<T, InternalError>
    where
        T: Send,
        E: Into<InternalError> + Send, // EditoastError bound will be removed when retrieve will return the model's error
        F: FnOnce(DbConnection, Self, Project) -> ScopedBoxFuture<'static, 'static, Result<T, E>>
            + Send
            + 'static,
    {
        conn.transaction(|mut conn| {
            async move {
                let study = Self::retrieve_or_fail(conn.clone(), study_id, || {
                    StudyError::NotFound { study_id }
                })
                .await?;

                let id = study.id;
                let t = Project::transactional_content_update(
                    conn.clone(),
                    study.project_id,
                    |conn, project| async move { f(conn, study, project).await }.scope_boxed(),
                )
                .await?;

                Study::changeset()
                    .last_modification(Utc::now())
                    .update(&mut conn, id)
                    .await?;

                Ok(t)
            }
            .scope_boxed()
        })
        .await
    }
}

#[cfg(test)]
pub mod tests {
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::models::fixtures::create_project;
    use crate::models::fixtures::create_study;
    use database::DbConnectionPoolV2;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn study_retrieve() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let study_name = "test_study_name";
        let created_study =
            create_study(&mut db_pool.get_ok(), study_name, created_project.id).await;

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

        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let _created_study_1 = create_study(
            &mut db_pool.get_ok(),
            "test_study_name_1",
            created_project.id,
        )
        .await;

        let _created_study_2 = create_study(
            &mut db_pool.get_ok(),
            "test_study_name_2",
            created_project.id,
        )
        .await;

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
