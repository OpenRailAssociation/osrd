use chrono::DateTime;
use chrono::Utc;
use editoast_derive::Model;

#[derive(Debug, Clone, Model)]
#[model(table = editoast_models::tables::reference_schedule)]
#[model(gen(batch_ops = c, list))]
pub struct ReferenceSchedule {
    pub id: i64,
    pub train_schedule: i64,
    pub name: String,
    pub start_date: DateTime<Utc>,
    pub traction_engine: String,
    pub towed_rolling_stock: Option<String>,
    pub speed_limit_tag: Option<String>,
    pub weight: Option<i64>,
    pub stop_points_ci: Vec<Option<i64>>,
    #[model(json)]
    pub waypoints: Vec<Waypoint>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Waypoint {
    pub ci: i64,
    pub ch: Option<String>,
    pub stop: bool,
}
