use editoast_derive::Model;
use schemas::paced_train::PacedTrainException;
use schemas::train_schedule_exception::TrainScheduleExceptionChangeGroups;

use crate as editoast_models;

#[derive(Debug, Clone, Model)]
#[cfg_attr(test, derive(serde::Deserialize))]
#[model(table = database::tables::train_schedule_exception)]
#[model(gen(ops = crud, batch_ops = cd, list))]
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

impl From<TrainScheduleException> for PacedTrainException {
    fn from(train_schedule_exception: TrainScheduleException) -> Self {
        let exception_type = match train_schedule_exception.occurrence_index {
            Some(occurrence_index) => schemas::paced_train::ExceptionType::Modified {
                occurrence_index: occurrence_index as usize,
            },
            None => schemas::paced_train::ExceptionType::Created {},
        };
        Self {
            id: Some(train_schedule_exception.id),
            key: train_schedule_exception
                .key
                .unwrap_or_else(|| train_schedule_exception.id.to_string()),
            exception_type,
            disabled: train_schedule_exception.disabled,
            change_groups: train_schedule_exception.change_groups,
        }
    }
}
