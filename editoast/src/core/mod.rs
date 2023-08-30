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

use std::marker::PhantomData;

use crate::error::Result;
use async_trait::async_trait;
use colored::{ColoredString, Colorize};
use editoast_derive::EditoastError;
pub use http_client::{HttpClient, HttpClientBuilder};
use log::info;
use reqwest::Url;
use serde::{de::DeserializeOwned, Serialize};
use serde_derive::Deserialize;
use thiserror::Error;

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

    async fn fetch<B: Serialize, R: CoreResponse>(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<&B>,
    ) -> Result<R::Response> {
        let method_s = colored_method(&method);
        log::info!(target: "editoast::coreclient", "{method_s} {path}");
        log::debug!(target: "editoast::coreclient", "Request content: {body}", body = body.and_then(|b| serde_json::to_string_pretty(b).ok()).unwrap_or_default());
        match self {
            CoreClient::Direct(client) => {
                let mut i_try = 0;
                let response = loop {
                    let mut request = client.request(method.clone(), path);
                    if let Some(body) = body {
                        request = request.json(body);
                    }
                    match request.send().await.map_err(Into::<CoreError>::into) {
                        // This error occurs quite often in the CI.
                        // It's linked to this issue https://github.com/hyperium/hyper/issues/2136.
                        // This is why we retry the request here
                        Err(CoreError::ConnectionClosedBeforeMessageCompleted)
                            if i_try < MAX_RETRIES =>
                        {
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
                    log::info!(target: "editoast::coreclient", "{method_s} {path} {status}", status = status.to_string().bold().green());
                    return R::from_bytes(bytes.as_ref());
                }

                log::error!(target: "editoast::coreclient", "{method_s} {path} {status}", status = status.to_string().bold().red());
                // We try to deserialize the response as the standard Core error format
                // If that fails we try to return a generic error containing the raw error
                let core_error = <Json<CoreErrorPayload> as CoreResponse>::from_bytes(
                    bytes.as_ref(),
                )
                .map_err(|err| {
                    if let Ok(utf8_raw_error) = String::from_utf8(bytes.as_ref().to_vec()) {
                        CoreError::GenericCoreError {
                            status: status.as_str().to_owned(),
                            url: url.clone(),
                            raw_error: utf8_raw_error,
                        }
                        .into()
                    } else {
                        err
                    }
                })?;
                Err(CoreError::Forward {
                    status: status.as_u16(),
                    core_error,
                    url,
                }
                .into())
            }
            #[cfg(test)]
            CoreClient::Mocked(client) => client
                .fetch_mocked::<_, B, R>(method, path, body)
                .ok_or(CoreError::NoResponseContent.into()),
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

/// The structure of a standard core error (cf. class OSRDError)
#[derive(Debug, Serialize, Deserialize)]
struct CoreErrorPayload {
    #[serde(rename = "type")]
    type_: String,
    cause: Option<String>,
    message: String,
    trace: Option<serde_json::Value>,
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
    /// A standard core error was found in the response, so it is forwarded
    #[error("{}", core_error.message)]
    Forward {
        status: u16,
        core_error: CoreErrorPayload,
        url: String,
    },
    /// A fallback error variant for when no meaningful error could be parsed
    /// from core's output.
    #[error("Core error {status}: {raw_error}")]
    #[editoast_error(status = 400)]
    GenericCoreError {
        status: String,
        url: String,
        raw_error: String,
    },
    #[error("Core connection closed before message completed. Should retry.")]
    #[editoast_error(status = 500)]
    ConnectionClosedBeforeMessageCompleted,
    #[cfg(test)]
    #[error("The mocked response had no body configured - check out StubResponseBuilder::body if this is unexpected")]
    NoResponseContent,
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

        // Convert the reqwest error
        Self::GenericCoreError {
            status: value
                .status()
                .map_or("<NO STATUS>".to_owned(), |st| st.to_string()),
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
    use reqwest::Method;
    use serde_derive::Serialize;

    use crate::core::{mocking::MockingClient, AsCoreRequest, Bytes};

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
}
