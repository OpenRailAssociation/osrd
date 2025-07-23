mod authorization_models;
mod healthz;
mod queries;
mod stores;
mod tuples;

pub use authorization_models::AuthorizationModel;
pub use authorization_models::StoreAuthorizationModel;
use itertools::Either;
use queries::BatchCheckItem;
use queries::BatchCheckSingleResult;
use queries::RawUser;
use queries::UserFilter;
pub use stores::Store;

use tracing::Instrument;
use tuples::RawTuple;
use url::Url;
use uuid::Uuid;

use std::collections::HashMap;
use std::future::Future;
use std::future::{self};
use std::str::FromStr;

use futures::TryStreamExt as _;
use futures::stream;
use itertools::Itertools as _;

use crate::model::AsUser;
use crate::model::Check;
use crate::model::Object;
use crate::model::QueryObjects;
use crate::model::QueryUsers;
use crate::model::QueryUsersets;
use crate::model::Relation;
use crate::model::Tuple;
use crate::model::Type;
use crate::model::User;
use crate::model::Wildcard;

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

// Public API of the client
// -------------------------

impl Client {
    #[tracing::instrument(err)]
    pub async fn try_with_store(
        store_name: &str,
        settings: ConnectionSettings,
    ) -> Result<Self, InitializationError> {
        let mut client = Self {
            store: Store::default(),
            authorization_model_id: None,
            settings,
            inner: reqwest::Client::new(),
        };

        client.store = client
            .find_store(store_name)
            .await?
            .ok_or_else(|| InitializationError::NotFound(store_name.to_string()))?;
        client.actualize_authorization_model().await?;

        Ok(client)
    }

