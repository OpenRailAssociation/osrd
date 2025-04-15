use chrono::NaiveDate;
use chrono::NaiveDateTime;
use chrono::Utc;

use diesel_async::scoped_futures::ScopedBoxFuture;
use diesel_async::scoped_futures::ScopedFutureExt;
use editoast_derive::Model;
use editoast_models::DbConnection;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::error::Result;
use crate::models::Scenario;
use crate::models::Tags;
use crate::models::prelude::*;
use crate::views::study::StudyError;

use super::Project;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, Model, ToSchema)]
#[model(table = editoast_models::tables::study)]
#[model(gen(ops = crud, list))]
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
        Ok(count)
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

    /// Opens a transaction, retrieves the [Study] and its [Project] and calls the provided closure with these
    ///
    /// The last modification field of these objects are updated before the transaction is committed.
    #[tracing::instrument(skip(conn, f), err)]
    pub async fn transactional_content_update<T, E, F>(
        conn: DbConnection,
        study_id: i64,
        f: F,
    ) -> Result<(T, Self, Project), InternalError>
    where
        T: Send,
        E: Into<InternalError> + Send, // EditoastError bound will be removed when retrieve will return the model's error
        F: for<'a> FnOnce(
                DbConnection,
                &'a mut Self,
                &'a mut Project,
            ) -> ScopedBoxFuture<'a, 'a, Result<T, E>>
            + Send
            + 'static,
    {
        conn.transaction(|mut conn| {
            async move {
                #[expect(deprecated)]
                let mut study = Self::retrieve_or_fail(&mut conn, study_id, || {
                    StudyError::NotFound { study_id }
                })
                .await?;

                let ((t, mut study), project) = Project::transactional_content_update(
                    conn.clone(),
                    study.project_id,
                    |conn, project| {
                        async move {
                            let res = f(conn.clone(), &mut study, project).await;
                            res.map(|t| (t, study))
                        }
                        .scope_boxed()
                    },
                )
                .await?;

                study
                    .patch()
                    .last_modification(Utc::now().naive_utc())
                    .apply(&mut conn)
                    .await?;

                Ok((t, study, project))
            }
            .scope_boxed()
        })
        .await
    }
}

fn dates_in_order(a: Option<Option<NaiveDate>>, b: Option<Option<NaiveDate>>) -> bool {
    match (a, b) {
        (Some(Some(a)), Some(Some(b))) => a <= b,
        _ => true,
    }
}

#[cfg(test)]
pub mod tests {
    use pretty_assertions::assert_eq;
    use rstest::rstest;

    use super::*;
    use crate::models::fixtures::create_project;
    use crate::models::fixtures::create_study;
    use editoast_models::DbConnectionPoolV2;

    #[rstest]
    async fn study_retrieve() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let created_project = create_project(&mut db_pool.get_ok(), "test_project_name").await;

        let study_name = "test_study_name";
        let created_study =
            create_study(&mut db_pool.get_ok(), study_name, created_project.id).await;

        // Retrieve a study
        #[expect(deprecated)]
        let study = Study::retrieve(&mut db_pool.get_ok(), created_study.id)
            .await
            .expect("Failed to retrieve study")
            .expect("Study not found");

        assert_eq!(&created_study, &study);
    }

    #[rstest]
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
