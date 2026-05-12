use std::collections::HashSet;

use fga::model::Relation as _;
use futures::FutureExt;

use crate::Group;
use crate::Role;
use crate::RollingStock;
use crate::RollingStockGrant;
use crate::Subject;

use crate::User;
use crate::model::RollingStockPrivilege;

use super::Guardrail;
use super::Protected;
use super::SanityCheck;

/// Returns the *direct grant* a subject has on an [RollingStock], if any
///
/// A user can have *indirect grants* on a resource through group membership.
/// For those, use [`rolling_stock_effective_grant`].
///
/// A subject can have at most one direct grant on any resource. Should this
/// invariant be violated, the protected operation will panic.
pub fn rolling_stock_direct_grant(
    subject: Subject,
    rolling_stock: RollingStock,
) -> Protected<Option<RollingStockGrant>> {
    Protected::new(move |openfga| {
        async move {
            let (is_reader, is_writer, is_owner) = match &subject {
                Subject::User(user) => tokio::try_join!(
                    openfga
                        .tuple_exists(RollingStock::reader().tuple(user, &rolling_stock)),
                    openfga
                        .tuple_exists(RollingStock::writer().tuple(user, &rolling_stock)),
                    openfga.tuple_exists(RollingStock::owner().tuple(user, &rolling_stock)),
                )?,
                Subject::Group(group) => tokio::try_join!(
                    openfga.tuple_exists(
                        RollingStock::reader()
                            .tuple(Group::member().userset(group), &rolling_stock)
                    ),
                    openfga.tuple_exists(
                        RollingStock::writer()
                            .tuple(Group::member().userset(group), &rolling_stock)
                    ),
                    openfga.tuple_exists(
                        RollingStock::owner()
                            .tuple(Group::member().userset(group), &rolling_stock)
                    ),
                )?,
            };

            match (is_reader, is_writer, is_owner) {
                (true, false, false) => Ok(Some(RollingStockGrant::Reader)),
                (false, true, false) => Ok(Some(RollingStockGrant::Writer)),
                (false, false, true) => Ok(Some(RollingStockGrant::Owner)),
                (false, false, false) => Ok(None),
                _ => {
                    tracing::error!(
                        is_reader,
                        is_writer,
                        is_owner,
                        ?subject,
                        resource = ?rolling_stock,
                        "Subject has multiple direct grants on the same resource"
                    );
                    panic!(
                        "Subject '{subject:?}' has multiple direct grants on the same resource '{rolling_stock:?}', which is not supposed to happen by design. \n\
                        Detected direct grants: reader: {is_reader}, writer: {is_writer}, owner: {is_owner}"
                    )
                }
            }
        }
        .boxed()
    })
    .with_check(SanityCheck::SubjectExists(subject))
    .with_check(SanityCheck::RollingStockExists(rolling_stock))
}

/// Returns the effective (maximum) grant a subject has on an [RollingStock], if any
///
/// A given user may have multiple grants on the same resource. This can happen
/// if a user inherits a grant from one of its groups and also has a direct grant.
/// Inherited grants are not the same thing as privileges: they do not have the same semantic,
/// are not represented by the same enum, do no work on the same scale nor in the same way.
///
/// For direct grants, see [`rolling_stock_direct_grant`].
///
/// Groups only have direct grants. If multiple direct grants are found, this protected operation will panic.
pub fn rolling_stock_effective_grant(
    subject: Subject,
    rolling_stock: RollingStock,
) -> Protected<Option<RollingStockGrant>> {
    Protected::new(move |openfga| {
        async move {
            let (is_reader, is_writer, is_owner) = match &subject {
                Subject::User(user) => {
                    openfga
                        .checks((
                            RollingStock::reader().check(user, &rolling_stock),
                            RollingStock::writer().check(user, &rolling_stock),
                            RollingStock::owner().check(user, &rolling_stock),
                        ))
                        .await?
                }
                Subject::Group(group) => {
                    let (is_reader, is_writer, is_owner) = openfga
                        .checks((
                            RollingStock::reader()
                                .check(Group::member().userset(group), &rolling_stock),
                            RollingStock::writer()
                                .check(Group::member().userset(group), &rolling_stock),
                            RollingStock::owner()
                                .check(Group::member().userset(group), &rolling_stock),
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
                            resource = ?rolling_stock,
                            "Group has multiple direct grants on the same resource"
                        );
                        panic!(
                            "Group {subject:?} has multiple direct grants on the same resource {rolling_stock:?}, which is not supposed to happen by design. \n\
                            While a user may have inherited grants from one of their groups, groups do not have inherited grants. \n\
                            Detected direct grants: reader: {is_reader}, writer: {is_writer}, owner: {is_owner}"
                        );
                    }
                    (is_reader, is_writer, is_owner)
                }
            };
            Ok(is_owner
                .then_some(RollingStockGrant::Owner)
                .or_else(|| is_writer.then_some(RollingStockGrant::Writer))
                .or_else(|| is_reader.then_some(RollingStockGrant::Reader)))
        }
        .boxed()
    })
    .with_check(SanityCheck::SubjectExists(subject))
    .with_check(SanityCheck::RollingStockExists(rolling_stock))
    .with_guardrail(Guardrail::IssuerHasRollingStockPrivilege(
        RollingStockPrivilege::CanRead,
        rolling_stock,
    ))
}

