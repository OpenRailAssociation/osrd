mod authorization_models;
mod queries;
mod stores;
mod tuples;

pub use authorization_models::AuthorizationModel;
pub use authorization_models::StoreAuthorizationModel;
use itertools::Either;
pub use stores::Store;

use tracing::Instrument;
use tuples::RawTuple;

use std::future::Future;
use std::future::{self};

use futures::stream;
use futures::TryStreamExt as _;
use itertools::Itertools as _;

use crate::model::AsUser;
use crate::model::Check;
use crate::model::Object;
use crate::model::ParsingError;
use crate::model::QueryObjects;
use crate::model::Relation;
use crate::model::Tuple;
use crate::model::User;

const OPENFGA_WRITES_MAX_TUPLES: usize = 100;

#[derive(Debug, Clone)]
pub struct Client {
    store: Store,
    authorization_model_id: Option<String>,
    settings: ConnectionSettings,
    inner: reqwest::Client,
}

#[derive(Debug, Clone)]
pub struct ConnectionSettings {
    address: String,
    port: u16,

    /// Whether to reset the store on initialization
    ///
    /// This parameter is only relevant when using [Client::try_new_store].
    ///
    /// It's useful if a store is created for each unit tests and the store name is the same
    /// for each run. (This typically occurs if the stores are named according to the test name.)
    reset: bool,
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
    #[error(transparent)]
    Parsing(#[from] ParsingError),
    #[error(transparent)]
    Request(#[from] RequestFailure),
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

// Public API of the client
// -------------------------

impl Client {
    #[tracing::instrument(err)]
    pub async fn try_with_store(
        store_name: String,
        settings: ConnectionSettings,
    ) -> Result<Self, InitializationError> {
        let mut client = Self {
            store: Store::default(),
            authorization_model_id: None,
            settings,
            inner: reqwest::Client::new(),
        };

        client.store = client
            .find_store(&store_name)
            .await?
            .ok_or_else(|| InitializationError::NotFound(store_name))?;
        client.actualize_authorization_model().await?;

        Ok(client)
    }

    #[tracing::instrument(err)]
    pub async fn try_new_store(
        store_name: String,
        settings: ConnectionSettings,
    ) -> Result<Client, InitializationError> {
        let mut client = Self {
            store: Store::default(),
            authorization_model_id: None,
            settings,
            inner: reqwest::Client::new(),
        };
        if client.settings.reset {
            if let Some(store) = client.find_store(&store_name).await? {
                tracing::debug!(old = ?store, "removing old store for reset");
                client.delete_stores(&store.id).await?;
            }
        }
        client.store = client.post_stores(&store_name).await?;
        Ok(client)
    }

    pub fn stores(&self) -> impl stream::TryStream<Ok = Store, Error = RequestFailure> {
        ContinuationUnfolder::new(self.clone(), ()).stream(
            |UnfoldArgs {
                 client,
                 continuation,
                 ctx: _ctx,
             }| async move {
                let (stores, continuation) = client
                    .get_stores(None, continuation.as_ref().map(String::as_str))
                    .await?;
                Ok((
                    stores,
                    UnfoldNextState {
                        ctx: (),
                        continuation,
                    },
                ))
            },
        )
    }

    #[tracing::instrument(skip(self), err)]
    pub async fn find_store(&self, store_name: &str) -> Result<Option<Store>, RequestFailure> {
        let stream = self
            .stores()
            .try_filter(|Store { name, .. }| future::ready(name == store_name));
        futures::pin_mut!(stream);
        let store = stream.try_next().await?.into_iter().last();
        Ok(store)
    }

    pub fn authorization_models(
        &self,
    ) -> impl stream::TryStream<Ok = StoreAuthorizationModel, Error = RequestFailure> {
        ContinuationUnfolder::new(self.clone(), ()).stream(
            |UnfoldArgs {
                 client,
                 continuation,
                 ctx: _ctx,
             }| async move {
                let (models, continuation) = client
                    .get_stores_authorization_models(
                        &client.store.id,
                        None,
                        continuation.as_ref().map(String::as_str),
                    )
                    .await?;
                Ok((
                    models,
                    UnfoldNextState {
                        ctx: (),
                        continuation,
                    },
                ))
            },
        )
    }

    pub async fn latest_authorization_model(
        &self,
    ) -> Result<Option<StoreAuthorizationModel>, RequestFailure> {
        let models = &mut self
            .get_stores_authorization_models(&self.store.id, Some(1), None)
            .await?
            .0;
        debug_assert!(models.len() <= 1);
        Ok(models.pop())
    }

    /// Fetches the latest authorization model ID and instructs the [Client] to use it for future API calls
    ///
    /// For API calls that use an authorization model, OpenFGA strongly recommends providing an authorization
    /// model ID so that they don't have to infer it. It helps to improve performance.
    /// This function is called automatically when a new [Client] is created with [Client::try_with_store].
    ///
    /// Note that the [Client] may still not have an authorization model ID configured after calling this function
    /// if the [Client]'s store doesn't have any authorization model yet.
    #[tracing::instrument(skip(self), err)]
    pub async fn actualize_authorization_model(&mut self) -> Result<(), RequestFailure> {
        self.authorization_model_id = self
            .latest_authorization_model()
            .await?
            .map(|model| model.id);
        tracing::debug!(
            id = self.authorization_model_id,
            "set client authorization model ID"
        );
        Ok(())
    }

    /// Pushes a new authorization model into OpenFGA and configures the client to use it from now on
    pub async fn update_authorization_model(
        &mut self,
        authorization_model: &AuthorizationModel,
    ) -> Result<String, RequestFailure> {
        let model_id = self
            .post_stores_authorization_models(&self.store.id, authorization_model)
            .await?;
        self.actualize_authorization_model().await?;
        Ok(model_id)
    }

    /// Writes up to 100 tuples in OpenFGA
    ///
    /// If the tuple slice is more than 100 elements, an error will be returned.
    /// If you want them to be chunked into several requests, or if your tuples cannot
    /// be monomorphized into a single type, use [Client::prepare_writes] instead.
    pub async fn write_tuples<'a, R: Relation, U: AsUser<User = R::User>>(
        &self,
        tuples: &[Tuple<'a, R, U>],
    ) -> Result<(), Either<RequestFailure, TooManyTuples>> {
        if tuples.len() > OPENFGA_WRITES_MAX_TUPLES {
            return Err(Either::Right(TooManyTuples {
                max: OPENFGA_WRITES_MAX_TUPLES,
                provided_count: tuples.len(),
            }));
        }
        self.post_stores_write(
            &self.store.id,
            &tuples.into_iter().map_into().collect::<Vec<_>>(),
            &[],
            self.authorization_model_id.clone(),
        )
        .await
        .map_err(Either::Left)
    }

    /// Prepares multiple write requests to OpenFGA
    ///
    /// OpenFGA Writes API do not accept more than 100 tuples per request.
    /// The [PreparedWrites] type returned by this function accepts any number
    /// of tuples through [PreparedWrites::push] and will chunk them into
    /// requests of 100 tuples each. The requests are sent concurrently when
    /// [PreparedWrites::execute] is called.
    ///
    /// Beware that the tuples injected into [PreparedWrites] cannot be accessed
    /// after a [PreparedWrites::push]. So any form of post-processing is impossible.
    /// Likewise, once a [Tuple] is injected into [PreparedWrites], all its typing information
    /// is lost.
    pub fn prepare_writes(&self) -> PreparedWrites<'_> {
        PreparedWrites {
            writes: Vec::new(),
            client: self,
        }
    }

    pub async fn check<'a, R: Relation>(
        &self,
        Check { user, object }: Check<'a, R>,
    ) -> Result<bool, RequestFailure> {
        self.post_stores_check(
            &self.store.id,
            RawTuple {
                user: User::fga_ident(user),
                relation: R::NAME.to_string(),
                object: object.fga_ident(),
            },
            None,
            self.authorization_model_id.clone(),
        )
        .await
    }

    pub async fn list_objects<'a, R: Relation, U: AsUser<User = R::User>>(
        &self,
        QueryObjects(user, _): QueryObjects<'a, R, U>,
    ) -> Result<Vec<R::Object>, QueryError> {
        let objects = self
            .post_stores_list_objects(
                &self.store.id,
                R::Object::NAMESPACE,
                R::NAME,
                &user.fga_ident(),
                None,
                None,
            )
            .await?
            .into_iter()
            .map(|ident| R::Object::parse_fga_ident(&ident))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(objects)
    }
}

