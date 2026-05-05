use std::collections::HashMap;
use std::ops::DerefMut;

use database::DbConnection;
use editoast_derive::Model;
use itertools::Itertools;
use schemas::paced_train::PacedTrainException;
use schemas::train_schedule_exception::TrainScheduleExceptionChangeGroups;

use crate::prelude::*;

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

#[cfg(any(test, feature = "testing"))]
impl TrainScheduleException {
    pub fn fixture_created(key: &str, occurrence_index: Option<i64>) -> Self {
        Self {
            id: 1,
            disabled: false,
            key: Some(key.into()),
            occurrence_index,
            timetable_id: 1,
            train_schedule_id: 1,
            change_groups: TrainScheduleExceptionChangeGroups::fixture_created(),
        }
    }

    pub fn fixture_modified(key: &str, occurrence_index: i64) -> Self {
        Self {
            id: 1,
            disabled: false,
            key: Some(key.into()),
            occurrence_index: Some(occurrence_index),
            timetable_id: 1,
            train_schedule_id: 1,
            change_groups: TrainScheduleExceptionChangeGroups::fixture_modified(),
        }
    }
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

impl TrainScheduleException {
    pub async fn retrieve_exceptions_by_train_schedules(
        conn: &mut DbConnection,
        timetable_id: i64,
        train_schedules_ids: &Vec<i64>,
    ) -> Result<Vec<TrainScheduleException>, crate::Error> {
        let train_schedules_ids_for_settings = train_schedules_ids.clone();
        let exceptions_settings = SelectionSettings::new()
            .filter(move || TrainScheduleException::TIMETABLE_ID.eq(timetable_id))
            .filter(move || {
                TrainScheduleException::TRAIN_SCHEDULE_ID
                    .eq_any(train_schedules_ids_for_settings.clone())
            });

        let mut exceptions_map: HashMap<i64, Vec<TrainScheduleException>> =
            Self::list(conn, exceptions_settings)
                .await?
                .into_iter()
                .into_group_map_by(|e| e.train_schedule_id);

        let exceptions = train_schedules_ids
            .into_iter()
            .flat_map(|id| exceptions_map.remove(&id).unwrap_or_default())
            .collect();

        Ok(exceptions)
    }

    pub async fn delete_exceptions_for_train_schedule(
        conn: &mut DbConnection,
        train_schedule_id: i64,
    ) -> Result<usize, crate::Error> {
        use database::tables::train_schedule_exception::dsl;
        use diesel::prelude::*;
        use diesel_async::RunQueryDsl;

        let deleted = diesel::delete(
            dsl::train_schedule_exception.filter(dsl::train_schedule_id.eq(train_schedule_id)),
        )
        .execute(conn.write().await.deref_mut())
        .await?;

        Ok(deleted)
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