pub fn rolling_stock_privileges(
    user: User,
    rolling_stock: RollingStock,
) -> Protected<HashSet<RollingStockPrivilege>> {
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
                    RollingStock::can_read().check(&user, &rolling_stock),
                    RollingStock::can_share_read().check(&user, &rolling_stock),
                    RollingStock::can_write().check(&user, &rolling_stock),
                    RollingStock::can_share_write().check(&user, &rolling_stock),
                    RollingStock::can_delete().check(&user, &rolling_stock),
                    RollingStock::can_share_ownership().check(&user, &rolling_stock),
                ))
                .await?;
            let mut privileges = HashSet::new();
            privileges.extend((admin || can_read).then_some(RollingStockPrivilege::CanRead));
            privileges
                .extend((admin || can_share_read).then_some(RollingStockPrivilege::CanShareRead));
            privileges.extend((admin || can_write).then_some(RollingStockPrivilege::CanWrite));
            privileges
                .extend((admin || can_share_write).then_some(RollingStockPrivilege::CanShareWrite));
            privileges.extend((admin || can_delete).then_some(RollingStockPrivilege::CanDelete));
            privileges.extend(
                (admin || can_share_ownership).then_some(RollingStockPrivilege::CanShareOwnership),
            );
            Ok(privileges)
        }
        .boxed()
    })
    .with_check(SanityCheck::RollingStockExists(rolling_stock))
    .with_check(SanityCheck::SubjectExists(Subject::user(user)))
    .with_guardrail(Guardrail::IssuerHasRollingStockPrivilege(
        RollingStockPrivilege::CanRead,
        rolling_stock,
    ))
}

pub fn rolling_stock_grant(
    subject: Subject,
    rolling_stock: RollingStock,
    grant: RollingStockGrant,
) -> Protected<()> {
    Protected::new(move |openfga| {
        async move {
            let mut writes = openfga.prepare_writes();
            match (&subject, grant) {
                (Subject::User(user), RollingStockGrant::Owner) => {
                    writes.push(&RollingStock::owner().tuple(user, &rolling_stock));
                }
                (Subject::User(user), RollingStockGrant::Writer) => {
                    writes.push(&RollingStock::writer().tuple(user, &rolling_stock));
                }
                (Subject::User(user), RollingStockGrant::Reader) => {
                    writes.push(&RollingStock::reader().tuple(user, &rolling_stock));
                }
                (Subject::Group(group), RollingStockGrant::Owner) => {
                    writes.push(
                        &RollingStock::owner()
                            .tuple(Group::member().userset(group), &rolling_stock),
                    );
                }
                (Subject::Group(group), RollingStockGrant::Writer) => {
                    writes.push(
                        &RollingStock::writer()
                            .tuple(Group::member().userset(group), &rolling_stock),
                    );
                }
                (Subject::Group(group), RollingStockGrant::Reader) => {
                    writes.push(
                        &RollingStock::reader()
                            .tuple(Group::member().userset(group), &rolling_stock),
                    );
                }
            }
            writes.execute().await?;
            Ok(())
        }
        .boxed()
    })
    .with_check(SanityCheck::RollingStockExists(rolling_stock))
    .with_check(SanityCheck::SubjectExists(subject))
}

pub fn rolling_stock_revoke(
    subject: Subject,
    rolling_stock: RollingStock,
    grant: RollingStockGrant,
) -> Protected<bool> {
    rolling_stock_direct_grant(subject, rolling_stock).map(move |openfga, existing_grant| {
        async move {
            if existing_grant != Some(grant) {
                return Ok(false);
            }
            let mut deletes = openfga.prepare_deletes();
            match (&subject, grant) {
                (Subject::User(user), RollingStockGrant::Owner) => {
                    deletes.push(&RollingStock::owner().tuple(user, &rolling_stock));
                }
                (Subject::User(user), RollingStockGrant::Writer) => {
                    deletes.push(&RollingStock::writer().tuple(user, &rolling_stock));
                }
                (Subject::User(user), RollingStockGrant::Reader) => {
                    deletes.push(&RollingStock::reader().tuple(user, &rolling_stock));
                }
                (Subject::Group(group), RollingStockGrant::Owner) => {
                    deletes.push(
                        &RollingStock::owner()
                            .tuple(Group::member().userset(group), &rolling_stock),
                    );
                }
                (Subject::Group(group), RollingStockGrant::Writer) => {
                    deletes.push(
                        &RollingStock::writer()
                            .tuple(Group::member().userset(group), &rolling_stock),
                    );
                }
                (Subject::Group(group), RollingStockGrant::Reader) => {
                    deletes.push(
                        &RollingStock::reader()
                            .tuple(Group::member().userset(group), &rolling_stock),
                    );
                }
            }
            deletes.execute().await?;
            Ok(true)
        }
        .boxed()
    })
}

pub fn rolling_stock_granted(
    _rolling_stock: RollingStock,
    _grant: RollingStockGrant,
) -> Protected<Vec<Subject>> {
    todo!()
}

pub fn rolling_stock_list(_privilege: RollingStockPrivilege) -> Protected<Vec<RollingStock>> {
    todo!()
}
