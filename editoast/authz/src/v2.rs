use std::collections::HashSet;

use fga::client::QueryError;
use fga::model::Relation as _;
use futures::FutureExt;
use futures::future::BoxFuture;
use itertools::Itertools;

use crate::Group;
use crate::Role;
use crate::User;

pub type OpenFgaError = fga::client::RequestFailure;
type ValueFut<'a, T> = BoxFuture<'a, Result<T, OpenFgaError>>;
type Operation<'a, T> = dyn for<'c> FnOnce(&'c fga::Client) -> ValueFut<'c, T> + 'a;

/// Represents a protected operation yielding a value `T` and the necessary checks required to run it
///
/// Checks are divided into [Guardrail]s and [SanityCheck]s. They are not enforced by the [Protected] itself
/// but rather by an [Authorizer] implementation, which can choose which checks to enforce or not.
/// Running a [Protected] through an [Authorizer] will yield an [Access], which represents either an authorization, a bypass or a denial.
#[derive(derive_more::Debug)]
pub struct Protected<'a, T> {
    #[debug(skip)]
    op: Box<Operation<'a, T>>,
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
}

/// A check to ensure the consistency of the data in OpenFGA and PostgreSQL
///
/// For example, one cannot add a user to a group if the user doesn't exist in PostgreSQL, even if it doesn't cause any issue in OpenFGA.
///
/// Not to be confused with [Guardrail]s, which are checks to ensure the permission workflow of editoast is respected.
#[derive(Debug, Clone, Copy, Hash, PartialEq, Eq)]
pub enum SanityCheck {
    UserExists(User),
    GroupExists(Group),
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
pub trait Authorizer<'a> {
    type Rejection;
    type Error;

    /// Turns a [Protected] operation into an [Access] by enforcing the necessary checks
    async fn authorize<T>(
        &self,
        data: Protected<'a, T>,
    ) -> Result<Access<'a, T, Self::Rejection>, Self::Error>;
}

impl<'a, T> Protected<'a, T> {
    pub fn new(f: impl for<'c> FnOnce(&'c fga::Client) -> ValueFut<'c, T> + 'a) -> Self {
        Self {
            op: Box::new(f),
            guardrails: HashSet::new(),
            sanity_checks: HashSet::new(),
        }
    }

    /// For convenient chaining
    pub async fn authorize<A: Authorizer<'a>>(
        self,
        authorizer: &A,
    ) -> Result<Access<'a, T, A::Rejection>, A::Error> {
        authorizer.authorize(self).await
    }

    /// Consumes the protection and produces an [Access::Authorized] without performing any check
    ///
    /// Only use this in trusted context or in an [Authorizer] implementation after performing the necessary checks.
    pub fn blindly_authorize<R>(self, openfga: &'a fga::Client) -> Access<'a, T, R> {
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

// TODO: move somewhere more appropriate
/// Adds some members to a group
///
/// Idempotent but not atomic due to the lack of transactions in OpenFGA.
pub fn add_members<'a>(group: Group, members: HashSet<User>) -> Protected<'a, ()> {
    let user_exists_checks = members
        .iter()
        .map(|user| SanityCheck::UserExists(*user))
        .collect_vec(); // members is moved in Protected

    Protected::new(move |openfga| {
        async move {
            let existing_members = openfga
                .list_users(Group::member().query_users(&group))
                .await
                .map_err(QueryError::parsing_ok)?;

            debug_assert!(
                existing_members.public_access.is_none(),
                "we don't write public accesses for groups"
            );

            let existing_members = HashSet::from_iter(existing_members.users);
            let new_members = members.difference(&existing_members);
            let mut writes = openfga.prepare_writes();
            for user in new_members {
                writes.push(&Group::member().tuple(user, &group));
                writes.push(&User::group().tuple(&group, user));
            }
            writes.execute().await?;

            Ok(())
        }
        .boxed()
    })
    .with_check(SanityCheck::GroupExists(group))
    .with_check_iter(user_exists_checks)
    .with_guardrail(Guardrail::IssuerHasRole(Role::Admin))
}

pub mod test_authorizers {
    use std::convert::Infallible;

    use crate::v2::Access;
    use crate::v2::Protected;

    use super::Authorizer;

    /// Always authorizes without performing any check
    pub struct Authorize<'a>(pub &'a fga::Client);
    /// Always rejects with the given rejection reason
    pub struct Reject<Rejection>(Rejection);

    impl<'a> Authorizer<'a> for Authorize<'a> {
        type Rejection = ();
        type Error = Infallible;

        async fn authorize<T>(
            &self,
            data: Protected<'a, T>,
        ) -> Result<Access<'a, T, Self::Rejection>, Self::Error> {
            Ok(data.blindly_authorize(self.0))
        }
    }

    impl<'a, Rejection: Clone> Authorizer<'a> for Reject<Rejection> {
        type Rejection = Rejection;
        type Error = Infallible;

        async fn authorize<T>(
            &self,
            _data: Protected<'a, T>,
        ) -> Result<Access<'a, T, Self::Rejection>, Self::Error> {
            Ok(Access::Denied {
                rejection: self.0.clone(),
            })
        }
    }
}
