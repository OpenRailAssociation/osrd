use editoast_derive::Model;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Deserialize, Serialize, ToSchema, Debug, Clone, Model)]
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
