use std::marker::PhantomData;

use serde::de::DeserializeOwned;
use serde::Serialize;

#[cfg(test)]
use crate::core::mocking::MockingError;

use super::error::StandardCoreError;
#[cfg(test)]
use super::mocking;
use super::mq_client;
use super::CoreError;
use super::RabbitMQClient;

#[derive(Debug, Clone)]
pub enum CoreClient {
    MessageQueue(RabbitMQClient),
    #[cfg(test)]
    Mocked(mocking::MockingClient),
}

impl CoreClient {
    pub async fn new_mq(options: mq_client::Options) -> Result<Self, CoreError> {
        let client = RabbitMQClient::new(options)
            .await
            .map_err(CoreError::MqClientError)?;

        Ok(Self::MessageQueue(client))
    }

    #[tracing::instrument(name = "ping_core", skip_all)]
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
    ) -> Result<R::Response, StandardCoreError> {
        tracing::trace!(
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
                    .map_err(CoreError::MqClientError)?;

                if response.status == b"ok" {
                    return R::from_bytes(&response.payload).map_err(|e| e.into());
                }

                if response.status == b"core_error" {
                    return Err(StandardCoreError::parse(
                        &response.payload,
                        path.to_string(),
                    ));
                }

                todo!("TODO: handle protocol errors")
            }
            #[cfg(test)]
            CoreClient::Mocked(client) => {
                match client.fetch_mocked::<_, B, R>(method, path, body) {
                    Ok(Some(response)) => Ok(response),
                    Ok(None) => Err(CoreError::NoResponseContent.into()),
                    Err(MockingError { bytes, status, url }) => Err({
                        let mut err = StandardCoreError::parse(&bytes, url);
                        err.status = status;
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
    /// Raises a [StandardCoreError] if the request is not a success.
    ///
    /// TODO: provide a mechanism in this trait to allow the implementer to
    /// manage itself its expected errors. Maybe a bound error type defaulting
    /// to CoreError and a trait function handle_errors would suffice?
    async fn fetch(&self, core: &CoreClient) -> Result<R::Response, StandardCoreError> {
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
    fn from_bytes(bytes: &[u8]) -> Result<Self::Response, CoreError>;
}

/// Indicates that the response that deserializes to `T` is expected to have a Json body
pub struct Json<T>(PhantomData<T>);

/// Forwards the response body
pub struct Bytes;

impl<T: DeserializeOwned> CoreResponse for Json<T> {
    type Response = T;

    fn from_bytes(bytes: &[u8]) -> Result<Self::Response, CoreError> {
        serde_json::from_slice(bytes).map_err(|err| CoreError::CoreResponseFormatError {
            msg: err.to_string(),
        })
    }
}

impl CoreResponse for Bytes {
    type Response = Vec<u8>;

    fn from_bytes(bytes: &[u8]) -> Result<Self::Response, CoreError> {
        Ok(Vec::from_iter(bytes.iter().cloned()))
    }
}

impl CoreResponse for () {
    type Response = ();

    fn from_bytes(_: &[u8]) -> Result<Self::Response, CoreError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use pretty_assertions::assert_eq;
    use reqwest::Method;
    use serde::Serialize;
    use serde_json::json;

    use crate::core::client::{AsCoreRequest, Bytes};
    use crate::core::error::StandardCoreError;
    use crate::core::mocking::MockingClient;

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
        let mut error_with_status: StandardCoreError = serde_json::from_value(error).unwrap();
        error_with_status.status = StatusCode::NOT_FOUND;
        let result = Req.fetch(&core.into()).await;
        let expected_err: StandardCoreError = error_with_status;
        assert_eq!(result, Err(expected_err));
    }
}
