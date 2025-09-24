use std::collections::HashMap;
use std::collections::VecDeque;
use std::ops::Deref;
use std::sync::Arc;
use std::sync::Mutex;

use http::StatusCode;
use serde::Serialize;

use super::CoreClient;
use super::CoreResponse;

/// A mocking core client maintaining a list of stub requests to simulate
///
/// See [MockingClient::stub]
#[derive(Debug, Default, Clone)]
pub struct MockingClient {
    stubs: HashMap<String, Arc<Mutex<VecDeque<StubRequest>>>>,
}

impl From<MockingClient> for CoreClient {
    fn from(value: MockingClient) -> Self {
        Self::Mocked(value)
    }
}

#[derive(Debug)]
pub struct MockingError {
    pub bytes: Vec<u8>,
    pub url: String,
}

impl MockingClient {
    pub fn new() -> Self {
        Default::default()
    }

    /// Creates a stub request
    #[must_use = "call .finish() to register the stub request"]
    pub fn stub<U: AsRef<str>>(&mut self, path: U) -> StubRequestBuilder<'_> {
        StubRequestBuilder::new(path.as_ref().into(), self)
    }

    pub(super) fn fetch_mocked<P: AsRef<str>, B: Serialize, R: CoreResponse>(
        &self,
        req_path: P,
        req_body: Option<&B>,
    ) -> Result<Option<R::Response>, MockingError> {
        let req_path = req_path.as_ref().to_string();

        let Some(stub) = self
            .stubs
            .get(&req_path)
            .and_then(|stubs| stubs.deref().lock().unwrap().pop_front())
        else {
            panic!("could not find stub for request at PATH '{req_path}'");
        };

        match (
            req_body.map(|b| serde_json::to_string(b).expect("could not serialize request body")),
            stub.body.as_ref().map(|b| b.as_str().to_string()),
        ) {
            (Some(actual), Some(expected)) => assert_eq!(actual, expected, "request body mismatch"),
            (None, Some(expected)) => panic!("missing request body: '{expected}'"),
            _ => (),
        }
        let response = stub
            .response
            .as_ref()
            .and_then(|r| r.body.as_ref())
            .map(|b| b.as_bytes());
        match stub.response {
            None => Ok(None),
            Some(StubResponse { code, .. }) if code.is_success() => Ok(Some(
                R::from_bytes(
                    response.expect("mocked response body should not be empty when specified"),
                )
                .expect("mocked response body should deserialize faultlessly"),
            )),
            Some(StubResponse { .. }) => {
                let err = response
                    .expect("mocked response body should not be empty when specified")
                    .to_vec();
                Err(MockingError {
                    bytes: err,
                    url: req_path,
                })
            }
        }
    }
}

/// A stub request used to assert the validity of an incoming request to mock
#[derive(Debug, Clone)]
pub struct StubRequest {
    body: Option<Arc<String>>,
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
    body: Option<Arc<String>>,
}

#[derive(Debug)]
pub struct StubRequestBuilder<'a> {
    path: String,
    body: Option<Arc<String>>,
    client: &'a mut MockingClient,
}

#[derive(Debug)]
pub struct StubResponseBuilder<'a> {
    code: StatusCode,
    bodies: Vec<Option<Arc<String>>>,
    request_builder: StubRequestBuilder<'a>,
}

impl<'a> StubRequestBuilder<'a> {
    fn new(path: String, client: &'a mut MockingClient) -> Self {
        Self {
            path,
            body: None,
            client,
        }
    }

    /// Sets the expected body of the expected outgoing request
    ///
    /// If no expected body is set, the request actual body is ignored
    #[allow(unused)]
    #[must_use = "call .finish() to register the stub request"]
    pub fn body<B: AsRef<str>>(mut self, body: B) -> Self {
        self.body = Some(Arc::new(body.as_ref().to_string()));
        self
    }

    /// Sets the mocked response associated to this stubbed request
    #[must_use = "call .finish() to register the stub request"]
    pub fn response(self, code: StatusCode) -> StubResponseBuilder<'a> {
        StubResponseBuilder {
            code,
            bodies: Vec::new(),
            request_builder: self,
        }
    }

    /// Builds the [StubResponse] and registers it into the [MockingClient]
    #[allow(unused)]
    pub fn finish(self) {
        self.client
            .stubs
            .entry(self.path)
            .or_default()
            .deref()
            .lock()
            .unwrap()
            .push_back(StubRequest {
                body: self.body,
                response: None,
            })
    }

    fn finish_with_responses(self, responses: Vec<StubResponse>) {
        let stubs = self.client.stubs.entry(self.path).or_default();
        responses
            .into_iter()
            .map(Some)
            .map(|response| StubRequest {
                body: self.body.clone(),
                response,
            })
            .for_each(|stub| stubs.deref().lock().unwrap().push_back(stub));
    }
}

impl StubResponseBuilder<'_> {
    /// Sets the body of the mocked response
    ///
    /// If none is set, `AsCoreRequest::fetch` will return an `Err(CoreError::NoResponseContent)`
    #[must_use = "call .finish() to register the stub request"]
    pub fn body<B: AsRef<str>>(mut self, body: B) -> Self {
        self.bodies.push(Some(Arc::new(body.as_ref().to_string())));
        self
    }

    #[allow(unused)]
    #[must_use = "call .finish() to register the stub request"]
    pub fn json<T: Serialize>(mut self, body: T) -> Self {
        let json_body = serde_json::to_string(&body).expect("Failed to serialize JSON");
        self.bodies.push(Some(Arc::new(json_body)));
        self
    }

    /// Builds the [StubResponse] and registers it into the [MockingClient]
    pub fn finish(self) {
        let responses = self
            .bodies
            .into_iter()
            .map(|body| StubResponse {
                code: self.code,
                body,
            })
            .collect();
        self.request_builder.finish_with_responses(responses)
    }
}
