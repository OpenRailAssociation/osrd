use axum::Json;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use colored::Colorize;
use database::DatabaseError;
use database::db_connection_pool::DatabasePoolBuildError;
use database::db_connection_pool::DatabasePoolError;
use deadpool_redis::PoolError;
use deadpool_redis::redis::RedisError;
use diesel::result::Error as DieselError;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use serde_json::json;
use std::backtrace::Backtrace;
use std::collections::HashMap;
use std::error::Error;
use std::fmt::Display;
use std::fmt::Formatter;
use std::result::Result as StdResult;
use tracing::error;
use utoipa::ToSchema;

pub type Result<T, E = InternalError> = StdResult<T, E>;

/// Trait for all errors that can be returned by editoast
pub trait EditoastError: Error + Send + Sync {
    fn get_status(&self) -> StatusCode;

    fn get_type(&self) -> &str;

    fn context(&self) -> HashMap<String, Value> {
        Default::default()
    }
}

#[derive(Serialize, Deserialize)]
#[serde(remote = "StatusCode")]
pub(crate) struct StatusCodeRemoteDef(#[serde(getter = "StatusCode::as_u16")] u16);

impl From<StatusCodeRemoteDef> for StatusCode {
    fn from(def: StatusCodeRemoteDef) -> Self {
        StatusCode::from_u16(def.0).unwrap()
    }
}

pub(crate) fn default_status_code() -> StatusCode {
    StatusCode::INTERNAL_SERVER_ERROR
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq)]
pub struct InternalError {
    #[serde(with = "StatusCodeRemoteDef", default = "default_status_code")]
    #[schema(value_type = u16, minimum = 100, maximum = 599)]
    pub status: StatusCode,
    #[serde(rename = "type")]
    pub error_type: String,
    pub context: HashMap<String, Value>,
    pub message: String,
}

impl InternalError {
    pub fn get_type(&self) -> &str {
        &self.error_type
    }

    pub fn get_status(&self) -> StatusCode {
        self.status
    }

    pub fn set_status(&mut self, status: StatusCode) {
        self.status = status;
    }

    pub fn get_context(&self) -> &HashMap<String, Value> {
        &self.context
    }

    pub fn with_context<S: AsRef<str>, V: Into<Value>>(mut self, key: S, value: V) -> Self {
        self.context.insert(key.as_ref().into(), value.into());
        self
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
            error_type: err.get_type().to_owned(),
            context: err.context(),
            message: err.to_string(),
        }
    }
}

impl IntoResponse for InternalError {
    fn into_response(self) -> Response {
        error!(
            "[{}] {}: {}",
            self.error_type.bold(),
            self.message,
            Backtrace::capture() // won't log unless RUST_BACKTRACE=1
        );
        (self.status, Json(self)).into_response()
    }
}

/// Handle all diesel errors
impl EditoastError for DieselError {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:DieselError"
    }
}

inventory::submit! {
    crate::error::ErrorDefinition::new("editoast:DatabaseAccessError", "DatabaseAccessError", "DatabaseAccessError", 500u16, r#"{}"#)
}
impl EditoastError for DatabasePoolBuildError {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:DatabaseAccessError"
    }
}
impl EditoastError for DatabasePoolError {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:DatabaseAccessError"
    }
}

impl EditoastError for DatabaseError {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:DatabaseAccessError"
    }
}

/// Handle all valkey errors
impl EditoastError for RedisError {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:ValkeyError"
    }
}

/// Handle all valkey pool errors
impl EditoastError for PoolError {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:ValkeyPoolError"
    }
}

/// Handle database pool errors
impl EditoastError for diesel_async::pooled_connection::deadpool::PoolError {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:DatabasePoolError"
    }
}

impl EditoastError for reqwest::Error {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:ReqwestError"
    }
}

impl EditoastError for serde_json::Error {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:SerdeJsonError"
    }
}

impl EditoastError for json_patch::PatchError {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:JsonPatchError"
    }
}

inventory::submit! {
    crate::error::ErrorDefinition::new("editoast:geometry:UnexpectedGeometry", "UnexpectedGeometry", "GeometryError", 404u16, r#"{"expected":"String","actual":"String"}"#)
}
impl EditoastError for schemas::errors::GeometryError {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:geometry:UnexpectedGeometry"
    }

    fn context(&self) -> HashMap<String, Value> {
        match self {
            Self::UnexpectedGeometry { expected, actual } => {
                let mut context = HashMap::new();
                context.insert("expected".to_string(), json!(expected));
                context.insert("actual".to_string(), json!(actual));
                context
            }
        }
    }
}

