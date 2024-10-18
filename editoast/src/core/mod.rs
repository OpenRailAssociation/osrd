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
use std::marker::PhantomData;

use async_trait::async_trait;
use axum::http::StatusCode;
use editoast_derive::EditoastError;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use thiserror::Error;
use tracing::debug;
use tracing::error;

#[cfg(test)]
use crate::core::mocking::MockingError;
use crate::error::InternalError;
use crate::error::Result;

pub use mq_client::RabbitMQClient;

editoast_common::schemas! {
    simulation::schemas(),
    pathfinding::schemas(),
    conflict_detection::schemas(),
}

#[derive(Debug, Clone)]
pub enum CoreClient {
    MessageQueue(RabbitMQClient),
    #[cfg(test)]
    Mocked(mocking::MockingClient),
}

impl CoreClient {
    pub async fn new_mq(options: mq_client::Options) -> Result<Self> {
        let client = RabbitMQClient::new(options).await?;

        Ok(Self::MessageQueue(client))
    }

    fn handle_error(&self, bytes: &[u8], url: String) -> InternalError {
        // We try to deserialize the response as an StandardCoreError in order to retain the context of the core error
        if let Ok(mut core_error) = <Json<StandardCoreError>>::from_bytes(bytes) {
            let status: u16 = match core_error.cause {
                CoreErrorCause::Internal => 500,
                CoreErrorCause::User => 400,
            };
            core_error.context.insert("url".to_owned(), url.into());
            let mut internal_error: InternalError = core_error.into();
            internal_error.set_status(StatusCode::from_u16(status).unwrap());
            return internal_error;
        }

        let error: InternalError = CoreError::UnparsableErrorOutput.into();
        let mut error = error.with_context("url", url);
        error.set_status(StatusCode::INTERNAL_SERVER_ERROR);
        error
    }

    pub async fn ping(&self) -> Result<bool, CoreError> {
        match self {
            CoreClient::MessageQueue(mq_client) => {
                mq_client.ping().await.map_err(|_| CoreError::BrokenPipe)
            }
            #[cfg(test)]
            CoreClient::Mocked(_) => Ok(true),
        }
    }

    #[tracing::instrument(
        target = "editoast::coreclient",
        name = "core:fetch",
        skip(self, body),
        err
    )]
    async fn fetch<B: Serialize, R: CoreResponse>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<&B>,
        infra_id: Option<i64>,
    ) -> Result<R::Response> {
        debug!(
            target: "editoast::coreclient",
            body = body.and_then(|b| serde_json::to_string_pretty(b).ok()).unwrap_or_default(),
            "Request content");
        match self {
            CoreClient::MessageQueue(client) => {
                // TODO: maybe implement retry?
                let infra_id = infra_id.unwrap_or(1); // FIXME: don't do that!!!
                                                      //expect("FIXME: allow empty infra id in the amqp protocol"); // FIXME: allow empty infra id in the amqp protocol
                                                      // TODO: tracing: use correlation id

                let response = client
                    .call_with_response(infra_id.to_string(), path, &body, true, None)
                    .await?;

                if response.status == b"ok" {
                    return R::from_bytes(&response.payload);
                }

                if response.status == b"core_error" {
                    return Err(self.handle_error(&response.payload, path.to_string()));
                }

                todo!("TODO: handle protocol errors")
            }
            #[cfg(test)]
            CoreClient::Mocked(client) => {
                match client.fetch_mocked::<_, B, R>(method, path, body) {
                    Ok(Some(response)) => Ok(response),
                    Ok(None) => Err(CoreError::NoResponseContent.into()),
                    Err(MockingError { bytes, status, url }) => Err({
                        let mut err = self.handle_error(&bytes, url);
                        err.set_status(status);
                        err
                    }),
                }
            }
        }
    }
}

