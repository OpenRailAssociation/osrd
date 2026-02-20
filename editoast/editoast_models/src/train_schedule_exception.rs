use editoast_derive::Model;
use schemas::train_schedule_exception::TrainScheduleExceptionChangeGroups;

use crate as editoast_models;

#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[model(table = database::tables::train_schedule_exception)]
#[model(gen(ops = cud, batch_ops = c, list))]
pub struct TrainScheduleException {
    pub id: i64,
    pub key: Option<String>,
    pub timetable_id: i64,
    pub train_schedule_id: i64,
    pub occurrence_index: Option<i64>,
    pub disabled: bool,
    #[model(json)]
    pub change_groups: TrainScheduleExceptionChangeGroups,
}

impl From<TrainScheduleException> for schemas::TrainScheduleException {
    fn from(train_schedule_exception: TrainScheduleException) -> Self {
        Self {
            id: train_schedule_exception.id,
            key: train_schedule_exception.key,
            timetable_id: train_schedule_exception.timetable_id,
            train_schedule_id: train_schedule_exception.train_schedule_id,
            occurrence_index: train_schedule_exception.occurrence_index,
            disabled: train_schedule_exception.disabled,
            change_groups: train_schedule_exception.change_groups,
        }
    }
}
