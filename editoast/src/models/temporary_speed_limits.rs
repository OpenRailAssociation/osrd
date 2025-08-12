use chrono::DateTime;
use chrono::Utc;
use database::tables::temporary_speed_limit;
use database::tables::temporary_speed_limit_group;
use editoast_derive::Model;
use editoast_models::model;
use editoast_schemas::infra::DirectionalTrackRange;
use serde::Serialize;

#[derive(Debug, Clone, Model)]
#[model(table = temporary_speed_limit_group, error = TslGroupError)]
#[model(gen(ops = crd, batch_ops = c, list))]
pub struct TemporarySpeedLimitGroup {
    pub id: i64,
    pub creation_date: DateTime<Utc>,
    pub name: String,
}

#[derive(Debug, thiserror::Error)]
pub enum TslGroupError {
    #[error("Temporary speed limit group name already used: {name}")]
    NameAlreadyUsed { name: String },
    #[error(transparent)]
    Database(model::Error),
}

impl From<model::Error> for TslGroupError {
    fn from(e: model::Error) -> Self {
        match e {
            model::Error::UniqueViolation {
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

// temporary
impl crate::error::EditoastError for TslGroupError {
    fn get_status(&self) -> axum::http::StatusCode {
        match self {
            Self::NameAlreadyUsed { .. } => axum::http::StatusCode::BAD_REQUEST,
            Self::Database(e) => e.get_status(),
        }
    }

    fn get_type(&self) -> &str {
        "editoast:TslGroupError"
    }
}

#[derive(Debug, Serialize, Clone, Model)]
#[model(table = temporary_speed_limit, error(write = Error))]
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

#[derive(Debug, thiserror::Error)]
#[error(transparent)]
pub struct Error(#[from] model::Error);

// temporary
impl crate::error::EditoastError for Error {
    fn get_status(&self) -> axum::http::StatusCode {
        self.0.get_status()
    }

    fn get_type(&self) -> &str {
        self.0.get_type()
    }
}

impl From<TemporarySpeedLimit> for core_client::stdcm::TemporarySpeedLimit {
    fn from(value: TemporarySpeedLimit) -> Self {
        core_client::stdcm::TemporarySpeedLimit {
            speed_limit: value.speed_limit,
            track_ranges: value
                .track_ranges
                .into_iter()
                .map(|track_range| track_range.into())
                .collect(),
        }
    }
}
