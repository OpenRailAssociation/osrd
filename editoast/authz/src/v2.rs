use std::collections::HashSet;

use fga::client::QueryError;
use fga::client::UserList;
use fga::model::Relation as _;
use futures::FutureExt;
use futures::future::BoxFuture;
use itertools::Itertools;

use crate::Group;
use crate::Infra;
use crate::InfraGrant;
use crate::InfraPrivilege;
use crate::Role;
use crate::Subject;
use crate::User;

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
    /// individually. If they're all the same, the upcoming transformation from
    /// `Vec<Protected<T>>` to `Protected<Vec<T>>` will serve this purpose. Stay tuned!
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
    pub fn blindly_authorize<'a, R>(self, openfga: &'a fga::Client) -> Access<'a, T, R> {
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
    /// If you don't need to handle individual rejections, stay tuned for the
    /// upcoming `Protected<Vec<T>>` transformation.
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

pub fn group_members(group: Group) -> Protected<Vec<User>> {
    Protected::new(move |openfga| {
        async move {
            let UserList {
                users,
                public_access,
            } = openfga
                .list_users(Group::member().query_users(&group))
                .await
                .map_err(QueryError::parsing_ok)?;
            debug_assert!(
                public_access.is_none(),
                "we don't write public accesses for groups"
            );
            Ok(users)
        }
        .boxed()
    })
    .with_check(SanityCheck::group(group))
}