pub struct PreparedWrites<'a> {
    writes: Vec<RawTuple>,
    client: &'a Client,
}

impl PreparedWrites<'_> {
    pub fn push<'a, R: Relation, U: AsUser<User = R::User>>(
        mut self,
        tuple: &Tuple<'_, R, U>,
    ) -> Self {
        self.writes.push(RawTuple::from(tuple));
        self
    }

    /// Concurrently sends write requests to OpenFGA in 100-tuple chunks
    ///
    /// /!\ WARNING /!\ No transactional state is set up, so should any request fail,
    /// the tuples written by other successful requests will remain in OpenFGA.
    /// This function also returns at the first failing request, so OpenFGA may still
    /// write some tuples **after** this function exits.
    pub async fn execute(self) -> Result<(), RequestFailure> {
        let futs = self
            .writes
            .chunks(100)
            .map(|chunk| {
                self.client
                    .post_stores_write(
                        &self.client.store.id,
                        chunk,
                        &[],
                        self.client.authorization_model_id.clone(),
                    )
                    .in_current_span()
            })
            .collect_vec();
        futures::future::try_join_all(futs).await?;
        Ok(())
    }
}

// Mapping of OpenFGA HTTP API
// ---------------------------
//
// Client functions are implemented for each OpenFGA endpoint. The implementations are
// scattered across different sub-modules, which are defined according to the sections
// of the OpenFGA API documentation: https://openfga.dev/api/service

