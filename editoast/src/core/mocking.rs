use std::sync::Arc;

use super::{Client, CoreClient};
use actix_http::{StatusCode, Uri};
use reqwest::Body;
use serde::{de::DeserializeOwned, Serialize};

/// A mocking core client maintaining a list of stub requests to simulate
///
/// See [MockingClient::stub]
#[derive(Debug, Default)]
pub struct MockingClient {
    stubs: Vec<StubRequest>,
}

impl From<MockingClient> for Client {
    fn from(value: MockingClient) -> Self {
        Self::Mocked(value)
    }
}

impl From<MockingClient> for CoreClient {
    fn from(value: MockingClient) -> Self {
        Self::new(value)
    }
}

impl MockingClient {
    pub fn new() -> Self {
        Default::default()
    }

    /// Creates a stub request
    #[must_use = "call .finish() to register the stub request"]
    pub fn stub<U: TryInto<Uri>>(&mut self, uri: U) -> StubRequestBuilder {
        let Ok(uri) = uri.try_into() else {
            panic!("stub uri should be valid");
        };
        StubRequestBuilder::new(uri, self)
    }

    pub(super) fn fetch_mocked<B: Serialize, R: DeserializeOwned>(
        &self,
        method: reqwest::Method,
        req_uri: &Uri,
        body: Option<&B>,
    ) -> Option<R> {
        let stub = 'find_stub: {
            for stub in &self.stubs {
                match stub {
                    StubRequest {
                        uri, method: None, ..
                    } if uri == req_uri => break 'find_stub Some(stub),
                    StubRequest {
                        uri,
                        method: Some(meth),
                        ..
                    } if uri == req_uri && meth == method => break 'find_stub Some(stub),
                    _ => (),
                };
            }
            None
        };
        let Some(stub) = stub else {
            panic!("could not find stub for {method} resquest at URI {req_uri}")
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
        stub.response
            .as_ref()
            .and_then(|r| r.body.as_ref())
            .map(|b| {
                serde_json::from_slice(
                    b.as_bytes()
                        .expect("mocked response body should not be empty when specified"),
                )
                .expect("mocked response body should deserialize faultlessly")
            })
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
    uri: Uri,
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
    uri: Uri,
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
    fn new(uri: Uri, client: &'a mut MockingClient) -> Self {
        Self {
            uri,
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
            uri: self.uri,
            method: self.method,
            body: self.body.map(Arc::new),
            response: None,
        })
    }

    fn finish_with_response(self, response: StubResponse) {
        self.client.stubs.push(StubRequest {
            uri: self.uri,
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
