mod api;
mod authorization_models;
mod queries;
mod stores;
mod tuples;

pub use authorization_models::AuthorizationModel;
pub use authorization_models::StoreAuthorizationModel;
pub use queries::UserList;
pub use stores::Store;
pub use tuples::UntypedTuple;
pub use tuples::UntypedUserSet;
pub use tuples::UserOrUserSet;

use url::Url;

use std::future::Future;
use std::future::{self};

use futures::TryStreamExt as _;
use futures::stream;

use crate::client::api::healthz::Health;

pub const DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK: u32 = 50;
pub const DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE: u64 = 100;

#[derive(Debug, Clone)]
pub struct Client {
    store: Store,
    authorization_model_id: Option<String>,
    settings: ConnectionSettings,
    inner: reqwest::Client,
}

#[derive(Debug, Clone)]
pub struct ConnectionSettings {
    url: Url,
    limits: Limits,

    /// Whether to reset the store on initialization
    ///
    /// This parameter is only relevant when using [Client::try_new_store].
    ///
    /// It's useful if a store is created for each unit tests and the store name is the same
    /// for each run. (This typically occurs if the stores are named according to the test name.)
    reset_store: bool,
}

/// Limits to the payloads sent to the authentication server. For more information about these limits,
/// check [OpenFGA official documentation](https://openfga.dev/docs/getting-started/setup-openfga/configuration).
#[derive(Debug, Clone)]
pub struct Limits {
    pub max_checks_per_batch_check: u32,
    pub max_tuples_per_write: u64,
}

impl Default for Limits {
    fn default() -> Self {
        Limits {
            max_checks_per_batch_check: DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK,
            max_tuples_per_write: DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE,
        }
    }
}

impl ConnectionSettings {
    pub fn new(url: Url, limits: Limits) -> Self {
        Self {
            url,
            limits,
            reset_store: false,
        }
    }

    pub fn reset_store(mut self) -> Self {
        self.reset_store = true;
        self
    }

