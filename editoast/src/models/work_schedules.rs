use std::cmp::max;

use chrono::DateTime;
use chrono::Utc;
use editoast_derive::Model;
use editoast_schemas::infra::TrackRange;
use strum::FromRepr;

use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use crate::core::stdcm::UndirectedTrackRange;

#[derive(Debug, Clone, Model)]
#[model(table = editoast_models::tables::work_schedule_group)]
#[model(gen(ops = crd, batch_ops = c, list))]
pub struct WorkScheduleGroup {
    pub id: i64,
    pub creation_date: DateTime<Utc>,
    pub name: String,
}

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, FromRepr, ToSchema, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum WorkScheduleType {
    #[default]
    Catenary,
    Track,
}

#[derive(Debug, Default, Clone, Model, Serialize, Deserialize, ToSchema)]
#[model(table = editoast_models::tables::work_schedule)]
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
    ) -> Option<crate::core::stdcm::WorkSchedule> {
        let search_window_duration =
            (latest_simulation_end - earliest_departure_time).num_milliseconds() as u64;

        let start_time = elapsed_time_since_ms(&self.start_date_time, &earliest_departure_time);
        let end_time = elapsed_time_since_ms(&self.end_date_time, &earliest_departure_time);

        if end_time == 0 || start_time >= search_window_duration {
            return None;
        }

        Some(crate::core::stdcm::WorkSchedule {
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
