//! Low-level mapping of the OpenFGA HTTP API

use super::Error;

pub(super) mod authorization_models;
pub(super) mod healthz;
pub(super) mod queries;
pub(super) mod stores;
pub(super) mod tuples;

/// Helper to deserialize responses or errors from OpenFGA responses
///
/// We cannot just deserialize a Result because it is externally tagged by default.
#[derive(serde::Deserialize)]
#[serde(untagged)]
enum Message<T> {
    Success(T),
    Error(Error),
}

impl<T> Message<T> {
    fn try_success(self) -> Result<T, Error> {
        match self {
            Message::Success(value) => Ok(value),
            Message::Error(error) => Err(error),
        }
    }
}