    #[tracing::instrument(err)]
    pub async fn try_new_store(
        store_name: &str,
        settings: ConnectionSettings,
    ) -> Result<Client, InitializationError> {
        let mut client = Self {
            store: Store::default(),
            authorization_model_id: None,
            settings,
            inner: reqwest::Client::new(),
        };
        if client.settings.reset_store
            && let Some(store) = client.find_store(store_name).await?
        {
            tracing::debug!(old = ?store, "removing old store for reset");
            client.delete_stores(&store.id).await?;
        }
        client.store = client.post_stores(store_name).await?;
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

    pub fn store(&self) -> &Store {
        &self.store
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

    /// Returns whether a tuple exists in OpenFGA
    ///
    /// Not to be mistaken with [Client::check]. This function internally calls
    /// `/stores/{store_id}/read`. Check out OpenFGA documentation for more information
    /// about the distinction between tuples and checks.
    pub async fn tuple_exists<R: Relation, U: AsUser<User = R::User>>(
        &self,
        tuple: Tuple<'_, R, U>,
    ) -> Result<bool, RequestFailure> {
        let (tuples, _continuation) = self
            .get_stores_read(
                &self.store.id,
                Some(RawTuple::from(&tuple)),
                Some(1),
                self.authorization_model_id.as_deref(),
                None,
                None,
            )
            .await?;
        Ok(!tuples.is_empty())
    }

    /// Writes up to `n` tuples in OpenFGA, with `n` the maximum number of tuple writes
    /// configured in the [ConnectionSettings::limits]'s [Limits::max_tuples_per_write].
    ///
    /// If the tuple slice is more than `n` elements, an error will be returned.
    /// If you want them to be chunked into several requests, or if your tuples cannot
    /// be monomorphized into a single type, use [Client::prepare_writes] instead.
    ///
    /// Warning: just like OpenFGA's Write API, this function is **not** idempotent.
    /// If a tuple is written twice, the second write will fail.
    pub async fn write_tuples<R: Relation, U: AsUser<User = R::User>>(
        &self,
        tuples: &[Tuple<'_, R, U>],
    ) -> Result<(), Either<RequestFailure, TooManyTuples>> {
        if tuples.len() > self.settings.limits.max_tuples_per_write as usize {
            return Err(Either::Right(TooManyTuples {
                max: self.settings.limits.max_tuples_per_write as usize,
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
    /// OpenFGA Writes API has a maximum number of tuples it accepts per request
    /// (default value: [DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE]).
    ///
    /// The [PreparedWrites] type returned by this function accepts any number
    /// of tuples through [PreparedWrites::push] and will chunk them into
    /// requests of `n` tuples each, with `n` the maximum number of tuple reads
    /// configured in the [ConnectionSettings::limits]'s [Limits::max_checks_per_batch_check].
    /// The requests are sent concurrently when [PreparedWrites::execute] is called.
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

    /// Deletes up to `n` tuples in OpenFGA, with `n` the maximum number of tuple writes
    /// configured in the [ConnectionSettings::limits]'s [Limits::max_tuples_per_write].
    ///
    /// If the tuple slice is more than `n` elements, an error will be returned.
    /// If you want them to be chunked into several requests, or if your tuples cannot
    /// be monomorphized into a single type, use [Client::prepare_deletes] instead.
    ///
    /// Warning: just like OpenFGA's Write API, this function is **not** idempotent.
    /// If a tuple is deleted twice, the second delete will fail.
    pub async fn delete_tuples<R: Relation, U: AsUser<User = R::User>>(
        &self,
        tuples: &[Tuple<'_, R, U>],
    ) -> Result<(), Either<RequestFailure, TooManyTuples>> {
        if tuples.is_empty() {
            return Ok(());
        }
        if tuples.len() > self.settings.limits.max_tuples_per_write as usize {
            return Err(Either::Right(TooManyTuples {
                max: self.settings.limits.max_tuples_per_write as usize,
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
    /// OpenFGA Writes API has a maximum number of tuples it accepts per request
    /// (default value: [DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE]).
    /// The [PreparedDeletes] type returned by this function accepts any number
    /// of tuples through [PreparedDeletes::push] and will chunk them into
    /// requests of `n` tuples each, with `n` the tuples limit configured in
    /// [ConnectionSettings::limits]'s [Limits::max_tuples_per_write].
    /// The requests are sent concurrently when [PreparedDeletes::execute] is called.
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

    pub async fn check<R, U>(
        &self,
        Check { user, object }: Check<'_, R, U>,
    ) -> Result<bool, RequestFailure>
    where
        R: Relation,
        U: AsUser<User = R::User>,
    {
        self.post_stores_check(
            &self.store.id,
            RawTuple {
                user: user.fga_user(),
                relation: R::NAME.to_string(),
                object: object.fga_object(),
            },
            None,
            self.authorization_model_id.clone(),
        )
        .await
    }

    /// Performs multiple checks at once using OpenFGA `/batch-check` API
    ///
    /// Unlike [Client::prepare_checks] which ultimately returns a `Vec<bool>`,
    /// this functions remembers the structure used to inject the checks.  This is
    /// useful when you *statically* know the number of checks and want the individual
    /// result afterwards instead of combining the `bool`s.
    ///
    /// You can provide this function a tuple from 2 to 8 checks, and it will return
    /// a tuple from 2 to 8 `bool`s respectively.  Other structuring types can be supported
    /// by implementing the [StructuredChecks] trait.
    ///
    /// # Which `check` function to use?
    ///
    /// As a rule of thumb:
    ///
    /// 1. If you only have one check to perform, use [Client::check].
    /// 2. If you know which checks you want to perform at compile time and want the result
    ///    of each check in its own binding, use [Client::checks].
    /// 3. Otherwise (you dont know how many checks you will perform at compile time, or you
    ///    don't care about each result individually), use [Client::prepare_checks].
    ///
    /// # Example
    ///
    /// ```
    /// # include!("doctest_setup.rs");
    /// # use fga::fga;
    /// # #[tokio::main]
    /// # async fn main() {
    /// # let mut client = fga::Client::try_new_store("doctest_checks", settings()).await.unwrap();
    /// # client.update_authorization_model(&fga::compile_model(include_str!("../tests/doctest.fga"))).await.unwrap();
    /// client
    ///     .write_tuples(&[fga!(Document:"budget"#writer@Person:"alice")])
    ///     .await
    ///     .unwrap();
    ///
    /// let (alice_can_read, alice_can_write, bob_can_read) = client
    ///     .checks((
    ///         Document::can_read().check(&fga!(Person:"alice"), &fga!(Document:"budget")),
    ///         Document::can_write().check(&fga!(Person:"alice"), &fga!(Document:"budget")),
    ///         Document::can_read().check(&fga!(Person:"bob"), &fga!(Document:"budget")),
    ///     ))
    ///     .await
    ///     .unwrap();
    ///
    /// assert!(alice_can_read && alice_can_write && !bob_can_read);
    /// # }
    /// ```
    pub async fn checks<S: StructuredChecks>(
        &self,
        checks: S,
    ) -> Result<S::Output, RequestFailure> {
        let results = checks.prepare(self).execute().await?;
        Ok(S::from_check_results(results))
    }

    /// Prepares multiple check requests to OpenFGA
    ///
    /// OpenFGA Check API do not accept more than a configurable maximum number of
    /// checks per request. The [PreparedChecks] type returned by this function accepts any number
    /// of checks through [PreparedChecks::push] and will chunk them into
    /// requests of `max_tuple_reads` checks each. The requests are sent concurrently when
    /// [PreparedChecks::execute] is called.
    ///
    /// Beware that the checks injected into [PreparedChecks] cannot be accessed
    /// after a [PreparedChecks::push]. So any form of post-processing is impossible.
    /// Likewise, once a [Check] is injected into [PreparedChecks], all its typing information
    /// is lost.
    pub fn prepare_checks(&self) -> PreparedChecks<'_> {
        PreparedChecks {
            checks: Vec::new(),
            client: self,
        }
    }

    pub async fn list_objects<R: Relation, U: AsUser<User = R::User>>(
        &self,
        QueryObjects(user, _): QueryObjects<R, U>,
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
            .map(|ident| {
                let prefix: String = format!("{}:", R::Object::NAMESPACE);
                let Some(id) = ident.strip_prefix(&prefix) else {
                    unreachable!("OpenFGA always return a valid type value in the form `type:id` (got '{ident}')");
                };
                <R::Object as FromStr>::from_str(id).map_err(|_| {
                    tracing::error!(ident, type = R::Object::NAMESPACE, "failed to parse OpenFGA object");
                    QueryError::Parsing { ident, expected_type: R::Object::NAMESPACE }
                })
            })
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
    ) -> Result<UserList<R::User>, QueryError> {
        let raw_users = self
            .post_stores_list_users(
                &self.store.id,
                (
                    <R::Object as crate::model::Type>::NAMESPACE,
                    &object.id().to_string(),
                ),
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
                        let user = R::User::from_str(&id).map_err(|_| {
                            tracing::error!(id, type = R::User::NAMESPACE, "failed to parse OpenFGA user");
                            QueryError::Parsing { ident: id, expected_type: R::User::NAMESPACE }
                        })?;
                        users.push(user);
                    }
                    RawUser::Wildcard { r#type } => {
                        debug_assert_eq!(r#type.as_str(), R::User::NAMESPACE);
                        public_access = Some(Wildcard(std::marker::PhantomData));
                    }
                    RawUser::UserSet { .. } => {
                        unreachable!(
                            "OpenFGA cannot return usersets when `user_filter` is configured like above"
                        )
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
    /// # let mut client = fga::Client::try_new_store("doctest_list_usersets", settings()).await.unwrap();
    /// # client.update_authorization_model(&fga::compile_model(include_str!("../tests/doctest.fga"))).await.unwrap();
    /// // define can_read: reader or writer
    /// client.prepare_writes()
    ///     .write(&fga!(Document:"budget"#reader@Group:"friends"#member))
    ///     .write(&fga!(Document:"budget"#writer@Group:"bosses"#member))
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
    ) -> Result<Vec<S::Object>, QueryError> {
        let users = self
            .post_stores_list_users(
                &self.store.id,
                (
                    <R::Object as crate::model::Type>::NAMESPACE,
                    &object.id().to_string(),
                ),
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
        users
            .into_iter()
            .map(|user| match user {
                RawUser::UserSet { r#type, id, relation } => {
                    debug_assert_eq!(r#type.as_str(), S::Object::NAMESPACE);
                    debug_assert_eq!(relation.as_str(), S::NAME);
                    S::Object::from_str(&id).map_err(|_| {
                        tracing::error!(id, type = S::Object::NAMESPACE, "failed to parse OpenFGA userset");
                        QueryError::Parsing { ident: id, expected_type: S::Object::NAMESPACE }
                    })
                }
                _ => {
                    unreachable!("OpenFGA cannot return anything other than usersets when the `user_filter` is configured like above");
                }
            })
            .collect()
    }
}

/// Result of a [Client::list_users] query
pub struct UserList<U: User> {
    /// The list of users related to an object
    pub users: Vec<U>,
    /// Whether the object has a user type `U` type-bound public access
    pub public_access: Option<Wildcard<U>>,
}

pub struct PreparedChecks<'a> {
    checks: Vec<RawTuple>,
    client: &'a Client,
}

impl PreparedChecks<'_> {
    pub fn push<R, U>(&mut self, Check { user, object }: &Check<'_, R, U>)
    where
        R: Relation,
        U: AsUser<User = R::User>,
    {
        self.checks.push(RawTuple {
            user: user.fga_user(),
            relation: R::NAME.to_string(),
            object: object.fga_object(),
        });
    }

    pub fn check<R, U>(mut self, check: &Check<'_, R, U>) -> Self
    where
        R: Relation,
        U: AsUser<User = R::User>,
    {
        self.push(check);
        self
    }

    /// Concurrently send batch-checks requests to OpenFGA in chunks of `n` elements,
    /// with `n` the maximum number of tuple reads configured in the
    /// [ConnectionSettings::limits]'s [Limits::max_checks_per_batch_check].
    pub async fn execute(self) -> Result<Vec<bool>, RequestFailure> {
        let count = self.checks.len();

        // Prepare the request items
        let (check_items, correlation_ids): (Vec<_>, HashMap<_, _>) = self
            .checks
            .into_iter()
            .enumerate()
            .map(|(check_index, tuple_key)| {
                let correlation_id = Uuid::new_v4();
                let item = BatchCheckItem {
                    correlation_id: correlation_id.to_string(),
                    tuple_key,
                    contextual_tuples: None,
                };
                (item, (correlation_id, check_index))
            })
            .unzip();

        // Prepare the requests
        let futs = check_items
            .chunks(self.client.settings.limits.max_checks_per_batch_check as usize)
            .map(|checks| {
                self.client
                    .post_stores_batch_check(
                        &self.client.store.id,
                        checks,
                        self.client.authorization_model_id.as_deref(),
                        None,
                    )
                    .in_current_span()
            });

        // Send the requests concurrently and combine all check results
        let check_results = futures::future::try_join_all(futs)
            .await?
            .into_iter()
            .flatten();

        // Use the correlation IDs to find the index of the original checks in order to send the check results back
        // in the same order as the checks
        let mut result = vec![false; count];
        for (correlation_id, BatchCheckSingleResult { allowed, error }) in check_results {
            let Some(index) = Uuid::from_str(correlation_id.as_str())
                .ok()
                .and_then(|correlation_id| correlation_ids.get(&correlation_id))
            else {
                unreachable!("OpenFGA always returns correlation IDs we send it");
            };
            if let Some(error) = error {
                tracing::error!(correlation_id, index, error = ?error.message, "batch check item failed");
                // TODO: raise a proper error once OpenFGA errors are properly defined
            }
            result[*index] = allowed;
        }
        Ok(result)
    }
}

pub trait StructuredChecks {
    type Output;

    fn prepare(self, client: &Client) -> PreparedChecks<'_>;
    fn from_check_results(results: Vec<bool>) -> Self::Output;
}

macro_rules! impl_structured_checks {
    ($output:ty, $($relations:ident)+, $($users:ident)+, $($idents:ident)+) => {
        impl<$($relations: Relation, $users: AsUser<User = $relations::User>),+> StructuredChecks for ($(Check<'_, $relations, $users>),+) {
            type Output = $output;

            fn prepare(self, client: &Client) -> PreparedChecks<'_> {
                let ($($idents,)+) = self;
                PreparedChecks {
                    checks: Vec::new(),
                    client,
                }
                .$(check(&$idents)).+
            }

            fn from_check_results(results: Vec<bool>) -> Self::Output {
                match &results[..] {
                    [$($idents),+] => ($(*$idents),+),
                    _ => unreachable!("OpenFGA always returns the same number of results as checks"),
                }
            }
        }
    };
}

impl_structured_checks!((bool, bool), R1 R2, U1 U2, a b);
impl_structured_checks!((bool, bool, bool), R1 R2 R3, U1 U2 U3, a b c);
impl_structured_checks!((bool, bool, bool, bool), R1 R2 R3 R4, U1 U2 U3 U4, a b c d);
impl_structured_checks!((bool, bool, bool, bool, bool), R1 R2 R3 R4 R5, U1 U2 U3 U4 U5, a b c d e);
impl_structured_checks!((bool, bool, bool, bool, bool, bool), R1 R2 R3 R4 R5 R6, U1 U2 U3 U4 U5 U6, a b c d e f);
impl_structured_checks!((bool, bool, bool, bool, bool, bool, bool), R1 R2 R3 R4 R5 R6 R7, U1 U2 U3 U4 U5 U6 U7, a b c d e f g);
impl_structured_checks!((bool, bool, bool, bool, bool, bool, bool, bool), R1 R2 R3 R4 R5 R6 R7 R8, U1 U2 U3 U4 U5 U6 U7 U8, a b c d e f g h);

pub struct PreparedWrites<'a> {
    writes: Vec<RawTuple>,
    client: &'a Client,
}

impl PreparedWrites<'_> {
    pub fn push<R: Relation, U: AsUser<User = R::User>>(&mut self, tuple: &Tuple<'_, R, U>) {
        self.writes.push(RawTuple::from(tuple));
    }

    pub fn write<R: Relation, U: AsUser<User = R::User>>(
        mut self,
        tuple: &Tuple<'_, R, U>,
    ) -> Self {
        self.push(tuple);
        self
    }

    /// Concurrently sends write requests to OpenFGA in chunks of `n` elements,
    /// with `n` the maximum number of tuple reads configured in the [ConnectionSettings::limits]'s
    /// [Limits::max_tuples_per_write].
    ///
    /// /!\ WARNING /!\ No transactional state is set up, so should any request fail,
    /// the tuples written by other successful requests will remain in OpenFGA.
    /// This function also returns at the first failing request, so OpenFGA may still
    /// write some tuples **after** this function exits.
    pub async fn execute(self) -> Result<(), RequestFailure> {
        let futs = self
            .writes
            .chunks(self.client.settings.limits.max_tuples_per_write as usize)
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
    pub fn push<R: Relation, U: AsUser<User = R::User>>(&mut self, tuple: &Tuple<'_, R, U>) {
        self.deletes.push(RawTuple::from(tuple));
    }

    pub fn delete<R: Relation, U: AsUser<User = R::User>>(
        mut self,
        tuple: &Tuple<'_, R, U>,
    ) -> Self {
        self.push(tuple);
        self
    }

    /// Concurrently sends delete requests to OpenFGA in chunks of `n` elements,
    /// with `n` the maximum number of tuple writes configured in the [ConnectionSettings::limits]'s
    /// [Limits::max_tuples_per_write].
    ///
    /// /!\ WARNING /!\ No transactional state is set up, so should any request fail,
    /// the tuples deleted by other successful requests will remain deleted in OpenFGA.
    /// This function also returns at the first failing request, so OpenFGA may still
    /// delete some tuples **after** this function exits.
    pub async fn execute(self) -> Result<(), RequestFailure> {
        let futs = self
            .deletes
            .chunks(self.client.settings.limits.max_tuples_per_write as usize)
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

impl<R: Relation, U: AsUser<User = R::User>> Request for Tuple<'_, R, U> {
    type Response = bool;

    type Error = RequestFailure;

    async fn fetch(self, client: &Client) -> Result<Self::Response, Self::Error> {
        client.tuple_exists(self).await
    }
}

impl<R: Relation, U: AsUser<User = R::User>> Request for Check<'_, R, U> {
    type Response = bool;

    type Error = RequestFailure;

    async fn fetch(self, client: &Client) -> Result<Self::Response, Self::Error> {
        client.check(self).await
    }
}

impl<R, U> Request for QueryObjects<R, U>
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

    type Error = QueryError;

    async fn fetch(self, client: &Client) -> Result<Self::Response, Self::Error> {
        client.list_users(self).await
    }
}

impl<R: Relation, S: Relation> Request for QueryUsersets<'_, R, S> {
    type Response = Vec<S::Object>;

    type Error = QueryError;

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
    use reqwest::StatusCode;

    use crate::client::Client;
    use crate::client::DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK;
    use crate::client::DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE;
    use crate::client::InitializationError;
    use crate::client::Request as _;
    use crate::compile_model;
    use crate::defs::*;
    use crate::fga;
    use crate::model::AsUser;
    use crate::model::Check;
    use crate::model::Relation;
    use crate::test_client;
    use crate::test_utilities::connection_settings;

    fn setup_tracing() {
        tracing_subscriber::fmt()
            .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
            .without_time()
            .pretty()
            .try_init()
            .ok();
    }

    #[tokio::test]
    async fn test_try_init_not_found() {
        setup_tracing();
        let result = Client::try_with_store("nonexistent_store", connection_settings()).await;

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
        fn assert_check<R, U>(&self, check: Check<'_, R, U>) -> &Self
        where
            R: Relation,
            U: AsUser<User = R::User> + std::fmt::Debug,
        {
            let error = format!("{check:?} doesn't hold, WWWHHHHYYYYY???");
            let ok = futures::executor::block_on(check.fetch(self)).unwrap();
            assert!(ok, "{error}");
            self
        }

        #[track_caller]
        fn assert_check_not<R, U>(&self, check: Check<'_, R, U>) -> &Self
        where
            R: Relation,
            U: AsUser<User = R::User> + std::fmt::Debug,
        {
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
    async fn batch_check() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        client
            .write_tuples(&[fga!(Infra:"france"#reader@User:"bob")])
            .await
            .unwrap();

        // we try the operation a few times to make sure that each bool matches with the correct check
        for _ in 0..10 {
            let results = client
                .prepare_checks()
                .check(&Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"france")))
                .check(&Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"france")))
                .execute()
                .await
                .unwrap();
            assert_eq!(results, vec![true, false]);

            let (bob, alice) = client
                .checks((
                    Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"france")),
                    Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"france")),
                ))
                .await
                .unwrap();
            assert!(bob);
            assert!(!alice);
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn check_userset() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        client
            .prepare_writes()
            .write(&fga!(Infra:"france"#writer@Group:"friends"#member))
            .write(&fga!(Infra:"espagne"#reader@Group:"company"#member))
            .write(&fga!(Group:"friends"#member@User:"bob"))
            .write(&fga!(Group:"company"#member@User:"bob"))
            .write(&fga!(Group:"company"#member@User:"alice"))
            .execute()
            .await
            .unwrap();

        // Test batch_check with usersets
        let (friends_write_france, company_read_spain) = client
            .checks((
                Infra::can_write().check(fga!(Group:"friends"#member), &fga!(Infra:"france")),
                Infra::can_read().check(fga!(Group:"company"#member), &fga!(Infra:"espagne")),
            ))
            .await
            .unwrap();
        assert!(friends_write_france);
        assert!(company_read_spain);

        // Test check
        client
            .assert_check_not(
                Infra::can_write().check(fga!(Group:"company"#member), &fga!(Infra:"espagne")),
            )
            .assert_check(
                Infra::can_read().check(fga!(Group:"friends"#member), &fga!(Infra:"france")),
            )
            .assert_check(
                Infra::can_write().check(fga!(Group:"friends"#member), &fga!(Infra:"france")),
            )
            .assert_check(Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"espagne")))
            .assert_check_not(Infra::can_write().check(&fga!(User:"alice"), &fga!(Infra:"espagne")))
            .assert_check_not(Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"france")))
            .assert_check(Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"france")))
            .assert_check(Infra::can_write().check(&fga!(User:"bob"), &fga!(Infra:"france")));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn batch_check_tuple_read_limit_success() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        let number_of_checks = DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK * 2;
        let mut checks = client.prepare_checks();
        for _ in 1..=number_of_checks {
            checks.push(&Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"france")));
        }
        let results = checks.execute().await.unwrap();
        assert_eq!(results, vec![false; number_of_checks as usize]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn batch_check_tuple_read_limit_fail() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        client.settings.limits.max_checks_per_batch_check =
            DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK + 1;
        let number_of_checks = DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK * 2;
        let mut checks = client.prepare_checks();
        for _ in 1..=number_of_checks {
            checks.push(&Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"france")));
        }
        let results = checks.execute().await;
        assert!(results.is_err_and(|err| err.0.status().unwrap() == StatusCode::BAD_REQUEST));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn batch_check_tuple_write_limit_success() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();
        let mut writes = client.prepare_writes();
        let mut infras: Vec<Infra> = vec![];
        let mut users: Vec<User> = vec![];
        for i in 1..=2 * DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE {
            infras.push(Infra(format!("{i}")));
            users.push(User(format!("{i}")));
        }
        let tuples = infras
            .iter()
            .zip(users.iter())
            .map(|(infra, user)| Infra::reader().tuple(user, infra))
            .collect::<Vec<_>>();
        for tuple in tuples {
            writes.push(&tuple);
        }
        writes.execute().await.unwrap();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn batch_check_tuple_write_limit_fail() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.settings.limits.max_tuples_per_write = DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE + 1;
        client.update_authorization_model(&model).await.unwrap();
        let mut writes = client.prepare_writes();
        let mut infras: Vec<Infra> = vec![];
        let mut users: Vec<User> = vec![];
        for i in 1..=2 * DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE {
            infras.push(Infra(format!("{i}")));
            users.push(User(format!("{i}")));
        }
        let tuples = infras
            .iter()
            .zip(users.iter())
            .map(|(infra, user)| Infra::reader().tuple(user, infra))
            .collect::<Vec<_>>();
        for tuple in tuples {
            writes.push(&tuple);
        }
        let response = writes.execute().await;
        assert!(response.is_err_and(|err| err.0.status().unwrap() == StatusCode::BAD_REQUEST));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn higher_order_users() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();

        client
            .prepare_writes()
            .write(&fga!(Infra:"france"#reader@User:"alice"))
            .write(&fga!(Infra:"espagne"#reader@User:*))
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
            .write(&fga!(Infra:"france"#reader@User:"alice"))
            .write(&fga!(Infra:"espagne"#reader@User:*))
            .write(&fga!(Group:"les_petits_pedestres"#member@User:"alice"))
            .write(&fga!(Infra:"allemagne"#reader@Group:"les_petits_pedestres"#member))
            .execute()
            .await
            .unwrap();

        let objects = client
            .list_objects(Infra::can_read().query_objects(fga!(User:*)))
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
            .write(&fga!(Infra:"fr"#reader@User:"alice"))
            .write(&fga!(Infra:"es"#writer@User:"alice"))
            .write(&fga!(Infra:"es"#reader@User:"bob"))
            .write(&fga!(Infra:"de"#reader@User:"alice"))
            .write(&fga!(Infra:"de"#reader@User:*))
            .write(&fga!(Infra:"sw"#reader@User:"patrick"))
            // manager accesses
            .write(&fga!(Infra:"fr"#reader@User:"alice"#manager))
            .write(&fga!(Infra:"es"#writer@User:"alice"#manager))
            .write(&fga!(Infra:"es"#reader@User:"bob"#manager))
            .write(&fga!(Infra:"de"#reader@User:"alice"#manager))
            .write(&fga!(Infra:"sw"#reader@User:"patrick"#manager))
            // group accesses
            .write(&fga!(Group:"company"#member@User:"patrick"))
            .write(&fga!(User:"patrick"#group@Group:"company"))
            .write(&fga!(Group:"company"#manager@User:"alice"))
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
            .write(&fga!(Infra:"fr"#reader@User:"alice"))
            // manager accesses
            .write(&fga!(Infra:"fr"#reader@User:"alice"#manager))
            // groups
            .write(&fga!(Group:"company"#member@User:"patrick"))
            .write(&fga!(User:"patrick"#group@Group:"company"))
            .write(&fga!(Group:"company"#manager@User:"alice"))
            .write(&fga!(Group:"competitor"#member@User:"bob"))
            .write(&fga!(User:"bob"#group@Group:"competitor"))
            // groups accesses
            .write(&fga!(Infra:"fr"#reader@Group:"company"#member))
            .write(&fga!(Infra:"fr"#writer@Group:"company"#manager))
            .write(&fga!(Infra:"eu"#reader@Group:"company"#member))
            .write(&fga!(Infra:"eu"#writer@Group:"competitor"#member))
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
            .delete(&fga!(Infra:"france"#reader@User:"alice"))
            .delete(&fga!(Infra:"espagne"#reader@User:"bob"))
            .execute()
            .await
            .unwrap();

        client
            .assert_check_not(Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"france")))
            .assert_check_not(Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"espagne")))
            .assert_check(Infra::can_read().check(&fga!(User:"charlie"), &fga!(Infra:"germany")));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn tuple_exists() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        client.update_authorization_model(&model).await.unwrap();

        client
            .write_tuples(&[fga!(Infra:"france"#reader@User:"alice")])
            .await
            .unwrap();

        assert!(
            client
                .tuple_exists(fga!(Infra:"france"#reader@User:"alice"))
                .await
                .unwrap()
        );
        assert!(
            !client
                .tuple_exists(fga!(Infra:"espagne"#reader@User:"bob"))
                .await
                .unwrap()
        );

        client
            .delete_tuples(&[fga!(Infra:"france"#reader@User:"alice")])
            .await
            .unwrap();

        assert!(
            !client
                .tuple_exists(fga!(Infra:"france"#reader@User:"alice"))
                .await
                .unwrap()
        );
    }
}
