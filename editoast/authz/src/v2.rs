mod group;
mod infra;
mod roles;
mod rolling_stock;
mod test_client_ext;

use futures::TryStreamExt;
use futures::stream;
pub use group::*;
pub use infra::*;
use itertools::Either;
pub use roles::*;
pub use rolling_stock::*;
pub use test_client_ext::TestClientExt;

use std::collections::HashSet;
use std::convert::Infallible;

use futures::FutureExt;
use futures::future::BoxFuture;

use crate::Group;
use crate::Infra;
use crate::InfraGrant;
use crate::InfraPrivilege;
use crate::Role;
use crate::RollingStock;
use crate::Subject;
use crate::User;
use crate::model::RollingStockPrivilege;

pub type OpenFgaError = fga::client::Error;
type ValueFut<'a, T> = BoxFuture<'a, Result<T, OpenFgaError>>;
/// An alias for the type of a protected operation
///
/// The operation cannot capture any references in the closure context on purpose.
/// This is to allow eventually combining [Protected] objects together. It would
/// "merge" the lifetime of the context and the client together.
type Operation<T> = dyn for<'c> FnOnce(&'c fga::Client) -> ValueFut<'c, T> + Send + 'static;

/// Represents a protected operation yielding a value `T` and the necessary checks required to run it
///
/// Checks are not enforced by the [Protected] itself but rather by an [Authorizer] implementation,
/// which can choose which checks to enforce or not.
/// Running a [Protected] through an [Authorizer] will yield an [Access], which represents either an authorization, a bypass or a denial.
#[derive(derive_more::Debug)]
pub struct Protected<T> {
    #[debug(skip)]
    op: Box<Operation<T>>,
    pub checks: HashSet<Check>,
}

/// The actor to which some [Check]s applies
#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum Actor {
    /// The user from which the protected operation originates
    ///
    /// Such user is provided by the [Authorizer] authorizing the operation.
    Issuer,
    /// A specific user
    User(User),
}

/// A check to ensure data consistency and permission workflow consistency
#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum Check {
    /// The actor needs a role to perform the operation
    HasRole(Actor, Role),
    /// The actor needs an infra privilege to perform the operation
    HasInfraPrivilege(Actor, InfraPrivilege, Infra),
    /// The actor needs a rolling stock privilege to perform the operation
    HasRollingStockPrivilege(Actor, RollingStockPrivilege, RollingStock),
    /// The subject must not have the specified effective infra grant
    SubjectEffectiveInfraGrantIsNot(InfraGrant, Subject, Infra),
    /// The subject must not be the last direct owner of the infra
    IsNotLastInfraOwner(Subject, Infra),

    /// The subject must exist in PostgreSQL
    SubjectExists(Subject),
    /// The infra must exist in PostgreSQL
    InfraExists(Infra),
    /// The rolling stock must exist in PostgreSQL
    RollingStockExists(RollingStock),
}

impl Check {
    pub fn user(user: User) -> Self {
        Check::SubjectExists(Subject::User(user))
    }

    pub fn group(group: Group) -> Self {
        Check::SubjectExists(Subject::Group(group))
    }
}

/// The result of authorizing a [Protected] operation via [Authorizer::authorize]
pub enum Access<'a, T, R> {
    /// The operation is authorized, poll the future to get the result of the operation
    ///
    /// See [Access::access].
    Authorized(ValueFut<'a, T>),
    /// The operation is rejected, the protected operation cannot be run and a rejection reason is provided by the [Authorizer]
    Denied { rejection: R },
}

/// An entity capable of authorizing a [Protected] operation, yielding an [Access]
///
/// The authorization logic is up to the implementation, but it should take into account the checks of the [Protected] operation.
/// Not every check needs to be enforced depending on the purpose of the implementor, but make sure to authorize each protected operation with
/// an appropriate [Authorizer], otherwise that *will result in security issues*.
pub trait Authorizer {
    type Rejection;
    type Error;

