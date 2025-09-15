use chrono::DateTime;
use chrono::Utc;
use editoast_derive::Model;
use schemas::infra::DirectionalTrackRange;
use serde::Serialize;

use crate as editoast_models; // HACK: remove when all models are in this crate

#[derive(Debug, Clone, Model)]
#[model(table = database::tables::temporary_speed_limit_group)]
#[model(gen(ops = crd, batch_ops = c, list))]
#[model(error(create = TslGroupError, update = TslGroupError))]
pub struct TemporarySpeedLimitGroup {
    pub id: i64,
    pub creation_date: DateTime<Utc>,
    pub name: String,
}

#[derive(Debug, thiserror::Error)]
#[cfg_attr(test, derive(PartialEq))]
pub enum TslGroupError {
    #[error("Temporary speed limit group name already used: {name}")]
    NameAlreadyUsed { name: String },
    #[error(transparent)]
    Database(crate::Error),
}

impl From<crate::Error> for TslGroupError {
    fn from(e: crate::Error) -> Self {
        match e {
            crate::Error::UniqueViolation {
                constraint,
                column,
                value,
            } if constraint == "temporary_speed_limit_group_name_key" && column == "name" => {
                Self::NameAlreadyUsed { name: value }
            }
            e => Self::Database(e),
        }
    }
}

#[derive(Debug, Serialize, Clone, Model)]
#[model(table = database::tables::temporary_speed_limit)]
#[model(gen(ops = cr, batch_ops = c, list))]
pub struct TemporarySpeedLimit {
    pub id: i64,
    pub start_date_time: DateTime<Utc>,
    pub end_date_time: DateTime<Utc>,
    pub speed_limit: f64,
    #[model(json)]
    pub track_ranges: Vec<DirectionalTrackRange>,
    pub obj_id: String,
    pub temporary_speed_limit_group_id: i64,
}
