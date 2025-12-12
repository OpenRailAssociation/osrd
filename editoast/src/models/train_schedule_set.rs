use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Deserialize, Serialize, ToSchema)]
pub struct TrainScheduleSet {
    pub id: i64,
    pub catalogue_entry_id: Option<i64>,
    pub name: Option<String>,
    pub description: String,
    pub published: bool,
}