    /// Runs the checks of the [Protected], returning failing ones, or the [Access] handle if all checks pass
    ///
    /// INVARIANT: the stream only contains one or more [Either::Left] values or a single [Either::Right] value.
    fn run_checks<'a, T>(
        &'a self,
        data: Protected<T>,
    ) -> impl stream::TryStream<
        Ok = Either<Self::Rejection, Access<'a, T, Infallible>>,
        Error = Self::Error,
    >;

    /// Turns a [Protected] operation into an [Access] by enforcing the necessary checks
    async fn authorize<'a, T>(
        &'a self,
        data: Protected<T>,
    ) -> Result<Access<'a, T, Self::Rejection>, Self::Error> {
        use stream::StreamExt as _;
        use stream::TryStreamExt as _;
        let stream = self.run_checks(data).into_stream();
        tokio::pin!(stream);
        match stream.next().await {
            Some(Ok(Either::Right(Access::Authorized(fut)))) => Ok(Access::Authorized(fut)),
            Some(Ok(Either::Left(rejection))) => Ok(Access::Denied { rejection }),
            Some(Err(error)) => Err(error),
            None => unreachable!(),
        }
    }

    /// Authorizes multiple [Protected] operations concurrently
    ///
    /// Errors are coalesced into a single top-level `Err`. If they are
    /// needed individually, call [Self::authorize] multiple times directly.
    ///
    /// Note that you'll need to `.await` each [Access] as well. Make sure to
    /// do so concurrently as well. You can use [Access::access_all] for this.
    ///
    /// Also note that you'll have to then deal with each potential rejection
    /// individually. If they're all the same to you, consider using
    /// [Protected::from_iter] instead.
    async fn authorize_all<'a, T>(
        &'a self,
        data: impl IntoIterator<Item = Protected<T>>,
    ) -> Result<Vec<Access<'a, T, Self::Rejection>>, Self::Error> {
        futures::future::join_all(data.into_iter().map(|d| self.authorize(d)))
            .await
            .into_iter()
            .collect::<Result<Vec<_>, _>>()
    }
}

impl<T> Protected<T> {
    pub fn new(
        f: impl for<'c> FnOnce(&'c fga::Client) -> ValueFut<'c, T> + Send + 'static,
    ) -> Self {
        Self {
            op: Box::new(f),
            checks: HashSet::new(),
        }
    }

    /// For convenient chaining
    pub async fn authorize<'a, A: Authorizer>(
        self,
        authorizer: &'a A,
    ) -> Result<Access<'a, T, A::Rejection>, A::Error> {
        authorizer.authorize(self).await
    }

    /// Consumes the [Protected] and produces an [Access::Authorized] without performing any check
    ///
    /// Only use this in trusted context or in an [Authorizer] implementation after performing the necessary checks.
    pub fn access_authorized<'a, R>(self, openfga: &'a fga::Client) -> Access<'a, T, R> {
        Access::Authorized((self.op)(openfga))
    }

    /// Unpacks the [Protected] into an [Access::Authorized] and the checks that need to be performed
    ///
    /// Only use this in trusted context or in an [Authorizer] implementation.
    /// Provided as [Protected::access_authorized] consumes the [Protected] and doesn't allow taking ownership
    /// of the checks to perform beforehand.
    ///
    /// Note that the protected operation is not run until the future in [Access::Authorized] is first polled.
    pub fn unpack<'a, R>(self, openfga: &'a fga::Client) -> (HashSet<Check>, Access<'a, T, R>) {
        (self.checks, Access::Authorized((self.op)(openfga)))
    }

    pub fn with_check(self, check: Check) -> Self {
        self.with_check_iter([check])
    }

    pub fn with_check_iter(mut self, checks: impl IntoIterator<Item = Check>) -> Self {
        self.checks.extend(checks);
        self
    }
}

