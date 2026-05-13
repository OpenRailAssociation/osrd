use std::collections::HashMap;
use std::str::FromStr;

use tracing::Instrument;
use uuid::Uuid;

use crate::model::AsUser;
use crate::model::Check;
use crate::model::Object;
use crate::model::QueryObjects;
use crate::model::QueryUsers;
use crate::model::QueryUsersets;
use crate::model::Relation;
use crate::model::Type;
use crate::model::User;
use crate::model::Wildcard;

use super::Client;
use super::Error;
use super::Request;
use super::api::queries::BatchCheckItem;
use super::api::queries::BatchCheckSingleResult;
use super::api::queries::RawUser;
use super::api::queries::UserFilter;
use super::tuples::RawTuple;

impl Client {
    pub async fn check<R, U>(&self, Check { user, object }: Check<'_, R, U>) -> Result<bool, Error>
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
    /// this functions remembers the structure used to inject the checks. This is
    /// useful when you *statically* know the number of checks and want the individual
    /// result afterwards instead of combining the `bool`s.
    ///
    /// You can provide this function a tuple from 2 to 8 checks, and it will return
    /// a tuple from 2 to 8 `bool`s respectively. Other structuring types can be supported
    /// by implementing the [StructuredChecks] trait.
    ///
    /// # Which `check` function to use?
    ///
    /// As a rule of thumb:
    ///
    /// 1. If you only have one check to perform, use [Client::check].
    /// 2. If you know which checks you want to perform at compile time and want the result
    ///    of each check in its own binding, use [Client::checks].
    /// 3. Otherwise (you don't know how many checks you will perform at compile time, or you
    ///    don't care about each result individually), use [Client::prepare_checks].
    ///
    /// # Example
    ///
    /// ```
    /// # include!("../doctest_setup.rs");
    /// # use fga::fga;
    /// # #[tokio::main]
    /// # async fn main() {
    /// # let mut client = fga::Client::try_new_store("doctest_checks", settings()).await.unwrap();
    /// # client.update_authorization_model(&fga::compile_model(include_str!("../../tests/doctest.fga"))).await.unwrap();
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
    pub async fn checks<S: StructuredChecks>(&self, checks: S) -> Result<S::Output, Error> {
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
    ) -> Result<Vec<R::Object>, Error> {
        let objects = self
            .post_stores_list_objects(
                &self.store.id,
                R::Object::NAMESPACE,
                R::NAME,
                &user.fga_user(),
                None,
                None,
            )
            .await?
            .into_iter()
            .map(|ident| {
                let prefix = format!("{}:", R::Object::NAMESPACE);
                let Some(id) = ident.strip_prefix(&prefix) else {
                    unreachable!("OpenFGA always return a valid type value in the form `type:id` (got '{ident}')");
                };
                R::Object::from_str(id).map_err(|_| {
                    tracing::error!(ident, type = R::Object::NAMESPACE, "failed to parse OpenFGA object");
                    Error::MalformedValue {
                        ident,
                        expected_type: R::Object::NAMESPACE.to_owned(),
                    }
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
    ) -> Result<UserList<R::User>, Error> {
        let raw_users = self
            .post_stores_list_users(
                &self.store.id,
                (R::Object::NAMESPACE, &object.id().to_string()),
                R::NAME,
                UserFilter::User {
                    r#type: R::User::NAMESPACE,
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
                            Error::MalformedValue {
                                ident: id,
                                expected_type: R::User::NAMESPACE.to_owned(),
                            }
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
    /// # include!("../doctest_setup.rs");
    /// # use fga::fga;
    /// # #[tokio::main]
    /// # async fn main() {
    /// # let mut client = fga::Client::try_new_store("doctest_list_usersets", settings()).await.unwrap();
    /// # client.update_authorization_model(&fga::compile_model(include_str!("../../tests/doctest.fga"))).await.unwrap();
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
    ) -> Result<Vec<S::Object>, Error> {
        let users = self
            .post_stores_list_users(
                &self.store.id,
                (R::Object::NAMESPACE, &object.id().to_string()),
                R::NAME,
                UserFilter::UserSet {
                    r#type: S::Object::NAMESPACE,
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
                RawUser::UserSet {
                    r#type,
                    id,
                    relation,
                } => {
                    debug_assert_eq!(r#type.as_str(), S::Object::NAMESPACE);
                    debug_assert_eq!(relation.as_str(), S::NAME);
                    S::Object::from_str(&id).map_err(|_| {
                        tracing::error!(id, type = S::Object::NAMESPACE, "failed to parse OpenFGA userset");
                        Error::MalformedValue {
                            ident: id,
                            expected_type: S::Object::NAMESPACE.to_owned(),
                        }
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
    /// [super::ConnectionSettings::limits]'s [super::Limits::max_checks_per_batch_check].
    pub async fn execute(self) -> Result<Vec<bool>, Error> {
        let count = self.checks.len();

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

        let check_results = futures::future::try_join_all(futs)
            .await?
            .into_iter()
            .flatten();

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
        impl<$($relations: Relation, $users: AsUser<User = $relations::User>),+> StructuredChecks
            for ($(Check<'_, $relations, $users>),+)
        {
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

impl<R: Relation, U: AsUser<User = R::User>> Request for Check<'_, R, U> {
    type Response = bool;

    type Error = Error;

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

    type Error = Error;

    async fn fetch(self, client: &Client) -> Result<Self::Response, Self::Error> {
        client.list_objects(self).await
    }
}

impl<R: Relation> Request for QueryUsers<'_, R> {
    type Response = UserList<R::User>;

    type Error = Error;

    async fn fetch(self, client: &Client) -> Result<Self::Response, Self::Error> {
        client.list_users(self).await
    }
}

impl<R: Relation, S: Relation> Request for QueryUsersets<'_, R, S> {
    type Response = Vec<S::Object>;

    type Error = Error;

    async fn fetch(self, client: &Client) -> Result<Self::Response, Self::Error> {
        client.list_usersets(self).await
    }
}

#[cfg(test)]
mod tests {
    use crate::client::Client;
    use crate::client::DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK;
    use crate::client::Error;
    use crate::client::ErrorCode;
    use crate::client::Request as _;
    use crate::compile_model;
    use crate::defs::*;
    use crate::fga;
    use crate::model::AsUser;
    use crate::model::Check;
    use crate::model::Relation;
    use crate::test_client;

    fn setup_tracing() {
        tracing_subscriber::fmt()
            .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
            .without_time()
            .pretty()
            .try_init()
            .ok();
    }

    impl Client {
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

    const MODEL: &str = include_str!("../../tests/model.fga");

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

        let (friends_write_france, company_read_spain) = client
            .checks((
                Infra::can_write().check(fga!(Group:"friends"#member), &fga!(Infra:"france")),
                Infra::can_read().check(fga!(Group:"company"#member), &fga!(Infra:"espagne")),
            ))
            .await
            .unwrap();
        assert!(friends_write_france);
        assert!(company_read_spain);

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
        assert!(results.is_err_and(|err| matches!(
            err,
            Error::Validation {
                code: ErrorCode::ValidationError,
                message,
            } if message == "batchCheck received 51 checks, the maximum allowed is 50"
        )));
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
            .write(&fga!(Infra:"fr"#reader@User:"alice"))
            .write(&fga!(Infra:"es"#writer@User:"alice"))
            .write(&fga!(Infra:"es"#reader@User:"bob"))
            .write(&fga!(Infra:"de"#reader@User:"alice"))
            .write(&fga!(Infra:"de"#reader@User:*))
            .write(&fga!(Infra:"sw"#reader@User:"patrick"))
            .write(&fga!(Infra:"fr"#reader@User:"alice"#manager))
            .write(&fga!(Infra:"es"#writer@User:"alice"#manager))
            .write(&fga!(Infra:"es"#reader@User:"bob"#manager))
            .write(&fga!(Infra:"de"#reader@User:"alice"#manager))
            .write(&fga!(Infra:"sw"#reader@User:"patrick"#manager))
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
            .write(&fga!(Infra:"fr"#reader@User:"alice"))
            .write(&fga!(Infra:"fr"#reader@User:"alice"#manager))
            .write(&fga!(Group:"company"#member@User:"patrick"))
            .write(&fga!(User:"patrick"#group@Group:"company"))
            .write(&fga!(Group:"company"#manager@User:"alice"))
            .write(&fga!(Group:"competitor"#member@User:"bob"))
            .write(&fga!(User:"bob"#group@Group:"competitor"))
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
}