    pub fn limit(&self) -> &Limits {
        &self.limits
    }
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Consistency {
    MinimizeLatency,
    HigherConsistency,
}

#[derive(Debug, thiserror::Error)]
#[error("HTTP request to OpenFGA failed: {0}")]
pub struct RequestFailure(#[source] reqwest::Error);

#[derive(Debug, thiserror::Error)]
pub enum InitializationError {
    #[error("Store not found: {0}")]
    NotFound(String),
    #[error(transparent)]
    Request(#[from] RequestFailure),
}

#[derive(Debug, thiserror::Error)]
#[error("Too many tuples provided ({provided_count}): hard limit set to {max}")]
pub struct TooManyTuples {
    max: usize,
    provided_count: usize,
}

#[derive(Debug, thiserror::Error)]
pub enum QueryError {
    #[error("Cannot parse OpenFGA value identifier as '{expected_type}': '{ident}'")]
    Parsing {
        ident: String,
        expected_type: &'static str,
    },
    #[error(transparent)]
    Request(#[from] RequestFailure),
}

impl QueryError {
    pub fn parsing_ok(self) -> RequestFailure {
        match self {
            QueryError::Parsing {
                ident,
                expected_type,
            } => {
                tracing::error!(ident, expected_type, "failed to parse OpenFGA value");
                panic!(
                    "failed to parse OpenFGA value '{ident}' as '{expected_type}': a migration is probably missing",
                );
            }
            QueryError::Request(request_failure) => request_failure,
        }
    }
}

impl From<reqwest::Error> for RequestFailure {
    fn from(error: reqwest::Error) -> Self {
        #[cfg(any(debug_assertions, test))]
        let err = RequestFailure(error);
        #[cfg(all(not(debug_assertions), not(test)))]
        let err = RequestFailure(error.without_url());
        err
    }
}

impl Client {
    pub async fn is_healthy(&self) -> Result<bool, RequestFailure> {
        Ok(matches!(self.get_healthz().await?, Health::Serving))
    }

    fn base_url(&self) -> &url::Url {
        &self.settings.url
    }
}

/// Convenience trait to query OpenFGA from [crate::model] query types directly
///
/// For example:
///
/// ```no_run
/// # include!("doctest_setup.rs");
/// # fga::relations! { Document { relation: Person }}
/// # type Object = Document;
/// # #[tokio::main]
/// # async fn main() {
/// # let user = Person("bob".to_owned());
/// # let object = Document("topsecret".to_owned());
/// # let client = todo!();
/// # use fga::client::Request as _;
/// Object::relation().check(&user, &object).fetch(&client).await.unwrap();
/// // instead of
/// client.check(Object::relation().check(&user, &object)).await.unwrap();
/// # }
/// ```
pub trait Request {
    type Response;
    type Error: std::error::Error;

    fn fetch(
        self,
        client: &Client,
    ) -> impl future::Future<Output = Result<Self::Response, Self::Error>>;
}

/// Models the three states of a continuation while unfolding paginated API calls
enum Continuation {
    /// Initial state, no calls have been made yet
    None,
    /// A call response has provided a continuation token
    Continue(String),
    /// A call response has provided no continuation token (an empty string) meaning that the pagination ends there
    Stop,
}

impl Continuation {
    fn as_option(&self) -> Option<&str> {
        match self {
            Continuation::None | Continuation::Stop => None,
            Continuation::Continue(continuation) => Some(continuation.as_str()),
        }
    }
}

impl From<String> for Continuation {
    fn from(s: String) -> Self {
        if s.is_empty() {
            Continuation::Stop
        } else {
            Continuation::Continue(s)
        }
    }
}

impl Continuation {
    /// Unfolds a continuation-based paginated API call into a stream of items
    ///
    /// ```ignore
    /// # internal API, cannot be doc tested
    /// #
    /// fn api_call(shift: u64, cont: Option<String>) -> (Vec<u64>, String) {
    ///     let Some(page) = cont.and_then(|s| s.parse::<u64>().ok()) else {
    ///         return (vec![shift], "1".to_string());
    ///     };
    ///     if page < 3 {
    ///         (
    ///             (1..(page + 1)).map(|x| x + shift).collect(),
    ///             (page + 1).to_string(),
    ///         )
    ///     } else {
    ///         (vec![], "".to_string())
    ///     }
    /// }
    ///
    /// let stream = Continuation::stream(
    ///     move |continuation| async move {
    ///         let (items, continuation_str) = api_call(shift, continuation);
    ///         Ok((
    ///             items,
    ///             Continuation::from(continuation_str),
    ///         ))
    ///     },
    /// );
    /// assert_eq!(
    ///     stream.try_collect::<Vec<_>>().await.unwrap(),
    ///     vec![0, 11, 21, 22]
    /// );
    /// ```
    ///
    // TODO: rewrite that using async closures once rust 1.85 lands :pepoparty:
    fn stream<F, Fut, T>(f: F) -> impl stream::TryStream<Ok = T, Error = RequestFailure>
    where
        F: Fn(Continuation) -> Fut + Copy,
        Fut: Future<Output = Result<(Vec<T>, Continuation), RequestFailure>>,
    {
        let stream = stream::try_unfold(Continuation::None, move |continuation| {
            Box::pin(async move {
                if let Continuation::Stop = continuation {
                    return Ok::<_, RequestFailure>(None);
                }
                let (items, continuation) = f(continuation).await?;
                Ok(Some((items, continuation)))
            })
        });

        stream
            .map_ok(|items| stream::iter(items.into_iter().map(Ok)))
            .try_flatten()
    }
}

#[cfg(test)]
fn setup_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .without_time()
        .pretty()
        .try_init()
        .ok();
}

#[cfg(test)]
mod tests {
    use crate::test_client;

    use super::*;

    #[tokio::test]
    async fn is_healthy() {
        setup_tracing();
        let client = test_client!();
        assert!(client.is_healthy().await.unwrap());
    }
}
