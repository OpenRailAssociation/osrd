use diesel::prelude::*;
#[expect(
    clippy::unused_trait_names,
    reason = "if not in scope, collides with `diesel::prelude::RunQueryDsl`"
)]
use diesel_async::RunQueryDsl;
use itertools::Itertools as _;
use serde::Deserialize;
use serde::Serialize;
use std::ops::DerefMut as _;
use utoipa::ToSchema;

use database::DbConnection;
use editoast_derive::Model;

use crate::Timetable;
use crate::prelude::*;
use crate::timetable_type::TimetableType;

#[derive(Debug, Clone, PartialEq, Model)]
#[model(table = database::tables::train_schedule_set)]
#[model(gen(ops = crd, batch_ops = crd, list))]
pub struct TrainScheduleSet {
    pub id: i64,
    pub timetable_id: i64,
}

// Transition struct merging a train_schedule_set with the fields of its timetable
// TODO Remove once the migration of a train schedule set into a timetable is over.
#[derive(Deserialize, Serialize, ToSchema, Debug, Clone, PartialEq)]
#[schema(as = TrainScheduleSet)]
pub struct TrainScheduleSetWithTimetable {
    pub id: i64,
    pub catalog_entry_id: Option<i64>,
    pub name: Option<String>,
    pub description: String,
    pub published: bool,
    pub timetable_type: TimetableType,
    pub timetable_id: i64,
}

impl TrainScheduleSetWithTimetable {
    /// Returns `None` if the timetable is not the one of a train schedule set
    fn from_timetable(timetable: Timetable) -> Option<Self> {
        Some(Self {
            id: timetable.train_schedule_set_id?,
            catalog_entry_id: timetable.catalog_entry_id,
            name: timetable.name,
            description: timetable.description,
            published: timetable.published,
            timetable_type: timetable.timetable_type,
            timetable_id: timetable.id,
        })
    }

    pub async fn retrieve(
        conn: &mut DbConnection,
        train_schedule_set_id: i64,
    ) -> Result<Option<Self>, crate::Error> {
        let train_schedule_sets = Self::retrieve_batch(conn, vec![train_schedule_set_id]).await?;
        Ok(train_schedule_sets.into_iter().next())
    }

    /// Retrieves the train schedule sets of the given IDs, ignoring the missing ones
    pub async fn retrieve_batch(
        conn: &mut DbConnection,
        train_schedule_set_ids: Vec<i64>,
    ) -> Result<Vec<Self>, crate::Error> {
        let train_schedule_set_ids = train_schedule_set_ids.into_iter().map(Some).collect_vec();
        let settings = SelectionSettings::new().filter(move || {
            Timetable::TRAIN_SCHEDULE_SET_ID.eq_any(train_schedule_set_ids.clone())
        });
        Self::list(conn, settings).await
    }

    /// Lists the train schedule sets whose timetable matches the given settings
    pub async fn list(
        conn: &mut DbConnection,
        settings: SelectionSettings<Timetable>,
    ) -> Result<Vec<Self>, crate::Error> {
        let settings = settings.filter(|| Timetable::IS_TRAIN_SCHEDULE_SET.eq(true));
        let timetables = Timetable::list(conn, settings).await?;
        Ok(timetables
            .into_iter()
            .filter_map(Self::from_timetable)
            .collect())
    }

    /// Updates the timetable of a train schedule set, returns `None` if the set doesn't exist
    pub async fn update(
        conn: &mut DbConnection,
        train_schedule_set_id: i64,
        changeset: Changeset<Timetable>,
    ) -> Result<Option<Self>, crate::Error> {
        let Some(train_schedule_set) = Self::retrieve(conn, train_schedule_set_id).await? else {
            return Ok(None);
        };
        let timetable = changeset
            .update(conn, train_schedule_set.timetable_id)
            .await?;
        Ok(timetable.and_then(Self::from_timetable))
    }
}

impl TrainScheduleSet {
    /// Creates a train schedule set along with its timetable, which holds the fields of the set
    /// TODO Remove once the migration of a train schedule set into a timetable is over.
    pub async fn create_with_timetable(
        conn: &mut DbConnection,
        changeset: Changeset<Timetable>,
    ) -> Result<TrainScheduleSetWithTimetable, crate::Error> {
        use database::tables::timetable;

        conn.transaction(async move |mut conn| {
            let timetable = changeset
                .is_train_schedule_set(true)
                .create(&mut conn)
                .await?;
            let train_schedule_set = Self::changeset()
                .timetable_id(timetable.id)
                .create(&mut conn)
                .await?;
            diesel::update(timetable::table.find(timetable.id))
                .set(timetable::train_schedule_set_id.eq(train_schedule_set.id))
                .execute(conn.write().await.deref_mut())
                .await?;
            Ok(TrainScheduleSetWithTimetable {
                id: train_schedule_set.id,
                catalog_entry_id: timetable.catalog_entry_id,
                name: timetable.name,
                description: timetable.description,
                published: timetable.published,
                timetable_type: timetable.timetable_type,
                timetable_id: timetable.id,
            })
        })
        .await
    }

