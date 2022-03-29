use rocket::http::Status;
use rocket::response::status::Custom;
use rocket_contrib::json::Json;
use serde::Serialize;
use std::error::Error;

pub type ApiResult<T> = Result<Json<T>, Custom<Json<ResultError>>>;

#[derive(Debug, Serialize)]
pub struct ResultError {
    osrd_error_type: &'static str,
    message: String,
}

pub trait ApiError: Error + Send + Sync {
    fn get_status(&self) -> Status;
    fn get_type(&self) -> &'static str;
}

impl Error for Box<dyn ApiError> {}

impl From<Box<dyn ApiError>> for Custom<Json<ResultError>> {
    fn from(api_err: Box<dyn ApiError>) -> Self {
        Custom(
            api_err.get_status(),
            Json(ResultError {
                osrd_error_type: api_err.get_type(),
                message: api_err.to_string(),
            }),
        )
    }
}
