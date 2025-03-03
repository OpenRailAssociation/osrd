mod authorization_models;
mod healthz;
mod queries;
mod stores;
mod tuples;

pub use authorization_models::AuthorizationModel;
pub use authorization_models::StoreAuthorizationModel;
use itertools::Either;
use queries::RawUser;
use queries::UserFilter;
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
use crate::model::QueryUsers;
use crate::model::QueryUsersets;
use crate::model::Relation;
use crate::model::Tuple;
use crate::model::Type;
use crate::model::User;
use crate::model::Wildcard;

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
    reset_store: bool,
}

impl ConnectionSettings {
    pub fn new(address: String, port: u16) -> Self {
        Self {
            address,
            port,
            reset_store: false,
        }
    }

    pub fn reset_store(mut self) -> Self {
        self.reset_store = true;
        self
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
        if client.settings.reset_store {
            if let Some(store) = client.find_store(&store_name).await? {
                tracing::debug!(old = ?store, "removing old store for reset");
                client.delete_stores(&store.id).await?;
            }
        }
        client.store = client.post_stores(&store_name).await?;
        Ok(client)
    }

    pub async fn is_healthy(&self) -> Result<bool, RequestFailure> {
        Ok(matches!(
            self.get_healthz().await?,
            healthz::Health::Serving
        ))
    }

