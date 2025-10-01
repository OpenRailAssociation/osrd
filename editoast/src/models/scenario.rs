use std::ops::DerefMut;

use chrono::DateTime;
use chrono::Utc;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use diesel_async::scoped_futures::ScopedBoxFuture;
use diesel_async::scoped_futures::ScopedFutureExt as _;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::error::InternalError;
use crate::models::timetable::Timetable;
use crate::views::scenario::ScenarioError;
use database::DbConnection;
use editoast_derive::Model;
use editoast_models::prelude::*;
use editoast_models::tags::Tags;

use super::Project;
use super::Study;

#[derive(Debug, Clone, Model, Deserialize, Serialize, ToSchema)]
#[model(table = database::tables::scenario)]
#[model(gen(ops = crud, list))]
#[cfg_attr(test, derive(PartialEq))]
pub struct Scenario {
    pub id: i64,
    pub infra_id: i64,
    pub name: String,
    pub description: String,
    pub creation_date: DateTime<Utc>,
    pub last_modification: DateTime<Utc>,
    #[model(remote = "Vec<Option<String>>")]
    pub tags: Tags,
    pub timetable_id: i64,
    pub study_id: i64,
    #[schema(nullable = false)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub electrical_profile_set_id: Option<i64>,
}

impl Scenario {
    pub async fn infra_name(
        &self,
        conn: &mut DbConnection,
    ) -> Result<String, database::DatabaseError> {
        use database::tables::infra::dsl as infra_dsl;
        let infra_name = infra_dsl::infra
            .filter(infra_dsl::id.eq(self.infra_id))
            .select(infra_dsl::name)
            .first::<String>(conn.write().await.deref_mut())
            .await?;
        Ok(infra_name)
    }

    pub async fn trains_count(
        &self,
        conn: &mut DbConnection,
    ) -> Result<i64, database::DatabaseError> {
        Timetable::trains_count(self.timetable_id, conn).await
    }

    pub async fn paced_trains_count(
        &self,
        conn: &mut DbConnection,
    ) -> Result<i64, database::DatabaseError> {
        Timetable::paced_trains_count(self.timetable_id, conn).await
    }

    pub async fn update_last_modified(
        &mut self,
        conn: &mut DbConnection,
    ) -> Result<(), editoast_models::Error> {
        self.last_modification = Utc::now();
        self.save(conn).await?;
        Ok(())
    }

    /// Opens a transaction, retrieves the [Scenario], its [Study] and [Project] and
    /// calls the provided closure with these objects
    ///
    /// The last modification field of these three objects are updated before the transaction is committed.
    #[tracing::instrument(skip(conn, f), err)]
    pub async fn transactional_content_update<T, E, F>(
        conn: DbConnection,
        scenario_id: i64,
        f: F,
    ) -> Result<T, InternalError>
    where
        T: Send,
        E: Into<InternalError> + Send, // EditoastError bound will be removed when retrieve will return the model's error
        F: FnOnce(
                DbConnection,
                Self,
                Study,
                Project,
            ) -> ScopedBoxFuture<'static, 'static, Result<T, E>>
            + Send
            + 'static,
    {
        conn.transaction(|mut conn| {
            async move {
                let scenario = Self::retrieve_or_fail(conn.clone(), scenario_id, || {
                    ScenarioError::NotFound { scenario_id }
                })
                .await?;

                let id = scenario.id;
                let t = Study::transactional_content_update(
                    conn.clone(),
                    scenario.study_id,
                    |conn, study, project| {
                        async move { f(conn, scenario, study, project).await }.scope_boxed()
                    },
                )
                .await?;

                Scenario::changeset()
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