impl<T: Send + 'static> Protected<T> {
    /// A [Protected] value that always succeeds with the provided value
    pub fn value(t: T) -> Self {
        Self::new(move |_| async move { Ok(t) }.boxed())
    }

    pub fn map<U: Send + 'static>(
        self,
        f: impl for<'c> FnOnce(&'c fga::Client, T) -> BoxFuture<'c, Result<U, OpenFgaError>>
        + Send
        + 'static,
    ) -> Protected<U> {
        let Self { op, checks } = self;
        Protected {
            op: Box::new(move |openfga| {
                async move {
                    let t = op(openfga).await?;
                    f(openfga, t).await
                }
                .boxed()
            }),
            checks,
        }
    }

    pub fn zip<U: Send + 'static>(
        self,
        Protected {
            op: other_op,
            checks: other_checks,
        }: Protected<U>,
    ) -> Protected<(T, U)> {
        let Self { op, mut checks } = self;
        checks.extend(other_checks);
        Protected {
            op: Box::new(move |openfga| {
                async move { tokio::try_join!(op(openfga), other_op(openfga)) }.boxed()
            }),
            checks,
        }
    }
}

impl<T: Send + 'static> Protected<Option<T>> {
    pub fn map_some_into<E>(self) -> Protected<Option<E>>
    where
        E: Send + 'static,
        T: Into<E>,
    {
        self.map(move |_, val| async move { Ok(val.map(T::into)) }.boxed())
    }
}

impl<T> Protected<T>
where
    T: IntoIterator + Send + 'static,
    <T as IntoIterator>::Item: Send + 'static,
{
    pub fn collect_into<C>(self) -> Protected<C>
    where
        C: Send + 'static,
        C: IntoIterator,
        C: FromIterator<<C as IntoIterator>::Item>,
        <T as IntoIterator>::Item: Into<<C as IntoIterator>::Item>,
    {
        self.map(move |_, val| {
            async move {
                Ok(val
                    .into_iter()
                    .map(<T as IntoIterator>::Item::into)
                    .collect::<C>())
            }
            .boxed()
        })
    }
}

impl<T: Default> Default for Protected<T> {
    fn default() -> Self {
        Self::new(|_| async { Ok(T::default()) }.boxed())
    }
}

impl<T: Send + 'static> FromIterator<Protected<T>> for Protected<Vec<T>> {
    /// Concatenates a bunch of protected operations into one
    ///
    /// If you need to handle individual rejections, consider using
    /// [Authorizer::authorize_all] instead.
    fn from_iter<I: IntoIterator<Item = Protected<T>>>(iter: I) -> Self {
        let mut checks = HashSet::new();
        let mut ops = Vec::new();
        for Protected { op, checks: c } in iter {
            checks.extend(c);
            ops.push(op);
        }
        Self {
            op: Box::new(move |openfga| {
                async move {
                    let futures = ops.into_iter().map(|op| op(openfga));
                    futures::future::try_join_all(futures).await
                }
                .boxed()
            }),
            checks,
        }
    }
}

impl<'a, T, R> Access<'a, T, R> {
    /// Awaits the authorized operation future if authorized or yields the rejection if not
    ///
    /// Returns the value if bypassed, logging a warning.
    ///
    /// Never match on the double Result, match on the Access itself if needed.
    pub async fn access(self) -> Result<Result<T, R>, OpenFgaError> {
        match self {
            Access::Authorized(fut) => fut.await.map(Ok),
            Access::Denied { rejection } => Ok(Err(rejection)),
        }
    }

    /// Concurrently awaits all accesses and factorizes OpenFGA errors
    ///
    /// If you don't need to handle individual rejections, consider using
    /// [Protected::from_iter] beforehand.
    pub async fn access_all(
        accesses: impl IntoIterator<Item = Access<'_, T, R>>,
    ) -> Result<Vec<Result<T, R>>, OpenFgaError> {
        futures::future::try_join_all(accesses.into_iter().map(|access| access.access())).await
    }
}

