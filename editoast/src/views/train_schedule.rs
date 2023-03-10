use serde::Serialize;

use crate::models::TrainSchedule;

#[derive(Serialize, Debug, PartialEq)]
pub struct TrainScheduleDetails {
    pub id: i64,
    pub train_name: String,
    pub departure_time: f64,
    pub train_path: i64,
}

impl From<TrainSchedule> for TrainScheduleDetails {
    fn from(value: TrainSchedule) -> Self {
        TrainScheduleDetails {
            id: value.id,
            train_name: value.train_name.clone(),
            departure_time: value.departure_time,
            train_path: value.path_id,
        }
    }
}
