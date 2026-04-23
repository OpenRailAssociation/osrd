pub mod conflict_detection;
pub mod etcs_braking_curves;
pub mod mocking;
pub mod mq_client;
pub mod path_properties;
pub mod pathfinding;
pub mod signal_projection;
pub mod simulation;
pub mod stdcm;
pub mod worker_load;

use futures::Stream;
use futures::StreamExt as _;
use futures::future::Either;
use futures::stream;
use mq_client::MqClientError;
use serde::Deserialize;
use serde::Serialize;
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::fmt::Display;
use std::marker::PhantomData;
use std::pin::pin;
use std::time::Duration;
use thiserror::Error;
use tokio::sync::mpsc::UnboundedSender;
use tracing::trace;

pub use mq_client::RabbitMQClient;

/// An enum to wrap RabbitMQ's routing keys
///
/// - [WorkerKey::Timetable]: worker key based on the infra and timetable ids
/// - [WorkerKey::Infra]: worker key based on an infra id
#[derive(Debug)]
pub enum WorkerKey {
    Timetable { infra_id: i64, timetable_id: i64 },
    Infra(i64),
}

impl Display for WorkerKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WorkerKey::Timetable {
                infra_id,
                timetable_id,
            } => {
                write!(f, "{infra_id}-{timetable_id}")
            }
            WorkerKey::Infra(infra_id) => write!(f, "{infra_id}"),
        }
    }
}

#[derive(Debug, Clone)]
pub enum CoreClient {
    MessageQueue(RabbitMQClient),
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
            CoreClient::Mocked(_) => Ok(true),
        }
    }

    #[tracing::instrument(
        target = "editoast::coreclient",
        name = "core:fetch",
        skip(self, body),
        err
    )]
    async fn fetch<B, R>(
        &self,
        path: &str,
        body: Option<&B>,
        worker_key: WorkerKey,
        override_timeout: Option<Duration>,
    ) -> Result<R::Response, Error>
    where
        B: Serialize,
        R: CoreResponse,
        <R as CoreResponse>::Response: std::marker::Send,
    {
        match self {
            CoreClient::MessageQueue(_) => {
                let stream = self
                    .fetch_streaming::<B, R>(path, body, worker_key, override_timeout)
                    .await?;

                pin!(stream)
                    .next()
                    .await
                    .ok_or(Error::UnparsableErrorOutput)?
            }

            CoreClient::Mocked(client) => match client.fetch_mocked::<_, B, R>(path, body) {
                Ok(Some(response)) => Ok(response),
                Ok(None) => Err(Error::NoResponseContent),
                Err(mocking::MockingError { bytes, url }) => Err(Error::parse(&bytes, url)),
            },
        }
    }

    #[tracing::instrument(
        target = "editoast::coreclient",
        name = "core:fetch_streaming",
        skip(self, body),
        err
    )]
    async fn fetch_streaming<B, R>(
        &self,
        path: &str,
        body: Option<&B>,
        worker_key: WorkerKey,
        override_timeout: Option<Duration>,
    ) -> Result<impl Stream<Item = Result<<R as CoreResponse>::Response, Error>>, Error>
    where
        B: Serialize,
        R: CoreResponse,
        <R as CoreResponse>::Response: std::marker::Send,
    {
        trace!(
            target: "editoast::coreclient",
            body = body.and_then(|b| serde_json::to_string_pretty(b).ok()).unwrap_or_default(),
            "Request content");

        match self {
            CoreClient::MessageQueue(client) => {
                // TODO: maybe implement retry?
                // TODO: tracing: use correlation id
                let stream = client
                    .call_with_multiple_responses(
                        worker_key.to_string(),
                        path,
                        body,
                        true,
                        override_timeout,
                    )
                    .await
                    .map_err(Error::MqClientError)?;

                let owned_path = path.to_string();

                Ok(Either::Left(stream.map(move |result| {
                    let response = result.map_err(Error::MqClientError)?;

                    if response.status == b"ok" {
                        return R::from_bytes(&response.payload);
                    }

                    if response.status == b"core_error" {
                        return Err(Error::parse(&response.payload, owned_path.clone()));
                    }

                    todo!("TODO: handle protocol errors")
                })))
            }
            CoreClient::Mocked(client) => {
                match client.fetch_streaming_mocked::<_, B, R>(path, body) {
                    Ok(responses) => Ok(Either::Right(stream::iter(responses).map(Ok))),
                    Err(mocking::MockingError { bytes, url }) => Err(Error::parse(&bytes, url)),
                }
            }
        }
    }
}

