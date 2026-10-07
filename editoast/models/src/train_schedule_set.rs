use diesel::prelude::*;
#[expect(
    clippy::unused_trait_names,
    reason = "if not in scope, collides with `diesel::prelude::RunQueryDsl`"
)]
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;
use std::ops::DerefMut as _;
use utoipa::ToSchema;

use database::DbConnection;
use editoast_derive::Model;

use crate::prelude::*;
use crate::timetable_type::TimetableType;

#[derive(Deserialize, Serialize, ToSchema, Debug, Clone, PartialEq, Model)]
#[model(table = database::tables::train_schedule_set)]
#[model(gen(ops = crud, batch_ops = crud, list))]
#[model(row(derive(diesel::QueryableByName)))]
pub struct TrainScheduleSet {
    pub id: i64,
    pub catalog_entry_id: Option<i64>,
    pub name: Option<String>,
    pub description: String,
    pub published: bool,
    pub timetable_type: TimetableType,
    pub timetable_id: i64,
}

impl TrainScheduleSet {
    /// Creates a train schedule set along with its timetable, of the type of the set (CALENDAR by default)
    pub async fn create_with_timetable(
        conn: &mut DbConnection,
        changeset: Changeset<Self>,
    ) -> Result<Self, crate::Error> {
        use database::tables::timetable;

        let timetable_type = changeset.timetable_type.clone().unwrap_or_default();

        conn.transaction(async move |mut conn| {
            let timetable = crate::Timetable::changeset()
                .timetable_type(timetable_type.clone())
                .create(&mut conn)
                .await?;
            let train_schedule_set = changeset
                .timetable_type(timetable_type)
                .timetable_id(timetable.id)
                .create(&mut conn)
                .await?;
            diesel::update(timetable::table.find(timetable.id))
                .set(timetable::train_schedule_set_id.eq(train_schedule_set.id))
                .execute(conn.write().await.deref_mut())
                .await?;
            Ok(train_schedule_set)
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

    /// Deletes train schedule sets that are not published or linked to a timetable
    pub async fn delete_orphaned(conn: &mut DbConnection) -> Result<usize, crate::Error> {
        use database::tables::timetable_train_schedule_set::dsl as tt_dsl;
        use database::tables::train_schedule_set::dsl as tss_dsl;

        let max_to_delete_per_batch = 10;
        let mut total_deleted = 0;

        loop {
            let deleted_count = conn
                .transaction(async move |mut conn| -> Result<usize, crate::Error> {
                    let ids_to_delete: Vec<i64> = tss_dsl::train_schedule_set
                        .filter(
                            tss_dsl::published.eq(false).and(
                                tss_dsl::id.ne_all(
                                    tt_dsl::timetable_train_schedule_set
                                        .select(tt_dsl::train_schedule_set_id),
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
    use database::DbConnectionPoolV2;
    use pretty_assertions::assert_eq;

    use super::TrainScheduleSet;
    use crate::Timetable;
    use crate::prelude::*;
    use crate::timetable_type::TimetableType;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn train_schedule_set_has_its_own_timetable() {
        let pool = DbConnectionPoolV2::for_tests();

        let train_schedule_set = TrainScheduleSet::create_with_timetable(
            &mut pool.get_ok(),
            TrainScheduleSet::changeset().timetable_type(TimetableType(
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
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn deleting_a_train_schedule_set_deletes_its_timetable() {
        let pool = DbConnectionPoolV2::for_tests();
        let train_schedule_set = TrainScheduleSet::create_with_timetable(
            &mut pool.get_ok(),
            TrainScheduleSet::changeset(),
        )
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
}