impl<'a, T, R: std::fmt::Debug> Access<'a, T, R> {
    pub async fn unwrap_authorized(self) -> T {
        match self.access().await {
            Ok(Ok(value)) => value,
            Ok(Err(rejection)) => panic!("authorization failed: {:?}", rejection),
            Err(error) => panic!("authorization error: {:?}", error),
        }
    }
}

/// Represents the list authorized resources returned by a [`Protected`] operation.
///
/// This enum can either represent the list of objects returned by openfga after looking up user
/// permissions on a given resource type, or the [`AuthorizedResources::All`] bypass variant if
/// the authorization was not checked against openfga as the user is an admin and would have had
/// access to all objects of that resource type anyway.
///
/// Bypassing the authorization check prevents sending unnecessary queries with possibly massive
/// response payloads, as for example the full list of existing infras when checking which infras
/// an admin has access to. To retrieve all objects of one kind from the authorization store, we need to retrieve all tuples
/// related to objects of that type and there is no way to do that only for tuples containing a
/// specific type so we end up retrieving all tuples from the store and then filtering them per
/// object type.
#[cfg_attr(test, derive(PartialOrd, Ord, PartialEq, Eq))]
pub enum ResourcesList<T: fga::model::Type> {
    /// All objects of the given type are authorized, openfga was not called.
    All,
    /// The list of authorized objects returned by Openfga.
    Privileged(Vec<T>),
}

impl<T: fga::model::Type> ResourcesList<T> {
    pub fn unwrap_privileged(self) -> Vec<T> {
        match self {
            ResourcesList::All => panic!("enum is not a List::Privileged variant"),
            ResourcesList::Privileged(objects) => objects,
        }
    }
}

pub mod special_authorizers {
    use std::convert::Infallible;

    use futures::stream;
    use itertools::Either;

    use crate::v2::Access;
    use crate::v2::OpenFgaError;
    use crate::v2::Protected;

    use super::Authorizer;

    /// Always authorizes without performing any check
    pub struct Authorize<'a>(pub &'a fga::Client);
    /// Always rejects with the given check
    pub struct Reject(pub super::Check);

    impl Authorizer for Authorize<'_> {
        type Rejection = Infallible;
        type Error = Infallible;

        fn run_checks<'a, T>(
            &'a self,
            data: Protected<T>,
        ) -> impl stream::TryStream<
            Ok = Either<Self::Rejection, Access<'a, T, Infallible>>,
            Error = Self::Error,
        > {
            futures::stream::once(futures::future::ok(Either::Right(
                data.access_authorized(self.0),
            )))
        }
    }

    impl Authorizer for Reject {
        type Rejection = super::Check;
        type Error = Infallible;

        fn run_checks<'a, T>(
            &'a self,
            _data: Protected<T>,
        ) -> impl stream::TryStream<
            Ok = Either<Self::Rejection, Access<'a, T, Infallible>>,
            Error = Self::Error,
        > {
            futures::stream::once(futures::future::ok(Either::Left(self.0)))
        }
    }

    impl Authorize<'_> {
        pub async fn access_value<T>(&self, p: Protected<T>) -> Result<T, OpenFgaError> {
            let Ok::<_, Infallible>(access) = self.authorize(p).await;
            let Ok::<_, Infallible>(value) = access.access().await?;
            Ok(value)
        }
    }
}

impl<L, R, Rejection, Error> Authorizer for Either<L, R>
where
    L: Authorizer<Rejection = Rejection, Error = Error>,
    R: Authorizer<Rejection = Rejection, Error = Error>,
{
    type Rejection = Rejection;
    type Error = Error;

    fn run_checks<'a, T>(
        &'a self,
        data: Protected<T>,
    ) -> impl stream::TryStream<
        Ok = Either<Self::Rejection, Access<'a, T, Infallible>>,
        Error = Self::Error,
    > {
        use futures::stream::StreamExt as _;
        match self {
            Either::Left(l) => {
                let stream = l.run_checks(data);
                stream.into_stream().left_stream()
            }
            Either::Right(r) => {
                let stream = r.run_checks(data);
                stream.into_stream().right_stream()
            }
        }
    }
}
