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

use axum::http::StatusCode;
use mq_client::MqClientError;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use thiserror::Error;
use tracing::error;
use tracing::trace;

#[cfg(test)]
use crate::core::mocking::MockingError;

pub use mq_client::RabbitMQClient;

editoast_common::schemas! {
    simulation::schemas(),
    pathfinding::schemas(),
    conflict_detection::schemas(),
    stdcm::schemas(),
}

#[derive(Debug, Clone)]
pub enum CoreClient {
    MessageQueue(RabbitMQClient),
    #[cfg(test)]
    Mocked(mocking::MockingClient),
}

impl CoreClient {
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
    ) -> Result<R::Response, Error> {
        trace!(
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
            #[cfg(test)]
            CoreClient::Mocked(client) => {
                match client.fetch_mocked::<_, B, R>(method, path, body) {
                    Ok(Some(response)) => Ok(response),
                    Ok(None) => Err(Error::NoResponseContent),
                    Err(MockingError { bytes, url }) => Err(Error::parse(&bytes, url)),
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
    /// Raises a [enum@Error] if the request is not a success.
    ///
    /// TODO: provide a mechanism in this trait to allow the implementer to
    /// manage itself its expected errors. Maybe a bound error type defaulting
    /// to CoreError and a trait function handle_errors would suffice?
    async fn fetch(&self, core: &CoreClient) -> Result<R::Response, Error> {
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
    StandardCoreError(#[from] StandardCoreError),

    #[cfg(test)]
    #[error("The mocked response had no body configured - check out StubResponseBuilder::body if this is unexpected")]
    NoResponseContent,
}

impl Error {
    fn parse(bytes: &[u8], url: String) -> Error {
        // We try to deserialize the response as an StandardCoreError in order to retain the context of the core error
        if let Ok(mut core_error) = <Json<StandardCoreError>>::from_bytes(bytes) {
            core_error.context.insert("url".to_owned(), url.into());
            return Error::StandardCoreError(core_error);
        }
        Error::UnparsableErrorOutput
    }
}

#[derive(Debug, Deserialize, PartialEq)]
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

#[derive(Debug, Deserialize, Default, PartialEq)]
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

#[cfg(test)]
mod tests {

    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use reqwest::Method;
    use serde::Serialize;
    use serde_json::json;

    use crate::core::mocking::MockingClient;
    use crate::core::AsCoreRequest;
    use crate::core::Bytes;
    use crate::core::StandardCoreError;

    use super::Error;

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
        let expected_error: StandardCoreError = serde_json::from_value(error).unwrap();
        let result = Req.fetch(&core.into()).await;
        let result = result.err().unwrap();
        assert_eq!(result, Error::StandardCoreError(expected_error));
    }
}
