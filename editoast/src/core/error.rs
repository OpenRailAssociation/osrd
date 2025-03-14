use std::collections::HashMap;
use std::fmt::Display;

use axum::http::StatusCode;
use editoast_common::default_status_code;
use editoast_common::StatusCodeRemoteDef;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use thiserror::Error;
use tracing::error;
use utoipa::ToSchema;

use super::client::CoreResponse;
use super::client::Json;
use super::mq_client::MqClientError;

editoast_common::schemas! {
    StandardCoreError,
}

#[allow(clippy::enum_variant_names)]
#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Cannot parse Core response: {msg}")]
    CoreResponseFormatError { msg: String },

    #[error("Core returned an error in an unknown format")]
    UnparsableErrorOutput,

    #[error("Core connection broken. Should retry.")]
    BrokenPipe,

    #[error(transparent)]
    MqClientError(MqClientError),

    #[cfg(test)]
    #[error("The mocked response had no body configured - check out StubResponseBuilder::body if this is unexpected")]
    NoResponseContent,
}

impl From<CoreError> for StandardCoreError {
    fn from(error: CoreError) -> Self {
        let status = match error {
            CoreError::UnparsableErrorOutput => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };
        let error_type = match error {
            CoreError::CoreResponseFormatError { .. } => {
                "editoast:coreclient:CoreResponseFormatError".to_string()
            }
            CoreError::UnparsableErrorOutput => {
                "editoast:coreclient:UnparsableErrorOutput".to_string()
            }
            CoreError::BrokenPipe => "editoast:coreclient:BrokenPipe".to_string(),
            CoreError::MqClientError(_) => "editoast:coreclient:MqClientError".to_string(),
            #[cfg(test)]
            CoreError::NoResponseContent => "editoast:coreclient:NoResponseContent".to_string(),
        };
        let context = match error {
            CoreError::CoreResponseFormatError { ref msg } => {
                [("msg".to_string(), serde_json::to_value(msg).unwrap())].into()
            }
            _ => Default::default(),
        };
        Self {
            status,
            error_type,
            context,
            message: error.to_string(),
            cause: Default::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq)]
pub struct StandardCoreError {
    #[serde(with = "StatusCodeRemoteDef", default = "default_status_code")]
    #[schema(value_type = u16, minimum = 100, maximum = 599)]
    pub status: StatusCode,
    #[serde(rename = "type")]
    pub error_type: String,
    pub context: HashMap<String, Value>,
    pub message: String,
    #[serde(default = "CoreErrorCause::default")]
    #[serde(skip_serializing)]
    pub cause: CoreErrorCause,
}

#[derive(Debug, Deserialize, Default, PartialEq, Clone)]
pub enum CoreErrorCause {
    #[default]
    Internal,
    User,
}

impl StandardCoreError {
    pub fn parse(bytes: &[u8], url: String) -> Self {
        // We try to deserialize the response as an StandardCoreError in order to retain the context of the core error
        if let Ok(mut standard_core_error) = <Json<StandardCoreError>>::from_bytes(bytes) {
            standard_core_error.status = match standard_core_error.cause {
                CoreErrorCause::Internal => StatusCode::INTERNAL_SERVER_ERROR,
                CoreErrorCause::User => StatusCode::BAD_REQUEST,
            };
            standard_core_error
                .context
                .insert("url".to_owned(), url.into());
            return standard_core_error;
        }

        let mut standard_core_error: StandardCoreError = CoreError::UnparsableErrorOutput.into();
        standard_core_error
            .context
            .insert("url".to_owned(), url.into());
        standard_core_error.status = StatusCode::INTERNAL_SERVER_ERROR;
        standard_core_error
    }
}

impl crate::error::EditoastError for StandardCoreError {
    fn get_type(&self) -> &str {
        &self.error_type
    }

    fn get_status(&self) -> StatusCode {
        self.status
    }

    fn context(&self) -> HashMap<String, Value> {
        self.context.clone()
    }
}

impl std::error::Error for StandardCoreError {}

impl Display for StandardCoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}
