pub mod pathfinding;

#[cfg(test)]
use std::{collections::VecDeque, sync::RwLock};
use std::{ops::Deref, sync::Arc};

use async_trait::async_trait;
use editoast_derive::EditoastError;
use serde::{de::DeserializeOwned, Serialize};
use thiserror::Error;

use crate::error::Result;

/// A client that can send requests to Core
///
/// Mocking functions are available on `cfg(test)`.
#[async_trait]
pub trait Client: Send + Sync + std::fmt::Debug {
    /// Sends a request and returns the response
    async fn run(
        &self,
        method: reqwest::Method,
        url_path: &str,
        payload: &serde_json::Value,
    ) -> Result<serde_json::Value>;

    /// Enqueues an expected request payload for testing purposes
    ///
    /// Panics by default, should `assert!` if overriden.
    #[cfg(test)]
    fn queue_expected_request(&self, _: serde_json::Value) {
        panic!("not supported by this client")
    }

    /// Enqueues an expected response payload for an upcoming request
    ///
    /// Panics by default, should `assert!` if overriden.
    #[cfg(test)]
    fn queue_expected_response(&self, _: serde_json::Value) {
        panic!("not supported by this client")
    }
}

/// Contains the data required in order to communicate with Core
///
/// See also [AsCoreRequest]
#[derive(Debug, Clone)]
pub struct DirectClient {
    pub address: String,
    pub bearer_token: String,
}

impl Default for DirectClient {
    fn default() -> Self {
        let address = std::env::var("OSRD_BACKEND").unwrap_or("http://localhost:8080".to_owned());
        let bearer_token = std::env::var("OSRD_BACKEND_TOKEN").unwrap_or_default();
        Self::new(address, bearer_token)
    }
}

impl DirectClient {
    pub fn new(address: String, bearer_token: String) -> Self {
        Self {
            address,
            bearer_token,
        }
    }
}

#[async_trait]
impl Client for DirectClient {
    async fn run(
        &self,
        method: reqwest::Method,
        url_path: &str,
        payload: &serde_json::Value,
    ) -> Result<serde_json::Value> {
        let response = reqwest::Client::new()
            .request(method, format!("{0}/{1}", self.address, url_path))
            .bearer_auth(&self.bearer_token)
            .json(payload)
            .send()
            .await
            .map_err(Into::<CoreError>::into)?;
        if !response.status().is_success() {
            return Err(CoreError::GenericCoreError {
                status: response.status().to_string(),
                url: response.url().to_string(),
                msg: response.text().await.map_err(Into::<CoreError>::into)?,
            }
            .into());
        }
        let payload = response.json().await.map_err(Into::<CoreError>::into)?;
        Ok(payload)
    }
}

/// A mocking core client with a queue to assert! [AsCoreRequest] payloads and
/// another queue of simulated responses
///
/// See [Client], [DirectClient]
#[cfg(test)]
#[derive(Debug, Default)]
pub struct MockingClient {
    pub requests: RwLock<VecDeque<serde_json::Value>>,
    pub responses: RwLock<VecDeque<serde_json::Value>>,
}

#[cfg(test)]
#[async_trait]
impl Client for MockingClient {
    async fn run(
        &self,
        _method: reqwest::Method,
        _url_path: &str,
        payload: &serde_json::Value,
    ) -> Result<serde_json::Value> {
        if let Some(expected) = {
            let mut requests = self.requests.write().unwrap();
            requests.pop_front()
        } {
            assert_eq!(&expected, payload);
        }
        {
            let mut responses = self.responses.write().unwrap();
            Ok(responses.pop_front().expect("mocked reponse stack empty"))
        }
    }

    fn queue_expected_request(&self, request: serde_json::Value) {
        let mut requests = self.requests.write().unwrap();
        requests.push_back(request);
    }

    fn queue_expected_response(&self, response: serde_json::Value) {
        let mut responses = self.responses.write().unwrap();
        responses.push_back(response);
    }
}

/// A dynamic wrapper around [Client] to seamlessly switch between clients
///
/// It is useful for substituting a [DirectClient] with a `MockingClient` in a
/// testing context.
#[derive(Debug, Clone)]
pub struct CoreClient(Arc<dyn Client>);

impl CoreClient {
    pub fn new(address: String, bearer_token: String) -> Self {
        Self(Arc::new(DirectClient::new(address, bearer_token)))
    }
}

#[cfg(test)]
impl CoreClient {
    pub fn new_mocked() -> Self {
        Self(Arc::new(MockingClient::default()))
    }

    /// See [Client::queue_expected_request]
    #[allow(unused)]
    pub fn queue_expected_request(&self, request: serde_json::Value) {
        self.0.queue_expected_request(request)
    }

    /// See [Client::queue_expected_response]
    pub fn queue_expected_response(&self, response: serde_json::Value) {
        self.0.queue_expected_response(response)
    }
}

#[allow(clippy::derivable_impls)]
impl Default for CoreClient {
    fn default() -> Self {
        Self(Arc::<DirectClient>::default())
    }
}

impl Deref for CoreClient {
    type Target = Arc<dyn Client>;

    fn deref(&self) -> &Self::Target {
        &self.0
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
    R: DeserializeOwned + Send,
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
    fn url(&self) -> String {
        Self::URL_PATH.to_owned()
    }

    /// Executes this request according to the settings in `core`
    ///
    /// 1. Builds the request
    /// 2. Sets the json payload of the request to the serialization of the type implementing [Self]
    /// 3. Deserializes the response into an `R` value
    ///
    /// Raises a [CoreError] if the request is not a success.
    async fn fetch(&self, core: &CoreClient) -> Result<R> {
        let payload = serde_json::to_value(self).expect("request types must serialize faultlessly");
        let payload = core.run(self.method(), &self.url(), &payload).await?;
        Ok(serde_json::from_value(payload.clone()).map_err(|err| {
            CoreError::CoreResponseFormatError {
                msg: err.to_string(),
                response: payload,
            }
        })?)
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "coreclient")]
enum CoreError {
    #[error("Cannot parse Core response: {msg}")]
    #[editoast_error(status = 500)]
    CoreResponseFormatError {
        msg: String,
        response: serde_json::Value,
    },
    /// A fallback error variant for when no meaningful error could be parsed
    /// from core's output.
    #[error("Core returned {status} for '{url}': {msg}")]
    #[editoast_error(status = 400)]
    GenericCoreError {
        status: String,
        url: String,
        msg: String,
    },
}

impl From<reqwest::Error> for CoreError {
    fn from(value: reqwest::Error) -> Self {
        Self::GenericCoreError {
            status: value
                .status()
                .map_or("<NO STATUS>".to_owned(), |st| st.to_string()),
            url: value
                .url()
                .map_or("<NO URL>", |url| url.as_str())
                .to_owned(),
            msg: value.to_string(),
        }
    }
}
