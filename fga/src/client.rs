mod authorization_models;
mod queries;
mod stores;
mod tuples;

pub use authorization_models::AuthorizationModel;
pub use authorization_models::StoreAuthorizationModel;
pub use stores::Store;

use tuples::RawTuple;

use std::future::{self, Future};

use futures::{stream, TryStreamExt as _};
use itertools::Itertools as _;

use crate::model::{AsUser, Check, Object, Relation, Tuple, User};

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
}

#[derive(Debug, thiserror::Error)]
pub enum InitializationError {
    #[error("Store not found: {0}")]
    NotFound(String),
    #[error(transparent)]
    Request(#[from] RequestFailure),
}

#[derive(Debug, thiserror::Error)]
#[error("HTTP request to OpenFGA failed: {0}")]
pub struct RequestFailure(#[source] reqwest::Error);

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
    pub async fn try_init(
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

    #[cfg(not(test))]
    pub async fn try_create_store(
        store_name: String,
        settings: ConnectionSettings,
    ) -> Result<Client, InitializationError> {
        Self::try_create_store_inner(store_name, settings, false).await
    }

    #[cfg(test)]
    pub async fn try_create_store(
        store_name: String,
        settings: ConnectionSettings,
        reset: bool,
    ) -> Result<Client, InitializationError> {
        Self::try_create_store_inner(store_name, settings, reset).await
    }

    async fn try_create_store_inner(
        store_name: String,
        settings: ConnectionSettings,
        reset: bool,
    ) -> Result<Client, InitializationError> {
        let mut client = Self {
            store: Store::default(),
            authorization_model_id: None,
            settings,
            inner: reqwest::Client::new(),
        };
        if reset {
            if let Some(store) = client.find_store(&store_name).await? {
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
    /// model ID so that they don't have to infer it. This apparently helps performance. This function should
    /// likely be called when a new authorization model is pushed ([Client::push_authorization_model]) to avoid
    /// inconsistencies. Likewise for authorization model suppression.
    ///
    /// This function is called automatically when a new [Client] is created with [Client::try_init].
    ///
    /// Erases the [Client]'s authorization model ID if no authorization model is defined in the store.
    pub async fn actualize_authorization_model(&mut self) -> Result<(), RequestFailure> {
        self.authorization_model_id = self
            .latest_authorization_model()
            .await?
            .map(|model| model.id);
        Ok(())
    }

    /// Pushes a new authorization model into OpenFGA
    ///
    /// /!\ WARNING /!\ The `authorization_model_id` serialized in the [Client] won't change.
    /// If you wan't this model to be used for following client usage, you need to call
    /// [Client::actualize_authorization_model] afterwards.
    ///
    /// ```ignore
    /// let settings = todo!();
    /// let mut client = Client::try_create_store("store_name".to_owned(), settings).await.unwrap();
    /// assert_eq!(client.authorization_model_id, None);
    /// let model = todo!();
    /// let id = client.push_authorization_model(&model).await.unwrap();
    /// assert_eq!(client.authorization_model_id, None);
    /// client.actualize_authorization_model().await.unwrap();
    /// assert_eq!(client.authorization_model_id, Some(id));
    /// ```
    pub async fn push_authorization_model(
        &self,
        authorization_model: &AuthorizationModel,
    ) -> Result<String, RequestFailure> {
        self.post_stores_authorization_models(&self.store.id, authorization_model)
            .await
    }

    pub async fn write_tuples<'a, R: Relation, U: AsUser<User = R::User>>(
        &self,
        tuples: &[Tuple<'a, R, U>],
    ) -> Result<(), RequestFailure> {
        self.post_stores_write(
            &self.store.id,
            &tuples.into_iter().map_into().collect::<Vec<_>>(),
            &[],
            self.authorization_model_id.clone(),
        )
        .await
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
/// ```ignore
/// Object::relation().check(&user, &object).fetch(&client).await.unwrap();
/// // instead of
/// client.check(Object::relation().check(&user, &object)).await.unwrap();
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
    use crate::compile_model;
    use crate::defs;
    use crate::s;

    use super::*;

    macro_rules! test_client {
        () => {
            Client::try_create_store(
                stdext::function_name!()
                    .split("::")
                    .filter(|x| *x != "{{closure}}")
                    .collect::<Vec<_>>()
                    .join("-"),
                ConnectionSettings {
                    address: "localhost".to_owned(),
                    port: 8080,
                },
                true,
            )
            .await
            .expect("Failed to initialize client")
        };
    }

    #[tokio::test]
    async fn test_try_init() {
        let client = Client::try_init(
            "lol".to_owned(),
            ConnectionSettings {
                address: "localhost".to_owned(),
                port: 8080,
            },
        )
        .await
        .unwrap();
        assert_eq!(client.store.name, "lol");
    }

    #[tokio::test]
    async fn test_try_init_not_found() {
        let result = Client::try_init(
            "nonexistent_store".to_owned(),
            ConnectionSettings {
                address: "localhost".to_owned(),
                port: 8080,
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
        let model = compile_model(MODEL);
        let mut client = test_client!();
        assert_eq!(client.authorization_model_id, None);
        let id = client.push_authorization_model(&model).await.unwrap();
        assert_eq!(client.authorization_model_id, None);
        client.actualize_authorization_model().await.unwrap();
        assert_eq!(client.authorization_model_id, Some(id));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn check() {
        let model = compile_model(MODEL);
        let client = test_client!();
        client.push_authorization_model(&model).await.unwrap();
        let alice = defs::User(s!("alice"));
        let bob = defs::User(s!("bob"));
        let infra = defs::Infra(s!("france"));
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
        let model = compile_model(MODEL);
        let client = test_client!();
        client.push_authorization_model(&model).await.unwrap();
        let alice = defs::User(s!("alice"));
        let bob = defs::User(s!("bob"));
        let france = defs::Infra(s!("france"));
        let spain = defs::Infra(s!("espagne"));
        client
            .write_tuples(&[defs::Infra::reader().tuple(&alice, &france)])
            .await
            .unwrap();
        client
            .write_tuples(&[defs::Infra::reader().tuple(&defs::User::tbpa(), &spain)])
            .await
            .unwrap();

        client
            .assert_check(defs::Infra::can_read().check(&alice, &france))
            .assert_check_not(defs::Infra::can_read().check(&bob, &france))
            .assert_check(defs::Infra::can_read().check(&alice, &spain))
            .assert_check(defs::Infra::can_read().check(&bob, &spain));
    }
}
