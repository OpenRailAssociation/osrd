pub mod client;
pub mod conflict_detection;
pub mod infra_loading;
#[cfg(test)]
pub mod mocking;
pub mod mq_client;
pub mod path_properties;
pub mod pathfinding;
pub mod signal_projection;
pub mod simulation;
pub mod stdcm;
pub mod version;

use std::collections::HashMap;
use std::fmt::Display;

use axum::http::StatusCode;
use editoast_derive::EditoastError;
use mq_client::MqClientError;
use serde::Deserialize;
use serde_json::Value;
use thiserror::Error;
use tracing::error;

pub use client::CoreClient;
pub use mq_client::RabbitMQClient;

editoast_common::schemas! {
    simulation::schemas(),
    pathfinding::schemas(),
    conflict_detection::schemas(),
    stdcm::schemas(),
}

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
    status: StatusCode,
    #[serde(rename = "type")]
    error_type: String,
    context: HashMap<String, Value>,
    message: String,
    #[serde(default = "CoreErrorCause::default")]
    cause: CoreErrorCause,
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
