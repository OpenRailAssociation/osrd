use std::ops::DerefMut;

use chrono::DateTime;
use chrono::Utc;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use database::DbConnection;
use editoast_derive::Model;

use crate::prelude::*;
use crate::project::Project;
use crate::study::Study;
use crate::tags::Tags;
use crate::timetable::Timetable;

#[derive(Debug, Clone, Model, Deserialize, Serialize, ToSchema)]
#[model(table = database::tables::scenario)]
#[model(gen(ops = crud, list))]
#[cfg_attr(any(test, feature = "testing"), derive(PartialEq))]
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

#[derive(thiserror::Error, derive_more::From, Debug)]
pub enum Error {
    #[error("Scenario with id {scenario_id} not found")]
    NotFound { scenario_id: i64 },
    #[error(transparent)]
    #[from(forward)]
    Database(crate::Error),
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

    pub async fn train_schedules_count(
        &self,
        conn: &mut DbConnection,
    ) -> Result<i64, database::DatabaseError> {
        Timetable::train_schedules_count(self.timetable_id, conn).await
    }

    pub async fn update_last_modified(
        &mut self,
        conn: &mut DbConnection,
    ) -> Result<(), crate::Error> {
        self.last_modification = Utc::now();
        self.save(conn).await?;
        Ok(())
    }

    /// Opens a transaction, retrieves the [Scenario], its [Study] and [Project] and
    /// calls the provided closure with these objects
    ///
    /// The last modification field of these three objects are updated before the transaction is committed.
    #[tracing::instrument(skip(conn, f), err)]
    pub async fn transactional_content_update<T, E, F, Fut>(
        conn: DbConnection,
        scenario_id: i64,
        f: F,
    ) -> Result<Result<T, E>, Error>
    where
        F: FnOnce(DbConnection, Self, Study, Project) -> Fut,
        Fut: Future<Output = Result<T, E>>,
    {
        conn.transaction(async move |mut conn| {
            let scenario = Self::retrieve_or_fail(conn.clone(), scenario_id, || Error::NotFound {
                scenario_id,
            })
            .await?;

            let id = scenario.id;
            let t = Study::transactional_content_update(
                conn.clone(),
                scenario.study_id,
                async move |conn, study, project| f(conn, scenario, study, project).await,
            )
            .await;

            let t = match t {
                Ok(Ok(t)) => t,
                Ok(Err(e)) => return Ok(Err(e)),
                Err(super::study::Error::NotFound { .. }) => {
                    unreachable!("Database integrity error: Scenario's study not found")
                }
                Err(super::study::Error::Database(e)) => return Err(e.into()),
            };

            Scenario::changeset()
                .last_modification(Utc::now())
                .update(&mut conn, id)
                .await?;

            Ok(Ok(t))
        })
        .await
    }
}

#[cfg(any(test, feature = "testing"))]
impl Scenario {
    pub fn fake(
        name: impl Into<String>,
        study_id: i64,
        infra_id: i64,
        timetable_id: i64,
    ) -> Changeset<Self> {
        Self::changeset()
            .name(name.into())
            .description(String::new())
            .creation_date(Utc::now())
            .last_modification(Utc::now())
            .tags(Tags::default())
            .study_id(study_id)
            .infra_id(infra_id)
            .timetable_id(timetable_id)
    }
}