    pub fn stores(&self) -> impl stream::TryStream<Ok = Store, Error = RequestFailure> + '_ {
        Continuation::stream(move |continuation| {
            async move {
                let (stores, continuation_str) =
                    self.get_stores(None, continuation.as_option()).await?;
                Ok((stores, Continuation::from(continuation_str)))
            }
            .in_current_span()
        })
    }

    #[tracing::instrument(skip(self), err)]
    pub async fn find_store(&self, store_name: &str) -> Result<Option<Store>, RequestFailure> {
        let stream = self
            .stores()
            .try_filter(|Store { name, .. }| future::ready(name == store_name));
        futures::pin_mut!(stream);
        let store = stream.try_next().await?.into_iter().next_back();
        Ok(store)
    }

    pub fn authorization_models(
        &self,
    ) -> impl stream::TryStream<Ok = StoreAuthorizationModel, Error = RequestFailure> + '_ {
        Continuation::stream(move |continuation| {
            async move {
                let (models, continuation_str) = self
                    .get_stores_authorization_models(&self.store.id, None, continuation.as_option())
                    .await?;
                Ok((models, Continuation::from(continuation_str)))
            }
            .in_current_span()
        })
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
    ///
    /// Warning: just like OpenFGA's Write API, this function is **not** idempotent.
    /// If a tuple is written twice, the second write will fail.
    pub async fn write_tuples<R: Relation, U: AsUser<User = R::User>>(
        &self,
        tuples: &[Tuple<'_, R, U>],
    ) -> Result<(), Either<RequestFailure, TooManyTuples>> {
        if tuples.len() > OPENFGA_WRITES_MAX_TUPLES {
            return Err(Either::Right(TooManyTuples {
                max: OPENFGA_WRITES_MAX_TUPLES,
                provided_count: tuples.len(),
            }));
        }
        self.post_stores_write(
            &self.store.id,
            &tuples.iter().map_into().collect::<Vec<_>>(),
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
    ///
    /// Like [Client::write_tuples], this function is not idempotent.
    pub fn prepare_writes(&self) -> PreparedWrites<'_> {
        PreparedWrites {
            writes: Vec::new(),
            client: self,
        }
    }

    /// Deletes up to 100 tuples in OpenFGA
    ///
    /// If the tuple slice is more than 100 elements, an error will be returned.
    /// If you want them to be chunked into several requests, or if your tuples cannot
    /// be monomorphized into a single type, use [Client::prepare_deletes] instead.
    ///
    /// Warning: just like OpenFGA's Write API, this function is **not** idempotent.
    /// If a tuple is deleted twice, the second delete will fail.
    pub async fn delete_tuples<R: Relation, U: AsUser<User = R::User>>(
        &self,
        tuples: &[Tuple<'_, R, U>],
    ) -> Result<(), Either<RequestFailure, TooManyTuples>> {
        if tuples.len() > OPENFGA_WRITES_MAX_TUPLES {
            return Err(Either::Right(TooManyTuples {
                max: OPENFGA_WRITES_MAX_TUPLES,
                provided_count: tuples.len(),
            }));
        }
        self.post_stores_write(
            &self.store.id,
            &[],
            &tuples.iter().map_into().collect::<Vec<_>>(),
            self.authorization_model_id.clone(),
        )
        .await
        .map_err(Either::Left)
    }

    /// Prepares multiple delete requests to OpenFGA
    ///
    /// OpenFGA Writes API do not accept more than 100 tuples per request.
    /// The [PreparedDeletes] type returned by this function accepts any number
    /// of tuples through [PreparedDeletes::push] and will chunk them into
    /// requests of 100 tuples each. The requests are sent concurrently when
    /// [PreparedDeletes::execute] is called.
    ///
    /// Beware that the tuples injected into [PreparedDeletes] cannot be accessed
    /// after a [PreparedDeletes::push]. So any form of post-processing is impossible.
    /// Likewise, once a [Tuple] is injected into [PreparedDeletes], all its typing information
    /// is lost.
    ///
    /// Like [Client::delete_tuples], this function is not idempotent.
    pub fn prepare_deletes(&self) -> PreparedDeletes<'_> {
        PreparedDeletes {
            deletes: Vec::new(),
            client: self,
        }
    }

    pub async fn check<R: Relation>(
        &self,
        Check { user, object }: Check<'_, R>,
    ) -> Result<bool, RequestFailure> {
        self.post_stores_check(
            &self.store.id,
            RawTuple {
                user: User::fga_user(user),
                relation: R::NAME.to_string(),
                object: object.fga_object(),
            },
            None,
            self.authorization_model_id.clone(),
        )
        .await
    }

    pub async fn list_objects<R: Relation, U: AsUser<User = R::User>>(
        &self,
        QueryObjects(user, _): QueryObjects<'_, R, U>,
    ) -> Result<Vec<R::Object>, QueryError> {
        let objects = self
            .post_stores_list_objects(
                &self.store.id,
                <R::Object as crate::model::Type>::NAMESPACE,
                R::NAME,
                &user.fga_user(),
                None,
                None,
            )
            .await?
            .into_iter()
            .map(|ident| R::Object::parse_fga_object(&ident))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(objects)
    }

    /// Lists the users related to a given object
    ///
    /// In case of an heterogeneous relation, only the users of the type represented
    /// by `R::User` will be returned. The type-bound public access for `R::User` (if any)
    /// will also be returned.
    ///
    /// If you want to query the usersets related to the object instead, use `Client::query_usersets`.
    pub async fn list_users<R: Relation>(
        &self,
        QueryUsers(object): QueryUsers<'_, R>,
    ) -> Result<UserList<R::User>, RequestFailure> {
        let raw_users = self
            .post_stores_list_users(
                &self.store.id,
                (<R::Object as crate::model::Type>::NAMESPACE, object.id()),
                R::NAME,
                UserFilter::User {
                    r#type: <R::User as crate::model::Type>::NAMESPACE,
                },
                None,
                self.authorization_model_id.as_deref(),
                None,
            )
            .await?;
        Ok({
            let mut users = Vec::with_capacity(raw_users.len());
            let mut public_access = None;
            for raw_user in raw_users {
                match raw_user {
                    RawUser::Object { r#type, id } => {
                        debug_assert_eq!(r#type.as_str(), R::User::NAMESPACE);
                        let user = R::User::from(id.to_owned());
                        users.push(user);
                    }
                    RawUser::Wildcard { r#type } => {
                        debug_assert_eq!(r#type.as_str(), R::User::NAMESPACE);
                        public_access = Some(Wildcard(std::marker::PhantomData));
                    }
                    RawUser::UserSet { .. } => {
                        unreachable!("OpenFGA cannot return usersets when `user_filter` is configured like above")
                    }
                }
            }
            UserList {
                users,
                public_access,
            }
        })
    }

    /// Lists the objects forming a userset which has a relation to a given object
    ///
    /// ```
    /// # include!("doctest_setup.rs");
    /// # use fga::fga;
    /// # #[tokio::main]
    /// # async fn main() {
    /// # let mut client = fga::Client::try_new_store("doctest_list_usersets".to_owned(), settings()).await.unwrap();
    /// # client.update_authorization_model(&fga::compile_model(include_str!("../tests/doctest.fga"))).await.unwrap();
    /// // define can_read: reader or writer
    /// client.prepare_writes()
    ///     .push(&fga!(Document:"budget"#reader@Group:"friends"#member))
    ///     .push(&fga!(Document:"budget"#writer@Group:"bosses"#member))
    ///     .execute()
    ///     .await
    ///     .unwrap();
    ///
    /// let groups = client
    ///     // "I want the Groups which members can_read the Document 'budget'"
    ///     .list_usersets(Document::can_read().query_usersets(Group::member(), &fga!(Document:"budget")))
    ///     .await
    ///     .unwrap();
    /// assert!(groups.contains(&fga!(Group:"friends")));
    /// assert!(groups.contains(&fga!(Group:"bosses")));
    /// # }
    pub async fn list_usersets<R: Relation, S: Relation>(
        &self,
        QueryUsersets(object, _): QueryUsersets<'_, R, S>,
    ) -> Result<Vec<S::Object>, RequestFailure> {
        let users = self
            .post_stores_list_users(
                &self.store.id,
                (<R::Object as crate::model::Type>::NAMESPACE, object.id()),
                R::NAME,
                UserFilter::UserSet {
                    r#type: <S::Object as crate::model::Type>::NAMESPACE,
                    relation: S::NAME,
                },
                None,
                self.authorization_model_id.as_deref(),
                None,
            )
            .await?;
        Ok(users
            .into_iter()
            .map(|user| match user {
                RawUser::UserSet { r#type, id, relation } => {
                    debug_assert_eq!(r#type.as_str(), S::Object::NAMESPACE);
                    debug_assert_eq!(relation.as_str(), S::NAME);
                    S::Object::from(id)
                }
                _ => {
                    unreachable!("OpenFGA cannot return anything other than usersets when the `user_filter` is configured like above");
                }
            })
            .collect_vec())
    }
}

/// Result of a [Client::list_users] query
pub struct UserList<U: User> {
    /// The list of users related to an object
    pub users: Vec<U>,
    /// Whether the object has a user type `U` type-bound public access
    pub public_access: Option<Wildcard<U>>,
}

pub struct PreparedWrites<'a> {
    writes: Vec<RawTuple>,
    client: &'a Client,
}

impl PreparedWrites<'_> {
    pub fn push<R: Relation, U: AsUser<User = R::User>>(mut self, tuple: &Tuple<'_, R, U>) -> Self {
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

pub struct PreparedDeletes<'a> {
    deletes: Vec<RawTuple>,
    client: &'a Client,
}

impl PreparedDeletes<'_> {
    pub fn push<R: Relation, U: AsUser<User = R::User>>(mut self, tuple: &Tuple<'_, R, U>) -> Self {
        self.deletes.push(RawTuple::from(tuple));
        self
    }

    /// Concurrently sends delete requests to OpenFGA in 100-tuple chunks
    ///
    /// /!\ WARNING /!\ No transactional state is set up, so should any request fail,
    /// the tuples deleted by other successful requests will remain deleted in OpenFGA.
    /// This function also returns at the first failing request, so OpenFGA may still
    /// delete some tuples **after** this function exits.
    pub async fn execute(self) -> Result<(), RequestFailure> {
        let futs = self
            .deletes
            .chunks(100)
            .map(|chunk| {
                self.client
                    .post_stores_write(
                        &self.client.store.id,
                        &[],
                        chunk,
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

impl<R, U> Request for QueryObjects<'_, R, U>
where
    R: Relation,
    U: AsUser<User = R::User>,
{
    type Response = Vec<R::Object>;

    type Error = QueryError;

    async fn fetch(self, client: &Client) -> Result<Self::Response, Self::Error> {
        client.list_objects(self).await
    }
}

impl<R: Relation> Request for QueryUsers<'_, R> {
    type Response = UserList<R::User>;

    type Error = RequestFailure;

    async fn fetch(self, client: &Client) -> Result<Self::Response, Self::Error> {
        client.list_users(self).await
    }
}

impl<R: Relation, S: Relation> Request for QueryUsersets<'_, R, S> {
    type Response = Vec<S::Object>;

    type Error = RequestFailure;

    async fn fetch(self, client: &Client) -> Result<Self::Response, Self::Error> {
        client.list_usersets(self).await
    }
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
mod tests {
    use crate::client::Client;
    use crate::client::InitializationError;
    use crate::client::Request as _;
    use crate::compile_model;
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
            .ok();
    }

    macro_rules! test_client {
        () => {
            Client::try_new_store(
                stdext::function_name!()
                    .split("::")
                    .filter(|x| *x != "{{closure}}")
                    .collect::<Vec<_>>()
                    .join("-"),
                crate::connection_settings(),
            )
            .await
            .expect("Failed to initialize client")
        };
    }

    #[tokio::test]
    async fn test_try_init_not_found() {
        setup_tracing();
        let result =
            Client::try_with_store("nonexistent_store".to_owned(), crate::connection_settings())
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

    #[tokio::test]
    async fn is_healthy() {
        setup_tracing();
        let client = test_client!();
        assert!(client.is_healthy().await.unwrap());
    }

    impl Client {
        // TODO: comment about tokio::test
        #[track_caller]
        fn assert_check<R: Relation>(&self, check: Check<'_, R>) -> &Self {
            let error = format!("{check:?} doesn't hold, WWWHHHHYYYYY???");
            let ok = futures::executor::block_on(check.fetch(self)).unwrap();
            assert!(ok, "{error}");
            self
        }

        #[track_caller]
        fn assert_check_not<R: Relation>(&self, check: Check<'_, R>) -> &Self {
            let error = format!("{check:?} does hold, it shouldn't tho");
            let ok = futures::executor::block_on(check.fetch(self)).unwrap();
            assert!(!ok, "{error}");
            self
        }
    }

    const MODEL: &str = include_str!("../tests/model.fga");

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
        client
            .write_tuples(&[fga!(Infra:"france"#reader@User:"bob")])
            .await
            .unwrap();

        client
            .assert_check(Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"france")))
            .assert_check_not(Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"france")));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn higher_order_users() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();

        client
            .prepare_writes()
            .push(&fga!(Infra:"france"#reader@User:"alice"))
            .push(&fga!(Infra:"espagne"#reader@User:*))
            .execute()
            .await
            .unwrap();

        client
            .assert_check(Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"france")))
            .assert_check_not(Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"france")))
            .assert_check(Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"espagne")))
            .assert_check(Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"espagne")));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_objects() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        client
            .write_tuples(&[
                Infra::reader().tuple(&fga!(User:"alice"), &fga!(Infra:"france")),
                Infra::reader().tuple(&fga!(User:"alice"), &fga!(Infra:"espagne")),
            ])
            .await
            .unwrap();

        let mut objects = client
            .list_objects(Infra::can_read().query_objects(&fga!(User:"alice")))
            .await
            .unwrap();
        objects.sort();
        assert_eq!(objects, vec![fga!(Infra:"espagne"), fga!(Infra:"france")]);

        let mut same_objects = Infra::can_read()
            .query_objects(&fga!(User:"alice"))
            .fetch(&client)
            .await
            .unwrap();
        same_objects.sort();
        assert_eq!(same_objects, objects);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_objects_unknown_user() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        client
            .write_tuples(&[
                Infra::reader().tuple(&fga!(User:"alice"), &fga!(Infra:"france")),
                Infra::reader().tuple(&fga!(User:"alice"), &fga!(Infra:"espagne")),
            ])
            .await
            .unwrap();

        // bob has no tuple, so OpenFGA doesn't know about him
        let objects = client
            .list_objects(Infra::can_read().query_objects(&fga!(User:"bob")))
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
            .list_objects(Infra::can_read().query_objects(&fga!(User:*)))
            .await
            .unwrap();
        assert_eq!(objects.as_slice(), &[fga!(Infra:"espagne")]);

        let objects = client
            .list_objects(Infra::can_read().query_objects(&fga!(User:"bob")))
            .await
            .unwrap();
        assert_eq!(objects.as_slice(), &[fga!(Infra:"espagne")]);

        let mut objects = client
            .list_objects(Infra::can_read().query_objects(&fga!(User:"alice")))
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_users() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();

        client
            .prepare_writes()
            // direct accesses
            .push(&fga!(Infra:"fr"#reader@User:"alice"))
            .push(&fga!(Infra:"es"#writer@User:"alice"))
            .push(&fga!(Infra:"es"#reader@User:"bob"))
            .push(&fga!(Infra:"de"#reader@User:"alice"))
            .push(&fga!(Infra:"de"#reader@User:*))
            .push(&fga!(Infra:"sw"#reader@User:"patrick"))
            // manager accesses
            .push(&fga!(Infra:"fr"#reader@User:"alice"#manager))
            .push(&fga!(Infra:"es"#writer@User:"alice"#manager))
            .push(&fga!(Infra:"es"#reader@User:"bob"#manager))
            .push(&fga!(Infra:"de"#reader@User:"alice"#manager))
            .push(&fga!(Infra:"sw"#reader@User:"patrick"#manager))
            // group accesses
            .push(&fga!(Group:"company"#member@User:"patrick"))
            .push(&fga!(User:"patrick"#group@Group:"company"))
            .push(&fga!(Group:"company"#manager@User:"alice"))
            .execute()
            .await
            .unwrap();

        let fr_users = client
            .list_users(Infra::can_read().query_users(&fga!(Infra:"fr")))
            .await
            .unwrap();
        assert!(fr_users.public_access.is_none());
        assert_eq!(fr_users.users, vec![fga!(User:"alice")]);

        let mut es_users = client
            .list_users(Infra::can_read().query_users(&fga!(Infra:"es")))
            .await
            .unwrap();
        es_users.users.sort();
        assert!(es_users.public_access.is_none());
        assert_eq!(es_users.users, vec![fga!(User:"alice"), fga!(User:"bob")]);

        let es_users = client
            .list_users(Infra::can_write().query_users(&fga!(Infra:"es")))
            .await
            .unwrap();
        assert!(es_users.public_access.is_none());
        assert_eq!(es_users.users, vec![fga!(User:"alice")]);

        let de_users = client
            .list_users(Infra::can_read().query_users(&fga!(Infra:"de")))
            .await
            .unwrap();
        assert!(de_users.public_access.is_some());
        assert_eq!(de_users.users, vec![fga!(User:"alice")]);

        let mut sw_users = client
            .list_users(Infra::can_read().query_users(&fga!(Infra:"sw")))
            .await
            .unwrap();
        sw_users.users.sort();
        assert!(sw_users.public_access.is_none());
        assert_eq!(
            sw_users.users,
            vec![fga!(User:"alice"), fga!(User:"patrick")]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn list_usersets() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();

        client
            .prepare_writes()
            // direct accesses
            .push(&fga!(Infra:"fr"#reader@User:"alice"))
            // manager accesses
            .push(&fga!(Infra:"fr"#reader@User:"alice"#manager))
            // groups
            .push(&fga!(Group:"company"#member@User:"patrick"))
            .push(&fga!(User:"patrick"#group@Group:"company"))
            .push(&fga!(Group:"company"#manager@User:"alice"))
            .push(&fga!(Group:"competitor"#member@User:"bob"))
            .push(&fga!(User:"bob"#group@Group:"competitor"))
            // groups accesses
            .push(&fga!(Infra:"fr"#reader@Group:"company"#member))
            .push(&fga!(Infra:"fr"#writer@Group:"company"#manager))
            .push(&fga!(Infra:"eu"#reader@Group:"company"#member))
            .push(&fga!(Infra:"eu"#writer@Group:"competitor"#member))
            .execute()
            .await
            .unwrap();

        let groups = Infra::reader()
            .query_usersets(Group::member(), &fga!(Infra:"fr"))
            .fetch(&client)
            .await
            .unwrap();
        assert_eq!(groups, vec![fga!(Group:"company")]);

        let groups = Infra::writer()
            .query_usersets(Group::member(), &fga!(Infra:"fr"))
            .fetch(&client)
            .await
            .unwrap();
        assert!(groups.is_empty());

        let mut groups = Infra::can_read()
            .query_usersets(Group::member(), &fga!(Infra:"eu"))
            .fetch(&client)
            .await
            .unwrap();
        groups.sort();
        assert_eq!(
            groups,
            vec![fga!(Group:"company"), fga!(Group:"competitor")]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn delete_tuples() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();

        client
            .write_tuples(&[
                fga!(Infra:"france"#reader@User:"alice"),
                fga!(Infra:"espagne"#reader@User:"bob"),
            ])
            .await
            .unwrap();

        client
            .delete_tuples(&[fga!(Infra:"france"#reader@User:"alice")])
            .await
            .unwrap();

        client
            .assert_check_not(Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"france")))
            .assert_check(Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"espagne")));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn prepare_deletes() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();

        client
            .write_tuples(&[
                fga!(Infra:"france"#reader@User:"alice"),
                fga!(Infra:"espagne"#reader@User:"bob"),
                fga!(Infra:"germany"#reader@User:"charlie"),
            ])
            .await
            .unwrap();

        client
            .prepare_deletes()
            .push(&fga!(Infra:"france"#reader@User:"alice"))
            .push(&fga!(Infra:"espagne"#reader@User:"bob"))
            .execute()
            .await
            .unwrap();

        client
            .assert_check_not(Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"france")))
            .assert_check_not(Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"espagne")))
            .assert_check(Infra::can_read().check(&fga!(User:"charlie"), &fga!(Infra:"germany")));
    }
}
