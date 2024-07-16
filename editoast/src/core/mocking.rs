use std::sync::Arc;

use axum::http::StatusCode;
use reqwest::Body;
use serde::Serialize;

use super::CoreClient;
use super::CoreResponse;

/// A mocking core client maintaining a list of stub requests to simulate
///
/// See [MockingClient::stub]
#[derive(Debug, Default)]
pub struct MockingClient {
    stubs: Vec<StubRequest>,
}

impl From<MockingClient> for CoreClient {
    fn from(value: MockingClient) -> Self {
        Self::Mocked(value)
    }
}

#[derive(Debug)]
pub struct MockingError {
    pub bytes: Vec<u8>,
    pub status: StatusCode,
    pub url: String,
}

impl MockingClient {
    pub fn new() -> Self {
        Default::default()
    }

    /// Creates a stub request
    #[must_use = "call .finish() to register the stub request"]
    pub fn stub<U: AsRef<str>>(&mut self, path: U) -> StubRequestBuilder {
        StubRequestBuilder::new(path.as_ref().into(), self)
    }

    pub(super) fn fetch_mocked<P: AsRef<str>, B: Serialize, R: CoreResponse>(
        &self,
        method: reqwest::Method,
        req_path: P,
        body: Option<&B>,
    ) -> Result<Option<R::Response>, MockingError> {
        let req_path = req_path.as_ref().to_string();
        let stub = 'find_stub: {
            for stub in &self.stubs {
                match stub {
                    StubRequest {
                        path, method: None, ..
                    } if path == &req_path => break 'find_stub Some(stub),
                    StubRequest {
                        path,
                        method: Some(meth),
                        ..
                    } if path == &req_path && meth == method => break 'find_stub Some(stub),
                    _ => (),
                };
            }
            None
        };
        let Some(stub) = stub else {
            panic!("could not find stub for {method} resquest at PATH {req_path}")
        };
        match (
            body.map(|b| serde_json::to_string(b).expect("could not serialize request body")),
            stub.body.as_ref().map(|b| {
                String::from_utf8(
                    b.as_bytes()
                        .expect("expected request body should not be empty when specified")
                        .to_vec(),
                )
                .expect("expected request body should serialize faultlessly")
            }),
        ) {
            (Some(actual), Some(expected)) => assert_eq!(actual, expected, "request body mismatch"),
            (None, Some(expected)) => panic!("missing request body: '{expected}'"),
            _ => (),
        }
        let response = stub
            .response
            .as_ref()
            .and_then(|r| r.body.as_ref())
            .map(|b| {
                b.as_bytes()
                    .expect("mocked response body should not be empty when specified")
            });
        match stub.response {
            None => Ok(None),
            Some(StubResponse { code, .. }) if code.is_success() => Ok(Some(
                R::from_bytes(
                    response.expect("mocked response body should not be empty when specified"),
                )
                .expect("mocked response body should deserialize faultlessly"),
            )),
            Some(StubResponse { code, .. }) => {
                let err = response
                    .expect("mocked response body should not be empty when specified")
                    .to_vec();
                Err(MockingError {
                    bytes: err,
                    status: code,
                    url: req_path,
                })
            }
        }
    }
}

impl Clone for MockingClient {
    fn clone(&self) -> Self {
        let mut cli = Self::default();
        cli.stubs.clone_from_slice(self.stubs.as_slice());
        cli
    }
}

/// A stub request used to assert the validity of an incoming request to mock
#[derive(Debug, Clone)]
pub struct StubRequest {
    path: String,
    method: Option<reqwest::Method>,
    body: Option<Arc<Body>>,
    response: Option<StubResponse>,
}

/// A stub response that mocks a response status code and body
#[derive(Debug, Clone)]
pub struct StubResponse {
    // TODO: currently any failing status code is treated as a GenericCoreError
    // It would be nice if AsCoreRequest could expose an interface to
    // properly handle response error cases (and Deserialize the error)
    #[allow(unused)]
    code: StatusCode,
    body: Option<Arc<Body>>,
}

#[derive(Debug)]
pub struct StubRequestBuilder<'a> {
    path: String,
    method: Option<reqwest::Method>,
    body: Option<Body>,
    client: &'a mut MockingClient,
}

#[derive(Debug)]
pub struct StubResponseBuilder<'a> {
    code: StatusCode,
    body: Option<Body>,
    request_builder: StubRequestBuilder<'a>,
}

impl<'a> StubRequestBuilder<'a> {
    fn new(path: String, client: &'a mut MockingClient) -> Self {
        Self {
            path,
            method: None,
            body: None,
            client,
        }
    }

    /// Sets the method the stub request will mock
    ///
    /// If no method is set, the stub works for all methods
    #[must_use = "call .finish() to register the stub request"]
    pub fn method(mut self, method: reqwest::Method) -> Self {
        self.method = Some(method);
        self
    }

    /// Sets the expected body of the expected outgoing request
    ///
    /// If no expected body is set, the request actual body is ignored
    #[allow(unused)]
    #[must_use = "call .finish() to register the stub request"]
    pub fn body<B: Into<Body>>(mut self, body: B) -> Self {
        self.body = Some(body.into());
        self
    }

    /// Sets the mocked response associated to this stubbed request
    #[must_use = "call .finish() to register the stub request"]
    pub fn response(self, code: StatusCode) -> StubResponseBuilder<'a> {
        StubResponseBuilder {
            code,
            body: None,
            request_builder: self,
        }
    }

    /// Builds the [StubResponse] and registers it into the [MockingClient]
    #[allow(unused)]
    pub fn finish(self) {
        self.client.stubs.push(StubRequest {
            path: self.path,
            method: self.method,
            body: self.body.map(Arc::new),
            response: None,
        })
    }

    fn finish_with_response(self, response: StubResponse) {
        self.client.stubs.push(StubRequest {
            path: self.path,
            method: self.method,
            body: self.body.map(Arc::new),
            response: Some(response),
        })
    }
}

impl<'a> StubResponseBuilder<'a> {
    /// Sets the body of the mocked response
    ///
    /// If none is set, `AsCoreRequest::fetch` will return an `Err(CoreError::NoResponseContent)`
    #[must_use = "call .finish() to register the stub request"]
    pub fn body<B: Into<Body>>(mut self, body: B) -> Self {
        self.body = Some(body.into());
        self
    }

    /// Builds the [StubResponse] and registers it into the [MockingClient]
    pub fn finish(self) {
        self.request_builder.finish_with_response(StubResponse {
            code: self.code,
            body: self.body.map(Arc::new),
        })
    }
}