impl Client {
    fn base_url(&self) -> url::Url {
        url::Url::parse(
            format!("http://{}:{}/", self.settings.address, self.settings.port).as_str(),
        )
        .unwrap()
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

impl<R: Relation> Request for Check<'_, R> {
    type Response = bool;

    type Error = RequestFailure;

    async fn fetch(self, client: &Client) -> Result<Self::Response, Self::Error> {
        client.check(self).await
    }
}

/// Allows transforming continuation-based paginated endpoint calls into a [stream::TryStream]
///
/// The [ContinuationUnfolder::stream] function takes a closure that will be called repeatedly until
/// the [UnfoldNextState::continuation] is empty. For lifetimes reasons, the closure is provided with
/// the ownership of the [Client] (cloned internally, but that's a cheap operation).
///
/// The [ContinuationUnfolder::stream] closure is expected to return a `Vec<T>` of items at each call,
/// but those will be flatten into a stream of `T` as expected, and not a stream of `Vec<T>`.
///
/// This unfolder can also be provided with a context that will be passed to the closure at each call.
/// The closure is free to modify it but **must** provide it anew in its result using [UnfoldNextState].
struct ContinuationUnfolder<C> {
    client: Client,
    ctx: C,
    continuation: Continuation,
}

struct UnfoldArgs<C> {
    client: Client,
    ctx: C,
    continuation: Option<String>,
}

struct UnfoldNextState<C> {
    ctx: C,
    continuation: String,
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

impl From<String> for Continuation {
    fn from(s: String) -> Self {
        if s.is_empty() {
            Continuation::Stop
        } else {
            Continuation::Continue(s)
        }
    }
}

impl<C> ContinuationUnfolder<C> {
    fn new(client: Client, ctx: C) -> Self {
        Self {
            client,
            ctx,
            continuation: Continuation::None,
        }
    }

