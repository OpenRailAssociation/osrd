use actix_web::{error::JsonPayloadError, http::StatusCode, HttpResponse, ResponseError};
use diesel::result::Error as DieselError;
use redis::RedisError;
use serde::Serialize;
use serde_json::{json, Map, Value};
use std::result::Result as StdResult;
use std::{
    error::Error,
    fmt::{Display, Formatter},
};

pub type Result<T> = StdResult<T, InternalError>;

/// Trait for all errors that can be returned by editoast
pub trait EditoastError: Error + Send + Sync {
    fn get_status(&self) -> StatusCode;

    fn get_type(&self) -> &'static str;

    fn context(&self) -> Map<String, Value> {
        Default::default()
    }
}

#[derive(Debug, Serialize)]
pub struct InternalError {
    #[serde(skip)]
    status: StatusCode,
    error_type: &'static str,
    context: Map<String, Value>,
    message: String,
}

impl InternalError {
    pub fn get_type(&self) -> &'static str {
        self.error_type
    }

    pub fn get_status(&self) -> StatusCode {
        self.status
    }

    pub fn get_context(&self) -> &Map<String, Value> {
        &self.context
    }
}

impl Error for InternalError {}

impl Display for InternalError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl<T: EditoastError> From<T> for InternalError {
    fn from(err: T) -> Self {
        InternalError {
            status: err.get_status(),
            error_type: err.get_type(),
            context: err.context(),
            message: err.to_string(),
        }
    }
}

impl ResponseError for InternalError {
    fn status_code(&self) -> StatusCode {
        self.status
    }

    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status).json(self)
    }
}

/// Handle all diesel errors
impl EditoastError for DieselError {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &'static str {
        "editoast:DieselError"
    }
}

/// Handle all redis errors
impl EditoastError for RedisError {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &'static str {
        "editoast:RedisError"
    }
}

/// Handle all json errors
impl EditoastError for JsonPayloadError {
    fn get_status(&self) -> StatusCode {
        StatusCode::BAD_REQUEST
    }

    fn get_type(&self) -> &'static str {
        "editoast:JsonError"
    }

    fn context(&self) -> Map<String, Value> {
        json!({
            "cause": self.to_string(),
        })
        .as_object()
        .cloned()
        .unwrap()
    }
}