/// A struct implementing this trait represents a Core request payload
///
/// For example:
/// ```
/// # use core_client::AsCoreRequest;
/// # use core_client::Json;
/// # use core_client::WorkerKey;
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
///     fn worker_key(&self) -> WorkerKey { WorkerKey::Infra(42) }
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
    <R as CoreResponse>::Response: std::marker::Send,
{
    /// The URL path of this request
    const URL_PATH: &'static str;

    /// An optional timeout override for this request
    const OVERRIDE_TIMEOUT: Option<Duration> = None;

    /// Returns the worker id used for the request. Must be provided.
    fn worker_key(&self) -> WorkerKey;

    /// Sends this request using the given [CoreClient] and returns the response content on success
    ///
    /// Raises a [enum@Error] if the request is not a success.
    ///
    /// TODO: provide a mechanism in this trait to allow the implementer to
    /// manage itself its expected errors. Maybe a bound error type defaulting
    /// to CoreError and a trait function handle_errors would suffice?
    async fn fetch(&self, core: &CoreClient) -> Result<R::Response, Error> {
        core.fetch::<Self, R>(
            Self::URL_PATH,
            Some(self),
            self.worker_key(),
            Self::OVERRIDE_TIMEOUT,
        )
        .await
    }

    async fn fetch_streaming<'a, S>(
        &'a self,
        core: &CoreClient,
    ) -> Result<impl Stream<Item = Result<S::Response, Error>>, Error>
    where
        S: CoreResponse,
        <S as CoreResponse>::Response: 'a + Send,
    {
        core.fetch_streaming::<Self, S>(
            Self::URL_PATH,
            Some(self),
            self.worker_key(),
            Self::OVERRIDE_TIMEOUT,
        )
        .await
    }
}

/// Results of parsing a streaming response
#[derive(Deserialize)]
#[serde(untagged)]
pub enum Progress<E, F> {
    /// Intermediate event
    Event(E),
    /// Final event
    Final(F),
}

/// Trait for requests that support streaming responses from the core service
pub trait AsCoreStreaming: Serialize + Sized + Sync {
    type Response: CoreResponse;

    /// The URL path of this request
    const URL_PATH: &'static str;

    /// An optional between the payloads timeout override for this request
    const OVERRIDE_TIMEOUT: Option<Duration> = None;

    /// Returns the worker id used for the request. Must be provided.
    fn worker_key(&self) -> WorkerKey;

    /// Sends this request using the given [CoreClient] and returns a stream of response items
    ///
    /// Each item in the stream is a [Result], allowing both successful responses and errors
    async fn fetch(
        &self,
        core: &CoreClient,
    ) -> Result<impl Stream<Item = Result<<Self::Response as CoreResponse>::Response, Error>>, Error>
    where
        <Self::Response as CoreResponse>::Response: Send,
    {
        core.fetch_streaming::<Self, Self::Response>(
            Self::URL_PATH,
            Some(self),
            self.worker_key(),
            Self::OVERRIDE_TIMEOUT,
        )
        .await
    }
}

/// This trait provides a higher-level abstraction where streamed responses are
/// interpreted as either intermediate events or a final response
pub trait AsCoreProgression: AsCoreStreaming {
    /// Type of intermediate events
    type Event;

    /// Type of the final response
    type FinalResponse;

    /// Consumes the streaming response returned by [`Self::fetch`] and emits intermediate events through a channel
    ///
    /// The intermediate events are sent through `sender` and returns the final response
    async fn fetch_updates(
        &self,
        core: &CoreClient,
        sender: UnboundedSender<Result<Self::Event, Error>>,
    ) -> Result<Self::FinalResponse, Error>;
}

impl<E, F, S> AsCoreProgression for S
where
    E: std::marker::Send + DeserializeOwned,
    F: std::marker::Send + DeserializeOwned,
    S: AsCoreStreaming<Response = Progress<E, F>>,
{
    type Event = E;
    type FinalResponse = F;

    async fn fetch_updates(
        &self,
        core: &CoreClient,
        sender: UnboundedSender<Result<Self::Event, Error>>,
    ) -> Result<Self::FinalResponse, Error>
    where
        <Self::Response as CoreResponse>::Response: Send,
    {
        let mut stream = pin!(self.fetch(core).await?);
        while let Some(item) = stream.next().await {
            let event = match item? {
                Progress::Event(e) => Ok(e),
                Progress::Final(f) => {
                    return Ok(f);
                }
            };
            sender.send(event).ok();
        }
        Err(Error::MqClientError(MqClientError::ResponseChannelClosed))
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

impl<E, F> CoreResponse for Progress<E, F>
where
    E: DeserializeOwned,
    F: DeserializeOwned,
{
    type Response = Self;
    fn from_bytes(bytes: &[u8]) -> Result<Self::Response, Error> {
        Json::<Self>::from_bytes(bytes)
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

// Manually implement Clone because serde_json::Error does not
impl Clone for Error {
    fn clone(&self) -> Self {
        match self {
            Self::CoreResponseFormatError { msg } => {
                Self::CoreResponseFormatError { msg: msg.clone() }
            }
            Self::UnparsableErrorOutput => Self::UnparsableErrorOutput,
            Self::BrokenPipe => Self::BrokenPipe,
            Self::RawError(err) => Self::RawError(err.clone()),
            Self::NoResponseContent => Self::NoResponseContent,
            Self::MqClientError(err) => Self::MqClientError(match err {
                MqClientError::Lapin(error) => MqClientError::Lapin(error.clone()),
                MqClientError::Serialization(error) => MqClientError::Serialization(
                    // This is actually a supported behavior of serde_json that is forced to parse
                    // its own error message to comply with serde's API.
                    <serde_json::Error as serde::ser::Error>::custom(error.to_string()),
                ),
                MqClientError::StatusParsing => MqClientError::StatusParsing,
                MqClientError::ResponseTimeout => MqClientError::ResponseTimeout,
                MqClientError::ConnectionDoesNotExist => MqClientError::ConnectionDoesNotExist,
                MqClientError::PoolChannelFail => MqClientError::PoolChannelFail,
                MqClientError::ResponseChannelClosed => MqClientError::ResponseChannelClosed,
            }),
        }
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
