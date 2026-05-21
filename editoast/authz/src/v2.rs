mod group;
mod infra;
mod roles;
mod rolling_stock;
mod test_client_ext;

pub use group::*;
pub use infra::*;
pub use roles::*;
pub use rolling_stock::*;
pub use test_client_ext::TestClientExt;

use std::collections::HashSet;

use futures::FutureExt;
use futures::future::BoxFuture;

use crate::Group;
use crate::Infra;
use crate::InfraPrivilege;
use crate::Role;
use crate::RollingStock;
use crate::Subject;
use crate::User;
use crate::model::RollingStockPrivilege;

pub type OpenFgaError = fga::client::RequestFailure;
type ValueFut<'a, T> = BoxFuture<'a, Result<T, OpenFgaError>>;
/// An alias for the type of a protected operation
///
/// The operation cannot capture any references in the closure context on purpose.
/// This is to allow eventually combining [Protected] objects together. It would
/// "merge" the lifetime of the context and the client together.
type Operation<T> = dyn for<'c> FnOnce(&'c fga::Client) -> ValueFut<'c, T> + Send + 'static;

/// Represents a protected operation yielding a value `T` and the necessary checks required to run it
///
/// Checks are divided into [Guardrail]s and [SanityCheck]s. They are not enforced by the [Protected] itself
/// but rather by an [Authorizer] implementation, which can choose which checks to enforce or not.
/// Running a [Protected] through an [Authorizer] will yield an [Access], which represents either an authorization, a bypass or a denial.
#[derive(derive_more::Debug)]
pub struct Protected<T> {
    #[debug(skip)]
    op: Box<Operation<T>>,
    pub guardrails: HashSet<Guardrail>,
    pub sanity_checks: HashSet<SanityCheck>,
}

/// A check to ensure the permission workflow of editoast is respected
///
/// For example, one cannot share a resource to a level higher that their own.
///
/// Not to be confused with [SanityCheck]s, which are checks that ensure the consistency of the data in OpenFGA and PostgreSQL.
#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum Guardrail {
    IssuerHasRole(Role),
    IssuerHasInfraPrivilege(InfraPrivilege, Infra),
    IssuerHasRollingStockPrivilege(RollingStockPrivilege, RollingStock),
}

/// A check to ensure the consistency of the data in OpenFGA and PostgreSQL
///
/// For example, one cannot add a user to a group if the user doesn't exist in PostgreSQL, even if it doesn't cause any issue in OpenFGA.
///
/// Not to be confused with [Guardrail]s, which are checks to ensure the permission workflow of editoast is respected.
#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum SanityCheck {
    SubjectExists(Subject),
    InfraExists(Infra),
    RollingStockExists(RollingStock),
}

impl SanityCheck {
    pub fn user(user: User) -> Self {
        SanityCheck::SubjectExists(Subject::User(user))
    }

    pub fn group(group: Group) -> Self {
        SanityCheck::SubjectExists(Subject::Group(group))
    }
}