inventory::submit! {
    ErrorDefinition::new("editoast:model:ModelError", "", "ModelError", 500u16, r#"{}"#)
}
impl EditoastError for editoast_models::Error {
    fn get_status(&self) -> StatusCode {
        StatusCode::INTERNAL_SERVER_ERROR
    }

    fn get_type(&self) -> &str {
        "editoast:ModelError"
    }
}

inventory::submit! {
    crate::error::ErrorDefinition::new("editoast:coreclient:CoreResponseFormatError", "CoreResponseFormatError", "CoreError", 500u16, r#"{"msg":"String"}"#)
}

inventory::submit! {
    crate::error::ErrorDefinition::new("editoast:coreclient:UnparsableErrorOutput", "UnparsableErrorOutput", "CoreError", 400u16, r#"{}"#)
}

inventory::submit! {
    crate::error::ErrorDefinition::new("editoast:coreclient:BrokenPipe", "BrokenPipe", "CoreError", 500u16, r#"{}"#)
}

inventory::submit! {
    crate::error::ErrorDefinition::new("editoast:coreclient:MqClientError", "MqClientError", "CoreError", 500u16, r#"{}"#)
}

impl EditoastError for core_client::Error {
    fn get_status(&self) -> StatusCode {
        match self {
            core_client::Error::UnparsableErrorOutput => StatusCode::BAD_REQUEST,
            core_client::Error::RawError(error) => match error.cause {
                core_client::ErrorCause::Internal => StatusCode::INTERNAL_SERVER_ERROR,
                core_client::ErrorCause::User => StatusCode::BAD_REQUEST,
            },
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
    fn get_type(&self) -> &'static str {
        match self {
            core_client::Error::CoreResponseFormatError { .. } => {
                "editoast:coreclient:CoreResponseFormatError"
            }
            core_client::Error::UnparsableErrorOutput => {
                "editoast:coreclient:UnparsableErrorOutput"
            }
            core_client::Error::BrokenPipe => "editoast:coreclient:BrokenPipe",
            core_client::Error::MqClientError(_) => "editoast:coreclient:MqClientError",
            core_client::Error::RawError(_) => "editoast:coreclient:RawError",
            core_client::Error::NoResponseContent => "editoast:coreclient:NoResponseContent",
        }
    }
    fn context(&self) -> std::collections::HashMap<String, serde_json::Value> {
        match self {
            core_client::Error::CoreResponseFormatError { msg } => {
                [("msg".to_string(), serde_json::to_value(msg).unwrap())].into()
            }
            _ => Default::default(),
        }
    }
}

impl From<authz::Unauthorized> for InternalError {
    fn from(authz::Unauthorized { reason }: authz::Unauthorized) -> Self {
        tracing::error!(reason, "Unauthorized operation");
        crate::views::AuthorizationError::Forbidden.into()
    }
}

impl From<crate::views::AuthorizerError> for InternalError {
    fn from(value: crate::views::AuthorizerError) -> Self {
        crate::views::AuthorizationError::from(value).into()
    }
}

// error definition : uses by the macro EditoastError to generate
// the list of error and share it with the openAPI generator
#[derive(Debug)]
pub struct ErrorDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub namespace: &'static str,
    pub status: u16,
    context_serialized: &'static str,
}

impl ErrorDefinition {
    pub const fn new(
        id: &'static str,
        name: &'static str,
        namespace: &'static str,
        status: u16,
        context_serialized: &'static str,
    ) -> Self {
        ErrorDefinition {
            id,
            name,
            namespace,
            status,
            context_serialized,
        }
    }

    pub fn get_context(&self) -> HashMap<String, String> {
        serde_json::from_str(self.context_serialized).expect("Error context should be a valid json")
    }

    pub fn get_schema_name(&self) -> String {
        format!("Editoast{}{}", self.namespace, self.name)
    }
}

impl From<core_client::RawError> for InternalError {
    fn from(core_error: core_client::RawError) -> Self {
        let status = match core_error.cause {
            core_client::ErrorCause::Internal => StatusCode::INTERNAL_SERVER_ERROR,
            core_client::ErrorCause::User => StatusCode::BAD_REQUEST,
        };
        Self {
            status,
            error_type: core_error.error_type,
            context: core_error.context,
            message: core_error.message,
        }
    }
}

inventory::collect!(ErrorDefinition);