// TODO: move somewhere more appropriate
/// Adds some members to a group
///
/// Idempotent but not atomic due to the lack of transactions in OpenFGA.
pub fn add_members(group: Group, members: HashSet<User>) -> Protected<()> {
    let user_exists_checks = members
        .iter()
        .map(|user| SanityCheck::user(*user))
        .collect_vec(); // members is moved in Protected

    group_members(group)
        .map(move |openfga, existing_members| {
            async move {
                let existing_members = HashSet::from_iter(existing_members);
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
        .with_check_iter(user_exists_checks)
        .with_guardrail(Guardrail::IssuerHasRole(Role::Admin))
}

pub fn subject_roles(subject: Subject) -> Protected<Vec<Role>> {
    Protected::new(move |openfga| {
        async move {
            match &subject {
                Subject::User(user) => Role::list_roles(openfga, User::role(), user).await,
                Subject::Group(group) => Role::list_roles(openfga, Group::role(), group).await,
            }
        }
        .boxed()
    })
    .with_check(SanityCheck::SubjectExists(subject))
}

// TODO: move somewhere more appropriate
/// Gives the subject the specified roles
///
/// Idempotent but not atomic due to the lack of transactions in OpenFGA.
pub fn add_roles(subject: Subject, roles: HashSet<Role>) -> Protected<()> {
    subject_roles(subject)
        .map(move |openfga, existing_roles| {
            async move {
                let existing_roles = HashSet::from_iter(existing_roles);
                let new_roles = roles.difference(&existing_roles);
                let mut writes = openfga.prepare_writes();
                match subject {
                    Subject::User(user) => {
                        for role in new_roles {
                            writes.push(&User::role().tuple(role, &user));
                        }
                    }
                    Subject::Group(group) => {
                        for role in new_roles {
                            writes.push(&Group::role().tuple(role, &group));
                        }
                    }
                }
                writes.execute().await?;
                Ok(())
            }
            .boxed()
        })
        .with_guardrail(Guardrail::IssuerHasRole(Role::Admin))
}

/// Removes some members from a group
///
/// Idempotent but not atomic due to the lack of transactions in OpenFGA.
pub fn remove_members(group: Group, members: HashSet<User>) -> Protected<()> {
    let user_exists_checks = members
        .iter()
        .map(|user| SanityCheck::user(*user))
        .collect_vec(); // members is moved in Protected

    group_members(group)
        .map(move |openfga, existing_members| {
            async move {
                let existing_members = HashSet::from_iter(existing_members);
                let expelled = members.intersection(&existing_members);
                let mut writes = openfga.prepare_deletes();
                for user in expelled {
                    writes.push(&Group::member().tuple(user, &group));
                    writes.push(&User::group().tuple(&group, user));
                }
                writes.execute().await?;
                Ok(())
            }
            .boxed()
        })
        .with_check_iter(user_exists_checks)
        .with_guardrail(Guardrail::IssuerHasRole(Role::Admin))
}

// TODO: move somewhere more appropriate
/// Removes the specified roles from the subject
///
/// Idempotent but not atomic due to the lack of transactions in OpenFGA.
pub fn remove_roles(subject: Subject, roles: HashSet<Role>) -> Protected<()> {
    subject_roles(subject)
        .map(move |openfga, existing_roles| {
            async move {
                let existing_roles = HashSet::from_iter(existing_roles);
                let removed_roles = roles.intersection(&existing_roles);
                let mut writes = openfga.prepare_deletes();
                match subject {
                    Subject::User(user) => {
                        for role in removed_roles {
                            writes.push(&User::role().tuple(role, &user));
                        }
                    }
                    Subject::Group(group) => {
                        for role in removed_roles {
                            writes.push(&Group::role().tuple(role, &group));
                        }
                    }
                }
                writes.execute().await?;
                Ok(())
            }
            .boxed()
        })
        .with_guardrail(Guardrail::IssuerHasRole(Role::Admin))
}

/// Returns the *direct grant* a subject has on an [Infra], if any
///
/// A user can have *indirect grants* on a resource through group membership.
/// For those, use [`infra_effective_grant`].
///
/// A subject can have at most one direct grant on any resource. Should this
/// invariant be violated, the protected operation will panic.
pub fn infra_direct_grant(subject: Subject, infra: Infra) -> Protected<Option<InfraGrant>> {
    Protected::new(move |openfga| {
        async move {
            let (is_reader, is_writer, is_owner) = match &subject {
                Subject::User(user) => tokio::try_join!(
                    openfga
                        .tuple_exists(Infra::reader().tuple(user, &infra)),
                    openfga
                        .tuple_exists(Infra::writer().tuple(user, &infra)),
                    openfga.tuple_exists(Infra::owner().tuple(user, &infra)),
                )?,
                Subject::Group(group) => tokio::try_join!(
                    openfga
                        .tuple_exists(Infra::reader().tuple(Group::member().userset(group), &infra)),
                    openfga
                        .tuple_exists(Infra::writer().tuple(Group::member().userset(group), &infra)),
                    openfga
                        .tuple_exists(Infra::owner().tuple(Group::member().userset(group), &infra)),
                )?,
            };

            match (is_reader, is_writer, is_owner) {
                (true, false, false) => Ok(Some(InfraGrant::Reader)),
                (false, true, false) => Ok(Some(InfraGrant::Writer)),
                (false, false, true) => Ok(Some(InfraGrant::Owner)),
                (false, false, false) => Ok(None),
                _ => {
                    tracing::error!(
                        is_reader,
                        is_writer,
                        is_owner,
                        ?subject,
                        resource = ?infra,
                        "Subject has multiple direct grants on the same resource"
                    );
                    panic!(
                        "Subject '{subject:?}' has multiple direct grants on the same resource '{infra:?}', which is not supposed to happen by design. \n\
                        Detected direct grants: reader: {is_reader}, writer: {is_writer}, owner: {is_owner}"
                    )
                }
            }
        }
        .boxed()
    })
    .with_check(SanityCheck::SubjectExists(subject))
    .with_check(SanityCheck::InfraExists(infra))
}

/// Returns the effective (maximum) grant a subject has on an [Infra], if any
///
/// A given user may have multiple grants on the same resource. This can happen
/// if a user inherits a grant from one of its groups and also has a direct grant.
/// Inherited grants are not the same thing as privileges: they do not have the same semantic,
/// are not represented by the same enum, do no work on the same scale nor in the same way.
///
/// For direct grants, see [`infra_direct_grant`].
///
/// Groups only have direct grants. If multiple direct grants are found, this protected operation will panic.
pub fn infra_effective_grant(subject: Subject, infra: Infra) -> Protected<Option<InfraGrant>> {
    Protected::new(move |openfga| {
        async move {
            let (is_reader, is_writer, is_owner) = match &subject {
                Subject::User(user) => {
                    openfga
                        .checks((
                            Infra::reader().check(user, &infra),
                            Infra::writer().check(user, &infra),
                            Infra::owner().check(user, &infra),
                        ))
                        .await?
                }
                Subject::Group(group) => {
                    let (is_reader, is_writer, is_owner) = openfga
                        .checks((
                            Infra::reader().check(Group::member().userset(group), &infra),
                            Infra::writer().check(Group::member().userset(group), &infra),
                            Infra::owner().check(Group::member().userset(group), &infra),
                        ))
                        .await?;
                    if matches!(
                        (is_reader, is_writer, is_owner),
                        (true, true, _) | (true, _, true) | (_, true, true)
                    ) {
                        tracing::error!(
                            is_reader,
                            is_writer,
                            is_owner,
                            ?subject,
                            resource = ?infra,
                            "Group has multiple direct grants on the same resource"
                        );
                        panic!(
                            "Group {subject:?} has multiple direct grants on the same resource {infra:?}, which is not supposed to happen by design. \n\
                            While a user may have inherited grants from one of their groups, groups do not have inherited grants. \n\
                            Detected direct grants: reader: {is_reader}, writer: {is_writer}, owner: {is_owner}"
                        );
                    }
                    (is_reader, is_writer, is_owner)
                }
            };

            Ok(is_owner
                .then_some(InfraGrant::Owner)
                .or_else(|| is_writer.then_some(InfraGrant::Writer))
                .or_else(|| is_reader.then_some(InfraGrant::Reader)))
        }
        .boxed()
    })
    .with_check(SanityCheck::SubjectExists(subject))
    .with_check(SanityCheck::InfraExists(infra))
    .with_guardrail(Guardrail::IssuerHasInfraPrivilege(InfraPrivilege::CanRead, infra))
}

pub fn infra_privileges(user: User, infra: Infra) -> Protected<HashSet<InfraPrivilege>> {
    Protected::new(move |openfga| {
        async move {
            let (
                admin,
                can_read,
                can_share_read,
                can_write,
                can_share_write,
                can_delete,
                can_share_ownership,
            ) = openfga
                .checks((
                    User::role().check(&Role::Admin, &user),
                    Infra::can_read().check(&user, &infra),
                    Infra::can_share_read().check(&user, &infra),
                    Infra::can_write().check(&user, &infra),
                    Infra::can_share_write().check(&user, &infra),
                    Infra::can_delete().check(&user, &infra),
                    Infra::can_share_ownership().check(&user, &infra),
                ))
                .await?;
            let mut privileges = HashSet::new();
            privileges.extend((admin || can_read).then_some(InfraPrivilege::CanRead));
            privileges.extend((admin || can_share_read).then_some(InfraPrivilege::CanShareRead));
            privileges.extend((admin || can_write).then_some(InfraPrivilege::CanWrite));
            privileges.extend((admin || can_share_write).then_some(InfraPrivilege::CanShareWrite));
            privileges.extend((admin || can_delete).then_some(InfraPrivilege::CanDelete));
            privileges.extend(
                (admin || can_share_ownership).then_some(InfraPrivilege::CanShareOwnership),
            );
            Ok(privileges)
        }
        .boxed()
    })
    .with_check(SanityCheck::InfraExists(infra))
    .with_check(SanityCheck::SubjectExists(Subject::user(user)))
    .with_guardrail(Guardrail::IssuerHasInfraPrivilege(
        InfraPrivilege::CanRead,
        infra,
    ))
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
            Ok(data.blindly_authorize(self.0))
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

pub trait TestClientExt {
    async fn subject_roles(&self, subject: &Subject) -> HashSet<Role>;
    async fn group_members(&self, group: &Group) -> HashSet<User>;
    async fn infra_effective_grant(&self, subject: Subject, infra: Infra) -> Option<InfraGrant>;
    async fn infra_direct_grant(
        &self,
        subject: impl Into<Subject>,
        infra: Infra,
    ) -> Option<InfraGrant>;
    async fn infra_privileges(&self, user: User, infra: Infra) -> HashSet<InfraPrivilege>;
}

impl TestClientExt for fga::Client {
    async fn subject_roles(&self, subject: &Subject) -> HashSet<Role> {
        match subject {
            Subject::User(user) => Role::list_roles(self, User::role(), user).await,
            Subject::Group(group) => Role::list_roles(self, Group::role(), group).await,
        }
        .unwrap()
        .into_iter()
        .collect()
    }

    async fn group_members(&self, group: &Group) -> HashSet<User> {
        self.list_users(Group::member().query_users(group))
            .await
            .unwrap()
            .users
            .into_iter()
            .collect()
    }

    async fn infra_effective_grant(&self, subject: Subject, infra: Infra) -> Option<InfraGrant> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(infra_effective_grant(subject, infra))
            .await
            .unwrap()
    }

    async fn infra_direct_grant(
        &self,
        subject: impl Into<Subject>,
        infra: Infra,
    ) -> Option<InfraGrant> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(infra_direct_grant(subject.into(), infra))
            .await
            .unwrap()
    }

    async fn infra_privileges(&self, user: User, infra: Infra) -> HashSet<InfraPrivilege> {
        let authorize = special_authorizers::Authorize(self);
        authorize
            .access_value(infra_privileges(user, infra))
            .await
            .unwrap()
    }
}

#[cfg(test)]
mod tests {
    use crate::v2::special_authorizers::Authorize;

    use super::*;

    #[tokio::test]
    async fn add_members_idempotent() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2)])
        );

        add_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2)])
        );
    }

    #[tokio::test]
    async fn add_members_intersecting_calls() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2)])
        );

        add_members(Group(1), HashSet::from_iter([User(1), User(3)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2), User(3)])
        );
    }

    #[tokio::test]
    async fn remove_members_idempotent() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2)])
        );

        remove_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([])
        );

        remove_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([])
        );
    }

    #[tokio::test]
    async fn remove_members_intersecting_calls() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_members(Group(1), HashSet::from_iter([User(1), User(2), User(3)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2), User(3)])
        );

        remove_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(3)])
        );

        remove_members(Group(1), HashSet::from_iter([User(1), User(3)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([])
        );
    }

    #[tokio::test]
    async fn add_roles_idempotent() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );
    }

    #[tokio::test]
    async fn add_roles_intersecting_calls() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::OperationalStudies]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm, Role::OperationalStudies])
        );
    }

    #[tokio::test]
    async fn remove_roles_idempotent() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );

        remove_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([])
        );

        remove_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([])
        );
    }

    #[tokio::test]
    async fn remove_roles_intersecting_calls() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm, Role::OperationalStudies]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm, Role::OperationalStudies])
        );

        remove_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::OperationalStudies])
        );

        remove_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::OperationalStudies]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([])
        );
    }

    #[tokio::test]
    async fn infra_effective_grant_direct_and_inherited() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        openfga
            .write_tuples(&[Infra::reader().tuple(&User(1), &Infra(1))])
            .await
            .unwrap();

        let grant = infra_effective_grant(Subject::user(1), Infra(1))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(grant, Some(InfraGrant::Reader));

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(1)))
            .write(&Infra::owner().tuple(Group::member().userset(&Group(1)), &Infra(1)))
            .execute()
            .await
            .unwrap();

        let grant = infra_effective_grant(Subject::user(1), Infra(1))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(grant, Some(InfraGrant::Owner));
    }

    #[tokio::test]
    async fn user_infra_direct_grant() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        let infra_grant = async |user_id: i64| {
            infra_direct_grant(Subject::user(user_id), Infra(1))
                .authorize(&authorize)
                .await
                .unwrap()
                .unwrap_authorized()
                .await
        };

        assert_eq!(infra_grant(1).await, None);

        openfga
            .prepare_writes()
            .write(&Infra::reader().tuple(&User(1), &Infra(1)))
            .write(&Infra::writer().tuple(&User(2), &Infra(1)))
            .write(&Infra::owner().tuple(&User(3), &Infra(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(infra_grant(1).await, Some(InfraGrant::Reader));
        assert_eq!(infra_grant(2).await, Some(InfraGrant::Writer));
        assert_eq!(infra_grant(3).await, Some(InfraGrant::Owner));
    }

    #[tokio::test]
    async fn group_infra_direct_grant() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        let infra_grant = async |group_id: i64| {
            infra_direct_grant(Subject::group(group_id), Infra(1))
                .authorize(&authorize)
                .await
                .unwrap()
                .unwrap_authorized()
                .await
        };

        assert_eq!(infra_grant(1).await, None);

        openfga
            .prepare_writes()
            .write(&Infra::reader().tuple(Group::member().userset(&Group(1)), &Infra(1)))
            .write(&Infra::writer().tuple(Group::member().userset(&Group(2)), &Infra(1)))
            .write(&Infra::owner().tuple(Group::member().userset(&Group(3)), &Infra(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(infra_grant(1).await, Some(InfraGrant::Reader));
        assert_eq!(infra_grant(2).await, Some(InfraGrant::Writer));
        assert_eq!(infra_grant(3).await, Some(InfraGrant::Owner));
    }

    #[tokio::test]
    async fn no_inference_infra_direct_grant() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(1)))
            .write(&Group::member().tuple(&User(2), &Group(2)))
            .write(&Group::member().tuple(&User(3), &Group(3)))
            .write(&Infra::reader().tuple(&User(1), &Infra(1)))
            .write(&Infra::writer().tuple(Group::member().userset(&Group(2)), &Infra(1)))
            .write(&Infra::owner().tuple(&User(3), &Infra(1)))
            .write(&Infra::reader().tuple(Group::member().userset(&Group(3)), &Infra(1)))
            .execute()
            .await
            .unwrap();

        let user_direct_grant = async |user_id: i64| {
            infra_direct_grant(Subject::user(user_id), Infra(1))
                .authorize(&authorize)
                .await
                .unwrap()
                .unwrap_authorized()
                .await
        };

        let group_direct_grant = async |group_id: i64| {
            infra_direct_grant(Subject::group(group_id), Infra(1))
                .authorize(&authorize)
                .await
                .unwrap()
                .unwrap_authorized()
                .await
        };

        assert_eq!(user_direct_grant(1).await, Some(InfraGrant::Reader));
        assert_eq!(group_direct_grant(1).await, None);

        assert_eq!(user_direct_grant(2).await, None);
        assert_eq!(group_direct_grant(2).await, Some(InfraGrant::Writer));

        assert_eq!(user_direct_grant(3).await, Some(InfraGrant::Owner));
        assert_eq!(group_direct_grant(3).await, Some(InfraGrant::Reader));
    }

    #[tokio::test]
    #[should_panic]
    async fn infra_direct_grant_inconsistent_state_panics() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        openfga
            .prepare_writes()
            .write(&Infra::reader().tuple(&User(1), &Infra(1)))
            .write(&Infra::writer().tuple(&User(1), &Infra(1)))
            .execute()
            .await
            .unwrap();

        infra_direct_grant(Subject::user(1), Infra(1))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
    }

    #[tokio::test]
    async fn infra_privileges_non_admin() {
        let openfga = crate::authz_client!();

        openfga
            .write_tuples(&[Infra::writer().tuple(&User(1), &Infra(1))])
            .await
            .unwrap();

        assert_eq!(
            openfga.infra_privileges(User(1), Infra(1)).await,
            HashSet::from_iter([
                InfraPrivilege::CanRead,
                InfraPrivilege::CanShareRead,
                InfraPrivilege::CanWrite,
                InfraPrivilege::CanShareWrite,
            ])
        );
    }

    #[tokio::test]
    async fn infra_privileges_admin() {
        let openfga = crate::authz_client!();

        openfga
            .prepare_writes()
            .write(&User::role().tuple(&Role::Admin, &User(1)))
            .write(&Infra::reader().tuple(&User(2), &Infra(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(
            openfga.infra_privileges(User(1), Infra(1)).await,
            HashSet::from_iter([
                InfraPrivilege::CanRead,
                InfraPrivilege::CanShareRead,
                InfraPrivilege::CanWrite,
                InfraPrivilege::CanShareWrite,
                InfraPrivilege::CanDelete,
                InfraPrivilege::CanShareOwnership,
            ])
        );
    }

    #[tokio::test]
    async fn no_infra_privileges() {
        let openfga = crate::authz_client!();

        openfga
            .write_tuples(&[Infra::reader().tuple(&User(2), &Infra(1))])
            .await
            .unwrap();

        assert_eq!(
            openfga.infra_privileges(User(1), Infra(1)).await,
            HashSet::new(),
        );
    }
}
