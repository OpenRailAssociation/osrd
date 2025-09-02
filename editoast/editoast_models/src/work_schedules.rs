use std::cmp::max;

use chrono::DateTime;
use chrono::Utc;
use core_client::stdcm::UndirectedTrackRange;
use editoast_derive::Model;
use schemas::infra::TrackRange;
use serde::Deserialize;
use serde::Serialize;
use strum::FromRepr;
use utoipa::ToSchema;

use crate as editoast_models;

#[derive(Debug, Clone, Model)]
#[model(table = database::tables::work_schedule_group)]
#[model(gen(ops = crd, batch_ops = c, list))]
#[model(error(create = WsGroupError, update = WsGroupError))]
pub struct WorkScheduleGroup {
    pub id: i64,
    pub creation_date: DateTime<Utc>,
    pub name: String,
}

#[derive(Debug, thiserror::Error)]
#[cfg_attr(test, derive(PartialEq))]
pub enum WsGroupError {
    #[error("Work schedule group name already used: {name}")]
    NameAlreadyUsed { name: String },
    #[error(transparent)]
    Database(crate::Error),
}

impl From<crate::Error> for WsGroupError {
    fn from(e: crate::Error) -> Self {
        match e {
            crate::Error::UniqueViolation {
                constraint,
                column,
                value,
            } if constraint == "work_schedule_group_name_key" && column == "name" => {
                Self::NameAlreadyUsed { name: value }
            }
            e => Self::Database(e),
        }
    }
}

#[editoast_derive::openapi_schema]
#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, FromRepr, ToSchema, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WorkScheduleType {
    #[default]
    Catenary,
    Track,
}

#[editoast_derive::openapi_schema]
#[derive(Debug, Default, Clone, Model, Serialize, Deserialize, ToSchema)]
#[model(table = database::tables::work_schedule)]
#[model(gen(batch_ops = c, list))]
pub struct WorkSchedule {
    pub id: i64,
    pub start_date_time: DateTime<Utc>,
    pub end_date_time: DateTime<Utc>,
    #[model(json)]
    pub track_ranges: Vec<TrackRange>,
    pub obj_id: String,
    #[model(to_enum)]
    pub work_schedule_type: WorkScheduleType,
    pub work_schedule_group_id: i64,
}

impl WorkSchedule {
    pub fn as_core_work_schedule(
        &self,
        earliest_departure_time: DateTime<Utc>,
        latest_simulation_end: DateTime<Utc>,
    ) -> Option<core_client::stdcm::WorkSchedule> {
        let search_window_duration =
            (latest_simulation_end - earliest_departure_time).num_milliseconds() as u64;

        let start_time = elapsed_time_since_ms(&self.start_date_time, &earliest_departure_time);
        let end_time = elapsed_time_since_ms(&self.end_date_time, &earliest_departure_time);

        if end_time == 0 || start_time >= search_window_duration {
            return None;
        }

        Some(core_client::stdcm::WorkSchedule {
            start_time,
            end_time,
            track_ranges: self
                .track_ranges
                .iter()
                .map(|track| UndirectedTrackRange {
                    track_section: track.track.to_string(),
                    begin: (track.begin * 1000.0) as u64,
                    end: (track.end * 1000.0) as u64,
                })
                .collect(),
        })
    }
}

fn elapsed_time_since_ms(time: &DateTime<Utc>, since: &DateTime<Utc>) -> u64 {
    max(0, (*time - since).num_milliseconds()) as u64
}