    /// Unfolds a continuation-based paginated API call into a stream of items
    ///
    /// ```ignore
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
    /// let stream = ContinuationUnfolder::new(client, 0).stream(
    ///     |UnfoldArgs {
    ///          client: _client,
    ///          ctx: shift,
    ///          continuation,
    ///      }| async move {
    ///         let (items, continuation) = api_call(shift, continuation);
    ///         Ok((
    ///             items,
    ///             UnfoldNextState {
    ///                 ctx: shift + 10,
    ///                 continuation,
    ///             },
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
    fn stream<F, Fut, T>(self, f: F) -> impl stream::TryStream<Ok = T, Error = RequestFailure>
    where
        F: Fn(UnfoldArgs<C>) -> Fut,
        Fut: Future<Output = Result<(Vec<T>, UnfoldNextState<C>), RequestFailure>>,
    {
        struct Iter<F, C> {
            f: F,
            client: Client,
            ctx: C,
            continuation: Continuation,
        }
        let init = {
            let Self {
                client,
                ctx,
                continuation,
            } = self;
            Iter {
                f,
                client,
                ctx,
                continuation,
            }
        };

        let stream = stream::try_unfold(
            init,
            move |Iter {
                      f,
                      client,
                      ctx,
                      continuation,
                  }| {
                Box::pin(async move {
                    let continuation = match continuation {
                        Continuation::None => None,
                        Continuation::Continue(continuation) => Some(continuation),
                        Continuation::Stop => return Ok::<_, RequestFailure>(None),
                    };
                    let (items, UnfoldNextState { ctx, continuation }) = f(UnfoldArgs {
                        client: client.clone(),
                        ctx,
                        continuation,
                    })
                    .await?;
                    Ok(Some((
                        items,
                        Iter {
                            f,
                            client,
                            ctx,
                            continuation: Continuation::from(continuation),
                        },
                    )))
                })
            },
        );

        stream
            .map_ok(|items| stream::iter(items.into_iter().map(Ok)))
            .try_flatten()
    }
}

#[cfg(test)]
mod tests {
    use crate::client::Client;
    use crate::client::ConnectionSettings;
    use crate::client::InitializationError;
    use crate::client::Request as _;
    use crate::compile_model;
    use crate::defs;
    use crate::defs::*;
    use crate::fga;
    use crate::model::Check;
    use crate::model::Relation;

    fn setup_tracing() {
        tracing_subscriber::fmt()
            .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
            .without_time()
            .pretty()
            .try_init()
            .expect("tracing should setup successfully");
    }

    macro_rules! test_client {
        () => {
            Client::try_new_store(
                stdext::function_name!()
                    .split("::")
                    .filter(|x| *x != "{{closure}}")
                    .collect::<Vec<_>>()
                    .join("-"),
                ConnectionSettings {
                    address: "localhost".to_owned(),
                    port: 8080,
                    reset: true,
                },
            )
            .await
            .expect("Failed to initialize client")
        };
    }

    #[tokio::test]
    async fn test_try_init() {
        setup_tracing();
        let client = Client::try_with_store(
            "lol".to_owned(),
            ConnectionSettings {
                address: "localhost".to_owned(),
                port: 8080,
                reset: false,
            },
        )
        .await
        .unwrap();
        assert_eq!(client.store.name, "lol");
    }

    #[tokio::test]
    async fn test_try_init_not_found() {
        setup_tracing();
        let result = Client::try_with_store(
            "nonexistent_store".to_owned(),
            ConnectionSettings {
                address: "localhost".to_owned(),
                port: 8080,
                reset: false,
            },
        )
        .await;

        match result {
            Err(InitializationError::NotFound(store_name)) => {
                assert_eq!(store_name, "nonexistent_store");
            }
            _ => panic!("Expected InitializationError::NotFound"),
        }
    }

    #[tokio::test]
    async fn create_store_with_reset() {
        setup_tracing();
        let client = test_client!();
        assert_eq!(
            client.store.name,
            "fga-client-tests-create_store_with_reset"
        );
    }

    impl Client {
        // TODO: comment about tokio::test
        #[track_caller]
        fn assert_check<'a, R: Relation>(&self, check: Check<'a, R>) -> &Self {
            let error = format!("{check:?} doesn't hold, WWWHHHHYYYYY???");
            let ok = futures::executor::block_on(check.fetch(self)).unwrap();
            assert!(ok, "{error}");
            self
        }

