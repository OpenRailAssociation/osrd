use database::DatabaseError;
use database::tables::sql_types;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::Array;
use diesel::sql_types::BigInt;
#[expect(
    clippy::unused_trait_names,
    reason = "if not in scope, collides with `diesel::prelude::RunQueryDsl`"
)]
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use itertools::Itertools as _;
use std::collections::HashSet;
use std::ops::DerefMut as _;
use unit_system::quantities::Offset;
use unit_system::units::millisecond;

use database::DbConnection;

use crate::TimetableInheritance;
use crate::timetable_type::TimetableType;

#[derive(Debug, Default, Clone, Model)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[model(table = database::tables::timetable)]
#[model(gen(ops = crud, list))]
pub struct Timetable {
    pub id: i64,
    pub timetable_type: TimetableType,
    pub train_schedule_set_id: Option<i64>,
    /// Whether this timetable is the one of a train schedule set
    pub is_train_schedule_set: bool,
    pub catalog_entry_id: Option<i64>,
    pub name: Option<String>,
    pub description: String,
    pub published: bool,
}

impl From<Timetable> for Option<i64> {
    fn from(timetable: Timetable) -> Self {
        Some(timetable.id)
    }
}

impl Timetable {
    pub async fn train_schedules_count(
        timetable_id: i64,
        conn: &mut DbConnection,
    ) -> Result<i64, database::DatabaseError> {
        use database::tables::timetable_inheritance;
        use database::tables::train_schedule;
        use database::tables::train_schedule_set;

        train_schedule::dsl::train_schedule
            .filter(
                train_schedule::train_schedule_set_id.eq_any(
                    train_schedule_set::table
                        .filter(
                            train_schedule_set::timetable_id.eq_any(
                                timetable_inheritance::table
                                    .filter(
                                        timetable_inheritance::outer_timetable_id.eq(timetable_id),
                                    )
                                    .select(timetable_inheritance::inner_timetable_id),
                            ),
                        )
                        .select(train_schedule_set::id),
                ),
            )
            .count()
            .get_result(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
    }

    pub async fn get_train_schedule_set_ids_from_timetable(
        timetable_id: i64,
        conn: &mut DbConnection,
    ) -> Result<Vec<i64>, database::DatabaseError> {
        use database::tables::timetable_inheritance;
        use database::tables::train_schedule_set;

        train_schedule_set::table
            .filter(
                train_schedule_set::timetable_id.eq_any(
                    timetable_inheritance::table
                        .filter(timetable_inheritance::outer_timetable_id.eq(timetable_id))
                        .select(timetable_inheritance::inner_timetable_id),
                ),
            )
            .select(train_schedule_set::id)
            .load(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
    }

    pub async fn gather_start_times(
        timetable_id: i64,
        conn: &mut DbConnection,
    ) -> Result<Vec<Offset>, database::DatabaseError> {
        use database::tables::timetable_inheritance;
        use database::tables::train_schedule;
        use database::tables::train_schedule_set;

        let start_times_milliseconds = train_schedule::dsl::train_schedule
            .select(train_schedule::dsl::start_time)
            .filter(
                train_schedule::train_schedule_set_id.eq_any(
                    train_schedule_set::table
                        .filter(
                            train_schedule_set::timetable_id.eq_any(
                                timetable_inheritance::table
                                    .filter(
                                        timetable_inheritance::outer_timetable_id.eq(timetable_id),
                                    )
                                    .select(timetable_inheritance::inner_timetable_id),
                            ),
                        )
                        .select(train_schedule_set::id),
                ),
            )
            .load(conn.write().await.deref_mut())
            .await
            .map_err(database::DatabaseError::from)?;
        Ok(start_times_milliseconds
            .into_iter()
            .map(|s| millisecond::i64::new(s))
            .collect())
    }

    pub async fn set_included_train_schedule_sets(
        timetable_id: i64,
        train_schedule_set_ids: HashSet<i64>,
        conn: &mut DbConnection,
    ) -> Result<(), crate::Error> {
        use crate::prelude::*;
        use database::tables::timetable;
        use database::tables::timetable_inheritance::dsl;
        use database::tables::train_schedule_set;

        // Transaction to ensure consistency of modifications
        conn.transaction(async move |mut conn| {
            // 1. Retrieve the timetables of the train schedule sets
            let new_inner_timetable_ids: HashSet<i64> = train_schedule_set::table
                .filter(train_schedule_set::id.eq_any(train_schedule_set_ids))
                .select(train_schedule_set::timetable_id)
                .load(conn.write().await.deref_mut())
                .await?
                .into_iter()
                .collect();

            // 2. Retrieve the current inclusions of train schedule sets, leaving other inclusions untouched
            let existing_inner_timetable_ids: HashSet<i64> = dsl::timetable_inheritance
                .filter(dsl::outer_timetable_id.eq(timetable_id))
                .filter(
                    dsl::inner_timetable_id.eq_any(
                        timetable::table
                            .filter(timetable::is_train_schedule_set.eq(true))
                            .select(timetable::id),
                    ),
                )
                .select(dsl::inner_timetable_id)
                .load(conn.write().await.deref_mut())
                .await?
                .into_iter()
                .collect();

            // 3. Delete only the inclusions that are NOT in the new list
            let inclusions_to_delete =
                existing_inner_timetable_ids.difference(&new_inner_timetable_ids);
            diesel::delete(
                dsl::timetable_inheritance
                    .filter(dsl::outer_timetable_id.eq(timetable_id))
                    .filter(dsl::inner_timetable_id.eq_any(inclusions_to_delete)),
            )
            .execute(conn.write().await.deref_mut())
            .await?;

            // 4. Create missing inclusions
            let changesets = new_inner_timetable_ids
                .difference(&existing_inner_timetable_ids)
                .map(|inner_timetable_id| {
                    TimetableInheritance::changeset()
                        .outer_timetable_id(timetable_id)
                        .inner_timetable_id(*inner_timetable_id)
                })
                .collect_vec();
            let _: Vec<_> = TimetableInheritance::create_batch(&mut conn, changesets).await?;
            Ok(())
        })
        .await
    }

    /// Deletes timetables that are not referenced by any Scenario or StdcmSearchEnvironment
    /// Returns the number of deleted timetables
    pub async fn delete_orphaned(
        conn: &mut DbConnection,
    ) -> Result<usize, database::DatabaseError> {
        use database::tables::scenario::dsl as scenario_dsl;
        use database::tables::search_journey_environment_timetable::dsl as timetable_search_journey_env_dsl;
        use database::tables::stdcm_search_environment::dsl as stdcm_dsl;
        use database::tables::timetable::dsl as timetable_dsl;

        diesel::delete(timetable_dsl::timetable)
            .filter(timetable_dsl::is_train_schedule_set.eq(false))
            .filter(diesel::dsl::not(diesel::dsl::exists(
                scenario_dsl::scenario.filter(scenario_dsl::timetable_id.eq(timetable_dsl::id)),
            )))
            .filter(diesel::dsl::not(diesel::dsl::exists(
                stdcm_dsl::stdcm_search_environment
                    .filter(stdcm_dsl::timetable_id.eq(timetable_dsl::id)),
            )))
            .filter(diesel::dsl::not(diesel::dsl::exists(
                timetable_search_journey_env_dsl::search_journey_environment_timetable
                    .filter(timetable_search_journey_env_dsl::timetable_id.eq(timetable_dsl::id)),
            )))
            .execute(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
    }
}

/// Should be used to retrieve a timetable with its paced trains
#[derive(Debug, Clone, QueryableByName)]
pub struct TimetableWithTrains {
    #[diesel(sql_type = BigInt)]
    pub id: i64,
    #[diesel(sql_type = sql_types::TimetableType)]
    pub timetable_type: TimetableType,
    #[diesel(sql_type = Array<BigInt>)]
    pub paced_train_ids: Vec<i64>,
}

impl TimetableWithTrains {
    pub async fn retrieve(
        conn: DbConnection,
        timetable_id: i64,
    ) -> Result<Option<Self>, DatabaseError> {
        let result = sql_query(
            "SELECT timetable.*,
        array_remove(array_agg(train_schedule.id), NULL) as paced_train_ids
        FROM timetable
        LEFT JOIN timetable_inheritance ON timetable.id = timetable_inheritance.outer_timetable_id
        LEFT JOIN train_schedule_set ON timetable_inheritance.inner_timetable_id = train_schedule_set.timetable_id
        LEFT JOIN train_schedule ON train_schedule_set.id = train_schedule.train_schedule_set_id
        WHERE timetable.id = $1
        GROUP BY timetable.id",
        )
        .bind::<BigInt, _>(timetable_id)
        .get_result::<TimetableWithTrains>(conn.write().await.deref_mut())
        .await;
        match result {
            Ok(result) => Ok(Some(result)),
            Err(diesel::result::Error::NotFound) => Ok(None),
            Err(err) => Err(err.into()),
        }
    }

    pub async fn retrieve_or_fail<E, F>(conn: DbConnection, id: i64, fail: F) -> Result<Self, E>
    where
        E: From<DatabaseError>,
        F: FnOnce() -> E + Send,
    {
        match Self::retrieve(conn, id).await {
            Ok(Some(obj)) => Ok(obj),
            Ok(None) => Err(fail()),
            Err(e) => Err(E::from(e)),
        }
    }
}
