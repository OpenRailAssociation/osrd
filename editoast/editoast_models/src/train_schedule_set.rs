use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use serde::Deserialize;
use serde::Serialize;
use std::ops::DerefMut;
use utoipa::ToSchema;

use database::DbConnection;
use editoast_derive::Model;

use crate::prelude::*;

use crate as editoast_models;

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
}

impl TrainScheduleSet {
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