/// A struct implementing this trait represents a Core request payload
///
/// For example:
///
/// ```
/// #[derive(Serialize, Default)]
/// struct TestReq {
///     foo: String,
///     bar: i64
/// }
///
/// #[derive(Deserialize)]
/// struct Response {
///     message: String
/// }
///
/// impl AsCoreRequest<Response> for TestReq {
///    const METHOD: reqwest::Method = reqwest::Method::POST;
///    const URL_PATH: &'static str = "test01";
/// }
///
/// // Builds the payload, executes the request at POST /test01 and deserializes its response
/// let response: Response = TestReq::default().fetch(&coreclient).await.unwrap();
/// ```
#[async_trait]
pub trait AsCoreRequest<R>
where
    Self: Serialize + Sized + Sync,
    R: CoreResponse,
{
    /// A shorthand for [Self::method]
    const METHOD: reqwest::Method;
    /// A shorthand for [Self::url]
    const URL_PATH: &'static str;

    /// Returns the HTTP method for this request, by default returns [Self::METHOD]
    fn method(&self) -> reqwest::Method {
        Self::METHOD
    }

    /// Returns the URL for this request, by default returns [Self::URL_PATH]
    fn url(&self) -> &str {
        Self::URL_PATH
    }

    /// Returns the infra id used for the request. Must be provided.
    fn infra_id(&self) -> Option<i64>;

    /// Returns whether or not `self` should be serialized as JSON and used as
    /// the request body
    ///
    /// By default, returns true if [Self::method] returns POST, PUT, PATCH and CONNECT, and false
    /// for every other method.
    fn has_body(&self) -> bool {
        use reqwest::Method;
        [Method::POST, Method::PUT, Method::PATCH, Method::CONNECT].contains(&self.method())
    }

    /// Sends this request using the given [CoreClient] and returns the response content on success
    ///
    /// Raises a [CoreError] if the request is not a success.
    ///
    /// TODO: provide a mechanism in this trait to allow the implementer to
    /// manage itself its expected errors. Maybe a bound error type defaulting
    /// to CoreError and a trait function handle_errors would suffice?
    async fn fetch(&self, core: &CoreClient) -> Result<R::Response> {
        core.fetch::<Self, R>(
            self.method(),
            self.url(),
            if self.has_body() { Some(self) } else { None },
            self.infra_id(),
        )
        .await
    }
}

/// A trait meant to encapsulate the behaviour of response deserializing
pub trait CoreResponse {
    /// The type of the deserialized response
    type Response;

    /// Reads the content of `bytes` and produces the response object
    fn from_bytes(bytes: &[u8]) -> Result<Self::Response>;
}

/// Indicates that the response that deserializes to `T` is expected to have a Json body
pub struct Json<T>(PhantomData<T>);

/// Forwards the response body
pub struct Bytes;

impl<T: DeserializeOwned> CoreResponse for Json<T> {
    type Response = T;

    fn from_bytes(bytes: &[u8]) -> Result<Self::Response> {
        serde_json::from_slice(bytes).map_err(|err| {
            CoreError::CoreResponseFormatError {
                msg: err.to_string(),
            }
            .into()
        })
    }
}

impl CoreResponse for Bytes {
    type Response = Vec<u8>;

    fn from_bytes(bytes: &[u8]) -> Result<Self::Response> {
        Ok(Vec::from_iter(bytes.iter().cloned()))
    }
}

impl CoreResponse for () {
    type Response = ();

    fn from_bytes(_: &[u8]) -> Result<Self::Response> {
        Ok(())
    }
}

#[allow(clippy::enum_variant_names)]
#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "coreclient")]
pub enum CoreError {
    #[error("Cannot parse Core response: {msg}")]
    #[editoast_error(status = 500)]
    CoreResponseFormatError { msg: String },
    /// A fallback error variant for when no meaningful error could be parsed
    /// from core's output.
    #[error("Core error {}: {raw_error}", status.unwrap_or(500))]
    #[editoast_error(status = status.unwrap_or(500))]
    GenericCoreError {
        status: Option<u16>,
        url: String,
        raw_error: String,
    },
    #[error("Core returned an error in an unknown format")]
    UnparsableErrorOutput,

