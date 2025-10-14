pub mod conflict_detection;
pub mod etcs_braking_curves;
pub mod mq_client;
pub mod path_properties;
pub mod pathfinding;
pub mod signal_projection;
pub mod simulation;
pub mod stdcm;
pub mod version;
pub mod worker_load;

#[cfg(feature = "mocking_client")]
pub mod mocking;

use mq_client::MqClientError;
use serde::Deserialize;
use serde::Serialize;
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::fmt::Display;
use std::marker::PhantomData;
use thiserror::Error;
use tracing::trace;

pub use mq_client::RabbitMQClient;

#[derive(Debug, Clone)]
pub enum CoreClient {
    MessageQueue(RabbitMQClient),
    #[cfg(feature = "mocking_client")]
    Mocked(mocking::MockingClient),
}

impl CoreClient {
    #[tracing::instrument(skip_all, err)]
    pub async fn new_mq(options: mq_client::Options) -> Result<Self, Error> {
        let client = RabbitMQClient::new(options)
            .await
            .map_err(Error::MqClientError)?;

        Ok(Self::MessageQueue(client))
    }

    #[tracing::instrument(name = "ping_core", skip_all)]
    pub async fn ping(&self) -> Result<bool, Error> {
        match self {
            CoreClient::MessageQueue(mq_client) => {
                mq_client.ping().await.map_err(|_| Error::BrokenPipe)
            }
            #[cfg(feature = "mocking_client")]
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
        path: &str,
        body: Option<&B>,
        worker_id: Option<String>,
    ) -> Result<R::Response, Error> {
        trace!(
            target: "editoast::coreclient",
            body = body.and_then(|b| serde_json::to_string_pretty(b).ok()).unwrap_or_default(),
            "Request content");
        match self {
            CoreClient::MessageQueue(client) => {
                // TODO: maybe implement retry?
                let worker_id = worker_id.unwrap_or_default(); // FIXME: don't do that!!!
                //expect("FIXME: allow empty infra id in the amqp protocol"); // FIXME: allow empty infra id in the amqp protocol
                // TODO: tracing: use correlation id

                let response = client
                    .call_with_response(worker_id, path, &body, true, None)
                    .await
                    .map_err(Error::MqClientError)?;

                if response.status == b"ok" {
                    return R::from_bytes(&response.payload);
                }

                if response.status == b"core_error" {
                    return Err(Error::parse(&response.payload, path.to_string()));
                }

                todo!("TODO: handle protocol errors")
            }
            #[cfg(feature = "mocking_client")]
            CoreClient::Mocked(client) => match client.fetch_mocked::<_, B, R>(path, body) {
                Ok(Some(response)) => Ok(response),
                Ok(None) => Err(Error::NoResponseContent),
                Err(mocking::MockingError { bytes, url }) => Err(Error::parse(&bytes, url)),
            },
        }
    }
}

/// A struct implementing this trait represents a Core request payload
///
/// For example:
/// ```
/// # use core_client::AsCoreRequest;
/// # use core_client::Json;
/// # use serde::Serialize;
/// # use serde::Deserialize;
/// #[derive(Serialize, Default)]
/// struct TestReq {
///     foo: String,
///     bar: i64
/// }
///
/// #[derive(Deserialize)]
/// struct Response {
///     message: String,
/// }
///
/// impl AsCoreRequest<Json<Response>> for TestReq {
///     const URL_PATH: &'static str = "/some/path";
///     fn worker_id(&self) -> std::option::Option<String> { Some("42".into()) }
/// }
///
/// # let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
/// # rt.block_on(async {
/// #   let mut core_mock = core_client::mocking::MockingClient::default();
/// #   core_mock.stub("/some/path").response(http::StatusCode::OK).body("{\"message\":\"YOU WON!\"}").finish();
/// #   let core_client = core_mock.into();
/// // Builds the payload, executes the request at POST /some/path and deserializes its response
/// let response = TestReq::default().fetch(&core_client).await.unwrap();
/// assert_eq!(response.message, "YOU WON!");
/// # });
/// ```
pub trait AsCoreRequest<R>
where
    Self: Serialize + Sized + Sync,
    R: CoreResponse,
{
    /// A shorthand for [Self::url]
    const URL_PATH: &'static str;

    /// Returns the URL for this request, by default returns [Self::URL_PATH]
    fn url(&self) -> &str {
        Self::URL_PATH
    }

    /// Returns the worker id used for the request. Must be provided.
    fn worker_id(&self) -> Option<String>;

    /// Sends this request using the given [CoreClient] and returns the response content on success
    ///
    /// Raises a [enum@Error] if the request is not a success.
    ///
    /// TODO: provide a mechanism in this trait to allow the implementer to
    /// manage itself its expected errors. Maybe a bound error type defaulting
    /// to CoreError and a trait function handle_errors would suffice?
    async fn fetch(&self, core: &CoreClient) -> Result<R::Response, Error> {
        core.fetch::<Self, R>(self.url(), Some(self), self.worker_id())
            .await
    }
}

/// A trait meant to encapsulate the behaviour of response deserializing
pub trait CoreResponse {
    /// The type of the deserialized response
    type Response;

