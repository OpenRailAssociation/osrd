use chrono::DateTime;
use chrono::Utc;
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

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize, FromRepr, ToSchema, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WorkScheduleType {
    #[default]
    Catenary,
    Track,
}

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::prelude::*;
    use database::DbConnectionPoolV2;

    #[tokio::test(flavor = "multi_thread")]
    async fn unique_group_name() {
        let db_pool = DbConnectionPoolV2::for_tests();

        WorkScheduleGroup::changeset()
            .name("UNIQUE_NAME".to_string())
            .creation_date(Utc::now())
            .create(&mut db_pool.get_ok())
            .await
            .unwrap();

        let result = WorkScheduleGroup::changeset()
            .name("UNIQUE_NAME".to_string())
            .creation_date(Utc::now())
            .create(&mut db_pool.get_ok())
            .await;

        match result {
            Err(WsGroupError::NameAlreadyUsed { name }) => {
                assert_eq!(name, "UNIQUE_NAME");
            }
            other => panic!("Expected NameAlreadyUsed error, got: {other:?}"),
        }
    }
}