        #[track_caller]
        fn assert_check_not<'a, R: Relation>(&self, check: Check<'a, R>) -> &Self {
            let error = format!("{check:?} does hold, it shouldn't tho");
            let ok = futures::executor::block_on(check.fetch(self)).unwrap();
            assert!(!ok, "{error}");
            self
        }
    }

    const MODEL: &'static str = include_str!("../tests/model.fga");

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn persisted_auth_model_id_in_client() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        assert_eq!(client.authorization_model_id, None);
        let id = client.update_authorization_model(&model).await.unwrap();
        assert_eq!(client.authorization_model_id, Some(id));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn check() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        let alice = fga!(User:"alice");
        let bob = fga!(User:"bob");
        let infra = fga!(Infra:"france");
        client
            .write_tuples(&[defs::Infra::reader().tuple(&bob, &infra)])
            .await
            .unwrap();

        client
            .assert_check(defs::Infra::can_read().check(&bob, &infra))
            .assert_check_not(defs::Infra::can_read().check(&alice, &infra));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn higher_order_users() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        let alice = fga!(User:"alice");
        let bob = fga!(User:"bob");
        let france = fga!(Infra:"france");
        let spain = fga!(Infra:"espagne");

        client
            .prepare_writes()
            .push(&fga!(Infra:"france"#reader@User:"alice"))
            .push(&fga!(Infra:"espagne"#reader@User:*))
            .execute()
            .await
            .unwrap();

        client
            .assert_check(defs::Infra::can_read().check(&alice, &france))
            .assert_check_not(defs::Infra::can_read().check(&bob, &france))
            .assert_check(defs::Infra::can_read().check(&alice, &spain))
            .assert_check(defs::Infra::can_read().check(&bob, &spain));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_objects() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        let alice = fga!(User:"alice");
        let france = fga!(Infra:"france");
        let spain = fga!(Infra:"espagne");
        client
            .write_tuples(&[
                defs::Infra::reader().tuple(&alice, &france),
                defs::Infra::reader().tuple(&alice, &spain),
            ])
            .await
            .unwrap();

        let mut objects = client
            .list_objects(defs::Infra::can_read().query_objects(&alice))
            .await
            .unwrap();
        objects.sort();
        assert_eq!(objects.as_slice(), &[spain, france]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_objects_unknown_user() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        let bob = fga!(User:"bob");
        let alice = fga!(User:"alice");
        let france = fga!(Infra:"france");
        let spain = fga!(Infra:"espagne");
        client
            .write_tuples(&[
                defs::Infra::reader().tuple(&alice, &france),
                defs::Infra::reader().tuple(&alice, &spain),
            ])
            .await
            .unwrap();

        // bob has no tuple, so OpenFGA doesn't know about him
        let objects = client
            .list_objects(defs::Infra::can_read().query_objects(&bob))
            .await
            .unwrap();
        assert!(objects.is_empty());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_objects_higher_order_users() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        client
            .prepare_writes()
            .push(&fga!(Infra:"france"#reader@User:"alice"))
            .push(&fga!(Infra:"espagne"#reader@User:*))
            .push(&fga!(Group:"les_petits_pedestres"#member@User:"alice"))
            .push(&fga!(Infra:"allemagne"#reader@Group:"les_petits_pedestres"#member))
            .execute()
            .await
            .unwrap();

        let objects = client
            .list_objects(defs::Infra::can_read().query_objects(&fga!(User:*)))
            .await
            .unwrap();
        assert_eq!(objects.as_slice(), &[fga!(Infra:"espagne")]);

        let objects = client
            .list_objects(defs::Infra::can_read().query_objects(&fga!(User:"bob")))
            .await
            .unwrap();
        assert_eq!(objects.as_slice(), &[fga!(Infra:"espagne")]);

        let mut objects = client
            .list_objects(defs::Infra::can_read().query_objects(&fga!(User:"alice")))
            .await
            .unwrap();
        objects.sort();
        assert_eq!(
            objects.as_slice(),
            &[
                fga!(Infra:"allemagne"),
                fga!(Infra:"espagne"),
                fga!(Infra:"france")
            ]
        );
    }
}