/// The result of authorizing a [Protected] operation via [Authorizer::authorize]
pub enum Access<'a, T, R> {
    /// The operation is authorized, poll the future to get the result of the operation
    ///
    /// See [Access::access].
    Authorized(ValueFut<'a, T>),
    /// The operation is bypassed, the operation is not run and a substitute value is provided instead
    Bypassed { value: T, reason: &'static str },
    /// The operation is rejected, the protected operation cannot be run and a rejection reason is provided by the [Authorizer]
    Denied { rejection: R },
}

/// An entity capable of authorizing a [Protected] operation, yielding an [Access]
///
/// The authorization logic is up to the implementation, but it should take into account the guardrails and sanity checks of the [Protected] operation.
/// Not every check needs to be enforced depending on the purpose of the implementor, but make sure to authorize each protected operation with
/// an appropriate [Authorizer], otherwise that *will result in security issues*.
pub trait Authorizer {
    type Rejection;
    type Error;

    /// Turns a [Protected] operation into an [Access] by enforcing the necessary checks
    async fn authorize<'a, T>(
        &'a self,
        data: Protected<T>,
    ) -> Result<Access<'a, T, Self::Rejection>, Self::Error>;

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
            guardrails: HashSet::new(),
            sanity_checks: HashSet::new(),
        }
    }

    /// For convenient chaining
    pub async fn authorize<'a, A: Authorizer>(
        self,
        authorizer: &'a A,
    ) -> Result<Access<'a, T, A::Rejection>, A::Error> {
        authorizer.authorize(self).await
    }

    /// Consumes the protection and produces an [Access::Authorized] without performing any check
    ///
    /// Only use this in trusted context or in an [Authorizer] implementation after performing the necessary checks.
    pub fn access_authorized<'a, R>(self, openfga: &'a fga::Client) -> Access<'a, T, R> {
        Access::Authorized((self.op)(openfga))
    }

    fn with_guardrail(self, guardrail: Guardrail) -> Self {
        self.with_guardrail_iter([guardrail])
    }

    fn with_guardrail_iter(mut self, guardrails: impl IntoIterator<Item = Guardrail>) -> Self {
        self.guardrails.extend(guardrails);
        self
    }

    fn with_check(self, sanity_check: SanityCheck) -> Self {
        self.with_check_iter([sanity_check])
    }

    fn with_check_iter(mut self, sanity_checks: impl IntoIterator<Item = SanityCheck>) -> Self {
        self.sanity_checks.extend(sanity_checks);
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
        let Self {
            op,
            guardrails,
            sanity_checks,
        } = self;
        Protected {
            op: Box::new(move |openfga| {
                async move {
                    let t = op(openfga).await?;
                    f(openfga, t).await
                }
                .boxed()
            }),
            guardrails,
            sanity_checks,
        }
    }

    pub fn zip<U: Send + 'static>(
        self,
        Protected {
            op: other_op,
            guardrails: other_guardrails,
            sanity_checks: other_sanity_checks,
        }: Protected<U>,
    ) -> Protected<(T, U)> {
        let Self {
            op,
            mut guardrails,
            mut sanity_checks,
        } = self;
        guardrails.extend(other_guardrails);
        sanity_checks.extend(other_sanity_checks);
        Protected {
            op: Box::new(move |openfga| {
                async move { tokio::try_join!(op(openfga), other_op(openfga)) }.boxed()
            }),
            guardrails,
            sanity_checks,
        }
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
        let mut guardrails = HashSet::new();
        let mut sanity_checks = HashSet::new();
        let mut ops = Vec::new();
        for Protected {
            op,
            guardrails: gd,
            sanity_checks: sc,
        } in iter
        {
            guardrails.extend(gd);
            sanity_checks.extend(sc);
            ops.push(op);
        }
        Self {
            op: Box::new(move |openfga| {
                async move {
                    let futs = ops.into_iter().map(|op| op(openfga));
                    futures::future::try_join_all(futs).await
                }
                .boxed()
            }),
            guardrails,
            sanity_checks,
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
            Access::Bypassed { value, reason } => {
                tracing::warn!(reason, "using admin bypass");
                Ok(Ok(value))
            }
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

pub mod special_authorizers {
    use std::convert::Infallible;

    use crate::v2::Access;
    use crate::v2::OpenFgaError;
    use crate::v2::Protected;

    use super::Authorizer;

    /// Always authorizes without performing any check
    pub struct Authorize<'a>(pub &'a fga::Client);
    /// Always rejects with the given rejection reason
    pub struct Reject<Rejection>(Rejection);

    impl Authorizer for Authorize<'_> {
        type Rejection = Infallible;
        type Error = Infallible;

        async fn authorize<'a, T>(
            &'a self,
            data: Protected<T>,
        ) -> Result<Access<'a, T, Self::Rejection>, Self::Error> {
            Ok(data.access_authorized(self.0))
        }
    }

    impl<Rejection: Clone> Authorizer for Reject<Rejection> {
        type Rejection = Rejection;
        type Error = Infallible;

        async fn authorize<'a, T>(
            &'a self,
            _data: Protected<T>,
        ) -> Result<Access<'a, T, Self::Rejection>, Self::Error> {
            Ok(Access::Denied {
                rejection: self.0.clone(),
            })
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
