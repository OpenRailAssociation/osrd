use database::DbConnection;
use editoast_derive::Model;
use std::ops::DerefMut;

#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[model(table = database::tables::train_schedule_linking)]
#[model(gen(ops = c, batch_ops = crd, list))]
pub struct TrainScheduleLinking {
    pub id: i64,
    pub timetable_id: i64,
    pub source_train_schedule_id: i64,
    pub source_occurrence_index: Option<i64>,
    pub source_added_exception_id: Option<i64>,
    pub source_train_schedule_instance_index: Option<i64>,
    pub target_train_schedule_id: i64,
    pub target_occurrence_index: Option<i64>,
    pub target_added_exception_id: Option<i64>,
    pub target_train_schedule_instance_index: Option<i64>,
}

impl TrainScheduleLinking {
    pub async fn delete_linkings_for_train_schedule(
        conn: &mut DbConnection,
        train_schedule_id: i64,
    ) -> Result<usize, crate::Error> {
        use database::tables::train_schedule_linking::dsl;
        use diesel::prelude::*;
        use diesel_async::RunQueryDsl;

        let deleted = diesel::delete(
            dsl::train_schedule_linking.filter(
                dsl::source_train_schedule_id
                    .eq(train_schedule_id)
                    .or(dsl::target_train_schedule_id.eq(train_schedule_id)),
            ),
        )
        .execute(conn.write().await.deref_mut())
        .await?;

        Ok(deleted)
    }
}
