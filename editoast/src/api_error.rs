use diesel::result::Error as DieselError;
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::{json, Error as JsonError, Value as JsonValue};
use serde_json::{Map, Value};
use std::error::Error;

pub type ApiResult<T> = Result<T, EditoastError>;

#[derive(Debug, Responder)]
pub struct EditoastError(Custom<JsonValue>);

impl EditoastError {
    pub fn create(
        osrd_error_type: &'static str,
        message: String,
        status: Status,
        extra: Option<Map<String, Value>>,
    ) -> Self {
        let mut body = json!(
            {
            "osrd_error_type": osrd_error_type,
            "message": message,
            }
        );

        // Add extra fields if they exist
        if let Some(extra) = extra {
            body.as_object_mut().unwrap().extend(extra);
        }

        Self(Custom(status, body))
    }
}

pub trait ApiError: Error + Send + Sync {
    fn get_status(&self) -> Status;

    fn get_type(&self) -> &'static str;

    fn extra(&self) -> Option<Map<String, Value>> {
        None
    }
}

impl Error for Box<dyn ApiError> {}

impl From<DieselError> for EditoastError {
    fn from(err: DieselError) -> Self {
        Self::create(
            "editoast:DieselError",
            "An internal diesel error occurred".to_string(),
            Status::InternalServerError,
            json!({
                "diesel_message": err.to_string(),
            })
            .as_object()
            .cloned(),
        )
    }
}

impl<T: ApiError> From<T> for EditoastError {
    fn from(api_err: T) -> Self {
        Self::create(
            api_err.get_type(),
            api_err.to_string(),
            api_err.get_status(),
            api_err.extra(),
        )
    }
}

impl From<Box<dyn ApiError>> for EditoastError {
    fn from(api_err: Box<dyn ApiError>) -> Self {
        Self::create(
            api_err.get_type(),
            api_err.to_string(),
            api_err.get_status(),
            api_err.extra(),
        )
    }
}

impl<'f> From<JsonError<'f>> for EditoastError {
    fn from(err: JsonError<'f>) -> Self {
        let err_msg = match err {
            JsonError::Io(err) => err.to_string(),
            JsonError::Parse(_, err) => err.to_string(),
        };

        Self::create(
            "editoast:views:JsonError",
            err_msg,
            Status::UnprocessableEntity,
            None,
        )
    }
}

pub struct InfraLockedError {
    pub infra_id: i64,
}

impl From<InfraLockedError> for EditoastError {
    fn from(err: InfraLockedError) -> Self {
        Self::create(
            "editoast:operation:InfraLocked",
            "The infra is locked and cannot be edited".to_string(),
            Status::BadRequest,
            json!({
                "infra_id": err.infra_id,
            })
            .as_object()
            .cloned(),
        )
    }
}