    pub async fn train_schedule_count(
        train_schedule_set_id: i64,
        conn: &mut DbConnection,
    ) -> Result<i64, database::DatabaseError> {
        use database::tables::train_schedule::dsl;

        dsl::train_schedule
            .filter(dsl::train_schedule_set_id.eq(train_schedule_set_id))
            .count()
            .get_result(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
    }

    /// Deletes train schedule sets that are not published or included in a timetable
    pub async fn delete_orphaned(conn: &mut DbConnection) -> Result<usize, crate::Error> {
        use database::tables::timetable::dsl as timetable_dsl;
        use database::tables::timetable_inheritance::dsl as inheritance_dsl;
        use database::tables::train_schedule_set::dsl as tss_dsl;

        let max_to_delete_per_batch = 10;
        let mut total_deleted = 0;

        loop {
            let deleted_count = conn
                .transaction(async move |mut conn| -> Result<usize, crate::Error> {
                    let ids_to_delete: Vec<i64> = tss_dsl::train_schedule_set
                        .filter(
                            tss_dsl::timetable_id
                                .eq_any(
                                    timetable_dsl::timetable
                                        .filter(timetable_dsl::published.eq(false))
                                        .select(timetable_dsl::id),
                                )
                                .and(
                                    tss_dsl::timetable_id.ne_all(
                                        inheritance_dsl::timetable_inheritance
                                            .select(inheritance_dsl::inner_timetable_id),
                                    ),
                                ),
                        )
                        .select(tss_dsl::id)
                        .limit(max_to_delete_per_batch)
                        .load(conn.write().await.deref_mut())
                        .await?;

                    if ids_to_delete.is_empty() {
                        return Ok(0);
                    }

                    // Delete the found train schedule sets
                    let count = Self::delete_batch(&mut conn, ids_to_delete).await?;

                    Ok(count)
                })
                .await?;

            if deleted_count == 0 {
                break;
            }

            total_deleted += deleted_count;
        }

        Ok(total_deleted)
    }
}

#[cfg(test)]
mod tests {
    use database::DbConnectionPool;
    use pretty_assertions::assert_eq;

    use super::TrainScheduleSet;
    use crate::Timetable;
    use crate::prelude::*;
    use crate::timetable_type::TimetableType;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_set_has_its_own_timetable() {
        let pool = DbConnectionPool::for_tests();

        let train_schedule_set = TrainScheduleSet::create_with_timetable(
            &mut pool.get_ok(),
            Timetable::changeset().timetable_type(TimetableType(
                schemas::timetable_type::TimetableType::Hourly,
            )),
        )
        .await
        .expect("Failed to create train schedule set");

        let timetable = Timetable::retrieve(pool.get_ok(), train_schedule_set.timetable_id)
            .await
            .expect("Failed to retrieve timetable")
            .expect("The train schedule set should have a timetable");
        assert_eq!(
            timetable.timetable_type,
            TimetableType(schemas::timetable_type::TimetableType::Hourly)
        );
        assert_eq!(timetable.train_schedule_set_id, Some(train_schedule_set.id));
        assert!(timetable.is_train_schedule_set);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn deleting_a_train_schedule_set_deletes_its_timetable() {
        let pool = DbConnectionPool::for_tests();
        let train_schedule_set =
            TrainScheduleSet::create_with_timetable(&mut pool.get_ok(), Timetable::changeset())
                .await
                .expect("Failed to create train schedule set");

        TrainScheduleSet::delete_static(&mut pool.get_ok(), train_schedule_set.id)
            .await
            .expect("Failed to delete train schedule set");

        let timetable_exists =
            Timetable::exists(&mut pool.get_ok(), train_schedule_set.timetable_id)
                .await
                .expect("Failed to check timetable existence");
        assert!(!timetable_exists);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn garbage_collection_keeps_the_train_schedule_sets_included_in_a_timetable() {
        let pool = DbConnectionPool::for_tests();
        let timetable = Timetable::changeset()
            .create(&mut pool.get_ok())
            .await
            .expect("Failed to create timetable");
        let linked_set =
            TrainScheduleSet::create_with_timetable(&mut pool.get_ok(), Timetable::changeset())
                .await
                .expect("Failed to create train schedule set");
        let orphan_set =
            TrainScheduleSet::create_with_timetable(&mut pool.get_ok(), Timetable::changeset())
                .await
                .expect("Failed to create train schedule set");
        Timetable::set_included_train_schedule_sets(
            timetable.id,
            std::collections::HashSet::from([linked_set.id]),
            &mut pool.get_ok(),
        )
        .await
        .expect("Failed to include train schedule set");

        TrainScheduleSet::delete_orphaned(&mut pool.get_ok())
            .await
            .expect("Failed to delete orphaned train schedule sets");

        assert!(
            TrainScheduleSet::exists(&mut pool.get_ok(), linked_set.id)
                .await
                .expect("Failed to check train schedule set existence")
        );
        assert!(
            !TrainScheduleSet::exists(&mut pool.get_ok(), orphan_set.id)
                .await
                .expect("Failed to check train schedule set existence")
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn timetable_is_train_schedule_set_is_immutable() {
        let pool = DbConnectionPool::for_tests();
        let train_schedule_set =
            TrainScheduleSet::create_with_timetable(&mut pool.get_ok(), Timetable::changeset())
                .await
                .expect("Failed to create train schedule set");

        let result = Timetable::changeset()
            .is_train_schedule_set(false)
            .update(&mut pool.get_ok(), train_schedule_set.timetable_id)
            .await;
        assert!(result.is_err());
    }
}
