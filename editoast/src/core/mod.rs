pub mod conflicts;
mod http_client;
pub mod infra_loading;
pub mod infra_state;
#[cfg(test)]
pub mod mocking;
pub mod pathfinding;
pub mod simulation;
pub mod stdcm;
pub mod version;

use std::{collections::HashMap, fmt::Display, marker::PhantomData};

use crate::error::{InternalError, Result};
use actix_http::StatusCode;
use async_trait::async_trait;
use colored::{ColoredString, Colorize};
use editoast_derive::EditoastError;
pub use http_client::{HttpClient, HttpClientBuilder};
use reqwest::{header::HeaderMap, Url};
use serde::{de::DeserializeOwned, Serialize};
use serde_derive::Deserialize;
use serde_json::Value;
use thiserror::Error;
use tracing::{debug, error, info};
use tracing_opentelemetry::OpenTelemetrySpanExt as _;

#[cfg(test)]
use crate::core::mocking::MockingError;

crate::schemas! {
    simulation::schemas(),
}

const MAX_RETRIES: u8 = 5;

fn colored_method(method: &reqwest::Method) -> ColoredString {
    let m = method.as_str();
    match *method {
        reqwest::Method::GET => m.green(),
        reqwest::Method::POST => m.yellow(),
        reqwest::Method::PUT => m.blue(),
        reqwest::Method::PATCH => m.magenta(),
        reqwest::Method::DELETE => m.red(),
        _ => m.normal(),
    }
    .bold()
}

#[derive(Debug, Clone)]
pub enum CoreClient {
    Direct(HttpClient),
    #[cfg(test)]
    Mocked(mocking::MockingClient),
}

impl CoreClient {
    pub fn new_direct(base_url: Url, bearer_token: String) -> Self {
        let client = reqwest::Client::builder()
            .default_headers({
                let mut headers = reqwest::header::HeaderMap::new();
                headers.insert(
                    reqwest::header::AUTHORIZATION,
                    reqwest::header::HeaderValue::from_str(&format!("Bearer {}", bearer_token))
                        .expect("invalid bearer token"),
                );
                headers
            })
            .build_base_url(base_url);
        Self::Direct(client)
    }

    fn handle_error(
        &self,
        bytes: &[u8],
        status: reqwest::StatusCode,
        url: String,
    ) -> InternalError {
        // We try to deserialize the response as an StandardCoreError in order to retain the context of the core error
        if let Ok(mut core_error) = <Json<StandardCoreError>>::from_bytes(bytes) {
            core_error.context.insert("url".to_owned(), url.into());
            let mut internal_error: InternalError = core_error.into();
            internal_error.set_status(status);
            return internal_error;
        }

        CoreError::UnparsableErrorOutput.into()
    }

    async fn fetch<B: Serialize, R: CoreResponse>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<&B>,
    ) -> Result<R::Response> {
        let method_s = colored_method(&method);
        info!(target: "editoast::coreclient", "{method_s} {path}");
        debug!(target: "editoast::coreclient", "Request content: {body}", body = body.and_then(|b| serde_json::to_string_pretty(b).ok()).unwrap_or_default());
        match self {
            CoreClient::Direct(client) => {
                let mut i_try = 0;
                let response = loop {
                    let mut header_map = HeaderMap::new();
                    opentelemetry::global::get_text_map_propagator(|propagator| {
                        propagator.inject_context(
                            &tracing::Span::current().context(),
                            &mut opentelemetry_http::HeaderInjector(&mut header_map),
                        );
                    });
                    let mut request = client.request(method.clone(), path).headers(header_map);

                    if let Some(body) = body {
                        request = request.json(body);
                    }
                    match request.send().await.map_err(Into::<CoreError>::into) {
                        // This error occurs quite often in the CI.
                        // It's linked to this issue https://github.com/hyperium/hyper/issues/2136.
                        // This is why we retry the request here
                        Err(
                            CoreError::ConnectionResetByPeer
                            | CoreError::ConnectionClosedBeforeMessageCompleted,
                        ) if i_try < MAX_RETRIES => {
                            i_try += 1;
                            info!("Core request '{}: {}': Connection closed before message completed. Retry [{}/{}]", method, path, i_try, MAX_RETRIES);
                            continue;
                        }
                        response => break response?,
                    }
                };

                let url = response.url().to_string();
                let status = response.status();
                let bytes =
                    response
                        .bytes()
                        .await
                        .map_err(|err| CoreError::CannotExtractResponseBody {
                            msg: err.to_string(),
                        })?;
                if status.is_success() {
                    info!(target: "editoast::coreclient", "{method_s} {path} {status}", status = status.to_string().bold().green());
                    return R::from_bytes(bytes.as_ref());
                }

                error!(target: "editoast::coreclient", "{method_s} {path} {status}", status = status.to_string().bold().red());
                Err(self.handle_error(bytes.as_ref(), status, url))
            }
            #[cfg(test)]
            CoreClient::Mocked(client) => {
                match client.fetch_mocked::<_, B, R>(method, path, body) {
                    Ok(Some(response)) => Ok(response),
                    Ok(None) => Err(CoreError::NoResponseContent.into()),
                    Err(MockingError { bytes, status, url }) => {
                        Err(self.handle_error(&bytes, status, url))
                    }
                }
            }
        }
    }
}

impl Default for CoreClient {
    fn default() -> Self {
        let address = std::env::var("OSRD_BACKEND").unwrap_or("http://localhost:8080".to_owned());
        let bearer_token = std::env::var("OSRD_BACKEND_TOKEN").unwrap_or_default();
        Self::new_direct(
            address.parse().expect("invalid OSRD_BACKEND URL format"),
            bearer_token,
        )
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
enum CoreError {
    #[error("Cannot extract Core response body: {msg}")]
    #[editoast_error(status = 500)]
    CannotExtractResponseBody { msg: String },
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
    use actix_http::StatusCode;
    use pretty_assertions::assert_eq;
    use reqwest::Method;
    use serde_derive::Serialize;
    use serde_json::json;

    use crate::{
        core::{mocking::MockingClient, AsCoreRequest, Bytes},
        error::InternalError,
    };

    #[rstest::rstest]
    async fn test_expected_empty_response() {
        #[derive(Serialize)]
        struct Req;
        impl AsCoreRequest<()> for Req {
            const METHOD: Method = Method::GET;
            const URL_PATH: &'static str = "/test";
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
