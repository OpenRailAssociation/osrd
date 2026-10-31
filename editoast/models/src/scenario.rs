use std::ops::DerefMut as _;

use diesel::ExpressionMethods as _;
use diesel::JoinOnDsl as _;
use diesel::QueryDsl as _;
use diesel_async::RunQueryDsl as _;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use database::DbConnection;
use editoast_derive::Model;

use crate::Timestamp;
use crate::prelude::*;
use crate::project::Project;
use crate::study::Study;
use crate::tags::Tags;

#[derive(Debug, Clone, Model, Deserialize, Serialize, ToSchema)]
#[model(table = database::tables::scenario)]
#[model(gen(ops = crud, list))]
#[cfg_attr(any(test, feature = "testing"), derive(PartialEq))]
pub struct Scenario {
    pub id: i64,
    pub infra_id: i64,
    pub name: String,
    pub description: String,
    pub creation_date: Timestamp,
    pub last_modification: Timestamp,
    #[model(remote = "Vec<Option<String>>")]
    pub tags: Tags,
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
        use database::tables::scenario_timetable;
        use database::tables::timetable_train_schedule_set;
        use database::tables::train_schedule;
        use diesel::dsl::count;
        use diesel::expression_methods::AggregateExpressionMethods as _;

        scenario_timetable::table
            .inner_join(timetable_train_schedule_set::table.on(
                timetable_train_schedule_set::timetable_id.eq(scenario_timetable::timetable_id),
            ))
            .inner_join(
                train_schedule::table.on(train_schedule::train_schedule_set_id
                    .eq(timetable_train_schedule_set::train_schedule_set_id)),
            )
            .filter(scenario_timetable::scenario_id.eq(self.id))
            .select(count(train_schedule::id).aggregate_distinct())
            .first(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
    }

    /// Returns the IDs of the timetables linked to this scenario, ordered by ID
    pub async fn timetable_ids(
        &self,
        conn: &mut DbConnection,
    ) -> Result<Vec<i64>, database::DatabaseError> {
        use database::tables::scenario_timetable::dsl;

        dsl::scenario_timetable
            .filter(dsl::scenario_id.eq(self.id))
            .select(dsl::timetable_id)
            .order(dsl::timetable_id.asc())
            .load(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
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
                .last_modification(Timestamp::now())
                .update(&mut conn, id)
                .await?;

            Ok(Ok(t))
        })
        .await
    }
}

#[cfg(any(test, feature = "testing"))]
impl Scenario {
    pub fn fake(name: impl Into<String>, study_id: i64, infra_id: i64) -> Changeset<Self> {
        Self::changeset()
            .name(name.into())
            .description(String::new())
            .creation_date(Timestamp::now())
            .last_modification(Timestamp::now())
            .tags(Tags::default())
            .study_id(study_id)
            .infra_id(infra_id)
    }
}