    /// Reads the content of `bytes` and produces the response object
    fn from_bytes(bytes: &[u8]) -> Result<Self::Response, Error>;
}

/// Indicates that the response that deserializes to `T` is expected to have a Json body
pub struct Json<T>(PhantomData<T>);

/// Forwards the response body
pub struct Bytes;

impl<T: DeserializeOwned> CoreResponse for Json<T> {
    type Response = T;

    fn from_bytes(bytes: &[u8]) -> Result<Self::Response, Error> {
        serde_json::from_slice(bytes).map_err(|err| Error::CoreResponseFormatError {
            msg: err.to_string(),
        })
    }
}

impl CoreResponse for Bytes {
    type Response = Vec<u8>;

    fn from_bytes(bytes: &[u8]) -> Result<Self::Response, Error> {
        Ok(Vec::from_iter(bytes.iter().cloned()))
    }
}

impl CoreResponse for () {
    type Response = ();

    fn from_bytes(_: &[u8]) -> Result<Self::Response, Error> {
        Ok(())
    }
}

#[allow(clippy::enum_variant_names)]
#[derive(Debug, Error, PartialEq)]
pub enum Error {
    #[error("Cannot parse Core response: {msg}")]
    CoreResponseFormatError { msg: String },

    #[error("Core returned an error in an unknown format")]
    UnparsableErrorOutput,

    #[error("Core connection broken. Should retry.")]
    BrokenPipe,

    #[error(transparent)]
    MqClientError(#[from] MqClientError),

    #[error(transparent)]
    RawError(#[from] RawError),

    #[cfg(feature = "mocking_client")]
    #[error(
        "The mocked response had no body configured - check out StubResponseBuilder::body if this is unexpected"
    )]
    NoResponseContent,
}

impl Error {
    fn parse(bytes: &[u8], url: String) -> Error {
        // We try to deserialize the response as an RawError in order to retain the context of the core error
        if let Ok(mut core_error) = <Json<RawError>>::from_bytes(bytes) {
            core_error.context.insert("url".to_owned(), url.into());
            return Error::RawError(core_error);
        }
        Error::UnparsableErrorOutput
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct RawError {
    #[serde(rename = "type")]
    pub error_type: String,
    pub message: String,
    pub context: HashMap<String, serde_json::Value>,
    pub cause: ErrorCause,
}

impl std::error::Error for RawError {}

impl Display for RawError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub enum ErrorCause {
    Internal,
    User,
}

#[cfg(test)]
mod tests {

    use http::StatusCode;
    use pretty_assertions::assert_eq;
    use serde::Serialize;
    use serde_json::json;

    use crate::AsCoreRequest;
    use crate::Bytes;
    use crate::RawError;
    use crate::mocking::MockingClient;

    use super::Error;

    #[tokio::test]
    async fn test_expected_empty_response() {
        #[derive(Serialize)]
        struct Req;
        impl AsCoreRequest<()> for Req {
            const URL_PATH: &'static str = "/test";

            fn worker_id(&self) -> Option<String> {
                None
            }
        }
        let mut core = MockingClient::default();
        core.stub("/test")
            .response(StatusCode::OK)
            .body("")
            .finish();
        // Should not yield any warning as the result type is ().
        Req.fetch(&core.into()).await.unwrap();
    }

    #[tokio::test]
    async fn test_bytes_response() {
        #[derive(Serialize)]
        struct Req;
        impl AsCoreRequest<Bytes> for Req {
            const URL_PATH: &'static str = "/test";

            fn worker_id(&self) -> Option<String> {
                None
            }
        }
        let mut core = MockingClient::default();
        core.stub("/test")
            .response(StatusCode::OK)
            .body("not JSON :)")
            .finish();
        let bytes = Req.fetch(&core.into()).await.unwrap();
        assert_eq!(&String::from_utf8(bytes).unwrap(), "not JSON :)");
    }

    #[tokio::test]
    async fn test_core_osrd_error() {
        #[derive(Serialize)]
        struct Req;
        impl AsCoreRequest<()> for Req {
            const URL_PATH: &'static str = "/test";

            fn worker_id(&self) -> Option<String> {
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
            "cause": "Internal"
        });
        let mut core = MockingClient::default();
        core.stub("/test")
            .response(StatusCode::NOT_FOUND)
            .body(error.to_string())
            .finish();
        let expected_error: RawError = serde_json::from_value(error).unwrap();
        let result = Req.fetch(&core.into()).await;
        let result = result.err().unwrap();
        assert_eq!(result, Error::RawError(expected_error));
    }
}
