use std::collections::HashMap;
use std::fmt::Display;

use axum::http::StatusCode;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde_json::Value;
use thiserror::Error;
use tracing::error;

use super::mq_client::MqClientError;

#[allow(clippy::enum_variant_names)]
#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "coreclient")]
pub enum CoreError {
    #[error("Cannot parse Core response: {msg}")]
    #[editoast_error(status = 500)]
    CoreResponseFormatError { msg: String },

    #[error("Core returned an error in an unknown format")]
    UnparsableErrorOutput,

    #[error("Core connection broken. Should retry.")]
    #[editoast_error(status = 500)]
    BrokenPipe,

    #[error(transparent)]
    #[editoast_error(status = "500")]
    MqClientError(MqClientError),

    #[cfg(test)]
    #[error("The mocked response had no body configured - check out StubResponseBuilder::body if this is unexpected")]
    NoResponseContent,
}

#[derive(Debug, Deserialize)]
pub struct StandardCoreError {
    #[serde(skip)]
    pub status: StatusCode,
    #[serde(rename = "type")]
    pub error_type: String,
    pub context: HashMap<String, Value>,
    pub message: String,
    #[serde(default = "CoreErrorCause::default")]
    pub cause: CoreErrorCause,
}

#[derive(Debug, Deserialize, Default)]
pub enum CoreErrorCause {
    #[default]
    Internal,
    User,
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
