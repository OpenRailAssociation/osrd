use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use std::ops::DerefMut;
use utoipa::ToSchema;

use database::DbConnection;

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
        use database::tables::paced_train::dsl;

        dsl::paced_train
            .filter(dsl::train_schedule_set_id.eq(train_schedule_set_id))
            .count()
            .get_result(conn.write().await.deref_mut())
            .await
            .map_err(Into::into)
    }
}