    #[error("Core connection closed before message completed. Should retry.")]
    #[editoast_error(status = 500)]
    ConnectionClosedBeforeMessageCompleted,
    #[error("Core connection reset by peer. Should retry.")]
    #[editoast_error(status = 500)]
    ConnectionResetByPeer,
    #[error("Core connection broken. Should retry.")]
    #[editoast_error(status = 500)]
    BrokenPipe,

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

impl From<reqwest::Error> for CoreError {
    fn from(value: reqwest::Error) -> Self {
        // Since we should retry the request it's useful to have its own kind of error.
        if value
            .to_string()
            .contains("connection closed before message completed")
        {
            return Self::ConnectionClosedBeforeMessageCompleted;
        }
        if value.to_string().contains("Connection reset by peer") {
            return Self::ConnectionResetByPeer;
        }
        if value
            .to_string()
            .contains("error writing a body to connection: Broken pipe")
        {
            return Self::BrokenPipe;
        }

        // Convert the reqwest error
        Self::GenericCoreError {
            status: value.status().map(|st| st.as_u16()),
            url: value
                .url()
                .map_or("<NO URL>", |url| url.as_str())
                .to_owned(),
            raw_error: value.to_string(),
        }
    }
}

#[cfg(test)]
mod test {
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use reqwest::Method;
    use serde::Serialize;
    use serde_json::json;

    use crate::core::mocking::MockingClient;
    use crate::core::AsCoreRequest;
    use crate::core::Bytes;
    use crate::error::InternalError;

    #[rstest::rstest]
    async fn test_expected_empty_response() {
        #[derive(Serialize)]
        struct Req;
        impl AsCoreRequest<()> for Req {
            const METHOD: Method = Method::GET;
            const URL_PATH: &'static str = "/test";

            fn infra_id(&self) -> Option<i64> {
                None
            }
        }
        let mut core = MockingClient::default();
        core.stub("/test")
            .method(Method::GET)
            .response(StatusCode::OK)
            .body("")
            .finish();
        // Should not yield any warning as the result type is ().
        Req.fetch(&core.into()).await.unwrap();
    }

    #[rstest::rstest]
    async fn test_bytes_response() {
        #[derive(Serialize)]
        struct Req;
        impl AsCoreRequest<Bytes> for Req {
            const METHOD: Method = Method::GET;
            const URL_PATH: &'static str = "/test";

            fn infra_id(&self) -> Option<i64> {
                None
            }
        }
        let mut core = MockingClient::default();
        core.stub("/test")
            .method(Method::GET)
            .response(StatusCode::OK)
            .body("not JSON :)")
            .finish();
        let bytes = Req.fetch(&core.into()).await.unwrap();
        assert_eq!(&String::from_utf8(bytes).unwrap(), "not JSON :)");
    }

    #[rstest::rstest]
    async fn test_core_osrd_error() {
        #[derive(Serialize)]
        struct Req;
        impl AsCoreRequest<()> for Req {
            const METHOD: Method = Method::GET;
            const URL_PATH: &'static str = "/test";

            fn infra_id(&self) -> Option<i64> {
                None
            }
        }
        let error = json!({
            "context": {
                "stack_trace": [
                    "ThreadPoolExecutor.java:635",
                    "Thread.java:833"
                ],
                "message": "conflict offset is already on a range transition",
                "url": "/test"
            },
            "message": "assert check failed",
            "type": "assert_error",
        });
        let mut core = MockingClient::default();
        core.stub("/test")
            .method(Method::GET)
            .response(StatusCode::NOT_FOUND)
            .body(error.to_string())
            .finish();
        let mut error_with_status: InternalError = serde_json::from_value(error).unwrap();
        error_with_status.set_status(StatusCode::NOT_FOUND);
        let result = Req.fetch(&core.into()).await;
        let expected_err: InternalError = error_with_status;
        assert_eq!(result, Err(expected_err));
    }
}
