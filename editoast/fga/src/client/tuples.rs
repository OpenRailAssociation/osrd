use futures::stream;
use itertools::Either;
use itertools::Itertools as _;
use tracing::Instrument;

use crate::model::AsUser;
use crate::model::Relation;
use crate::model::Tuple;

use super::Client;
use super::Continuation;
use super::Request;
use super::RequestFailure;
use super::TooManyTuples;

pub(in crate::client) use super::api::tuples::RawTuple;
pub use super::api::tuples::UntypedTuple;
pub use super::api::tuples::UntypedUserSet;
pub use super::api::tuples::UserOrUserSet;

impl Client {
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

    pub fn list_tuples(
        &self,
    ) -> impl stream::TryStream<Ok = UntypedTuple, Error = RequestFailure> + '_ {
        Continuation::stream(move |continuation| {
            async move {
                let (tuples, continuation_str) = self
                    .get_stores_read(
                        &self.store.id,
                        None,
                        Some(100),
                        self.authorization_model_id.as_deref(),
                        None,
                        continuation.as_option().map(|s| s.to_string()),
                    )
                    .await?;
                let typed_tuples = tuples.into_iter().map(UntypedTuple::from).collect();
                Ok((typed_tuples, Continuation::from(continuation_str)))
            }
            .in_current_span()
        })
    }

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
    /// (default value: [super::DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE]).
    ///
    /// The [PreparedWrites] type returned by this function accepts any number
    /// of tuples through [PreparedWrites::push] and will chunk them into
    /// requests of `n` tuples each, with `n` the maximum number of tuple reads
    /// configured in the [super::ConnectionSettings::limits]'s [super::Limits::max_checks_per_batch_check].
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
    /// (default value: [super::DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE]).
    /// The [PreparedDeletes] type returned by this function accepts any number
    /// of tuples through [PreparedDeletes::push] and will chunk them into
    /// requests of `n` tuples each, with `n` the tuples limit configured in
    /// [super::ConnectionSettings::limits]'s [super::Limits::max_tuples_per_write].
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
}

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
    /// with `n` the maximum number of tuple reads configured in the [super::ConnectionSettings::limits]'s
    /// [super::Limits::max_tuples_per_write].
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

    pub fn push_untyped(&mut self, tuple: UntypedTuple) {
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
    /// with `n` the maximum number of tuple writes configured in the [super::ConnectionSettings::limits]'s
    /// [super::Limits::max_tuples_per_write].
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

impl<R: Relation, U: AsUser<User = R::User>> Request for Tuple<'_, R, U> {
    type Response = bool;

    type Error = RequestFailure;

    async fn fetch(self, client: &Client) -> Result<Self::Response, Self::Error> {
        client.tuple_exists(self).await
    }
}

#[cfg(test)]
mod tests {
    use reqwest::StatusCode;

    use crate::client::DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE;
    use crate::client::setup_tracing;
    use crate::compile_model;
    use crate::defs::*;
    use crate::fga;
    use crate::model::Relation as _;
    use crate::test_client;

    const MODEL: &str = include_str!("../../tests/model.fga");

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

        assert!(
            !client
                .check(Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"france")))
                .await
                .unwrap()
        );
        assert!(
            client
                .check(Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"espagne")))
                .await
                .unwrap()
        );
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

        assert!(
            !client
                .check(Infra::can_read().check(&fga!(User:"alice"), &fga!(Infra:"france")))
                .await
                .unwrap()
        );
        assert!(
            !client
                .check(Infra::can_read().check(&fga!(User:"bob"), &fga!(Infra:"espagne")))
                .await
                .unwrap()
        );
        assert!(
            client
                .check(Infra::can_read().check(&fga!(User:"charlie"), &fga!(Infra:"germany")))
                .await
                .unwrap()
        );
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
