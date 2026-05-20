use std::collections::HashSet;

use fga::client::QueryError;
use fga::model::Relation as _;
use futures::FutureExt;
use itertools::Itertools as _;

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

/// List the users with a specific grant on a given rolling stock.
pub fn rolling_stock_granted(
    rolling_stock: RollingStock,
    grant: RollingStockGrant,
) -> Protected<Vec<Subject>> {
    Protected::new(move |openfga| {
        async move {
            let subjects_with_grant = match grant {
                RollingStockGrant::Reader => {
                    openfga
                        .list_users(RollingStock::reader().query_users(&rolling_stock))
                        .await
                        .map_err(QueryError::parsing_ok)?
                        .users
                }
                RollingStockGrant::Writer => {
                    openfga
                        .list_users(RollingStock::writer().query_users(&rolling_stock))
                        .await
                        .map_err(QueryError::parsing_ok)?
                        .users
                }
                RollingStockGrant::Owner => {
                    openfga
                        .list_users(RollingStock::owner().query_users(&rolling_stock))
                        .await
                        .map_err(QueryError::parsing_ok)?
                        .users
                }
            }
            .into_iter()
            .map(Subject::User)
            .collect_vec();
            Ok(subjects_with_grant)
        }
        .boxed()
    })
    // TODO PR: is it the expected behavior ? Or should listing user grants on a resource be reserved
    // to owners and admins ?
    .with_guardrail(Guardrail::IssuerHasRollingStockPrivilege(
        RollingStockPrivilege::CanRead,
        rolling_stock,
    ))
}

/// List the rolling stocks on which the issuer has the given rolling stock privilege
pub fn rolling_stock_list(
    privilege: RollingStockPrivilege,
    subject: Subject,
) -> Protected<Vec<RollingStock>> {
    Protected::new(move |openfga| {
        async move {
            let rolling_stocks_with_grant = match (privilege, subject) {
                (RollingStockPrivilege::CanRead, Subject::Group(group)) => {
                    openfga
                        .list_objects(
                            RollingStock::can_read().query_objects(Group::member().userset(&group)),
                        )
                        .await
                }
                (RollingStockPrivilege::CanShareRead, Subject::Group(group)) => {
                    openfga
                        .list_objects(
                            RollingStock::can_share_read()
                                .query_objects(Group::member().userset(&group)),
                        )
                        .await
                }
                (RollingStockPrivilege::CanWrite, Subject::Group(group)) => {
                    openfga
                        .list_objects(
                            RollingStock::can_write()
                                .query_objects(Group::member().userset(&group)),
                        )
                        .await
                }
                (RollingStockPrivilege::CanShareWrite, Subject::Group(group)) => {
                    openfga
                        .list_objects(
                            RollingStock::can_share_write()
                                .query_objects(Group::member().userset(&group)),
                        )
                        .await
                }
                (RollingStockPrivilege::CanDelete, Subject::Group(group)) => {
                    openfga
                        .list_objects(
                            RollingStock::can_delete()
                                .query_objects(Group::member().userset(&group)),
                        )
                        .await
                }
                (RollingStockPrivilege::CanShareOwnership, Subject::Group(group)) => {
                    openfga
                        .list_objects(
                            RollingStock::can_share_ownership()
                                .query_objects(Group::member().userset(&group)),
                        )
                        .await
                }
                (RollingStockPrivilege::CanRead, Subject::User(user)) => {
                    openfga
                        .list_objects(RollingStock::can_read().query_objects(&user))
                        .await
                }
                (RollingStockPrivilege::CanShareRead, Subject::User(user)) => {
                    openfga
                        .list_objects(RollingStock::can_share_read().query_objects(&user))
                        .await
                }
                (RollingStockPrivilege::CanWrite, Subject::User(user)) => {
                    openfga
                        .list_objects(RollingStock::can_write().query_objects(&user))
                        .await
                }
                (RollingStockPrivilege::CanShareWrite, Subject::User(user)) => {
                    openfga
                        .list_objects(RollingStock::can_share_write().query_objects(&user))
                        .await
                }
                (RollingStockPrivilege::CanDelete, Subject::User(user)) => {
                    openfga
                        .list_objects(RollingStock::can_delete().query_objects(&user))
                        .await
                }
                (RollingStockPrivilege::CanShareOwnership, Subject::User(user)) => {
                    openfga
                        .list_objects(RollingStock::can_share_ownership().query_objects(&user))
                        .await
                }
            }
            .map_err(QueryError::parsing_ok)?;
            Ok(rolling_stocks_with_grant)
        }
        .boxed()
    })
}

#[cfg(test)]
mod tests {
    use fga::model::Relation as _;

    use crate::{
        Group, RollingStock, RollingStockGrant, RollingStockPrivilege, Subject, User,
        v2::{Authorizer as _, special_authorizers::Authorize},
    };

    #[tokio::test]
    async fn rolling_stock_granted() {
        let openfga = crate::authz_client!();
        openfga
            .prepare_writes()
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .write(&RollingStock::writer().tuple(&User(2), &RollingStock(1)))
            .write(&RollingStock::owner().tuple(&User(3), &RollingStock(1)))
            .write(&RollingStock::reader().tuple(&User(4), &RollingStock(1)))
            .execute()
            .await
            .unwrap();
        let authorize = Authorize(&openfga);
        let mut readers = super::rolling_stock_granted(RollingStock(1), RollingStockGrant::Reader)
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        let writers = super::rolling_stock_granted(RollingStock(1), RollingStockGrant::Writer)
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        let owners = super::rolling_stock_granted(RollingStock(1), RollingStockGrant::Owner)
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        readers.sort();
        assert_eq!(
            readers,
            vec![Subject::User(User(1)), Subject::User(User(4))]
        );
        assert_eq!(writers, vec![Subject::User(User(2))]);
        assert_eq!(owners, vec![Subject::User(User(3))]);
    }

    #[tokio::test]
    async fn rolling_stock_granted_nonexistent_user() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);
        let readers = super::rolling_stock_granted(RollingStock(1), RollingStockGrant::Reader)
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(readers, vec![]);
    }

    #[tokio::test]
    async fn rolling_stock_listt() {
        let openfga = crate::authz_client!();
        let authorizer = Authorize(&openfga);
        openfga
            .prepare_writes()
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(2)))
            .write(&RollingStock::writer().tuple(&User(1), &RollingStock(3)))
            .write(&RollingStock::owner().tuple(&User(1), &RollingStock(4)))
            .write(&Group::member().tuple(&User(2), &Group(1)))
            .write(
                &RollingStock::writer().tuple(Group::member().userset(&Group(1)), &RollingStock(1)),
            )
            .execute()
            .await
            .unwrap();
        let mut rs_read_grant = authorizer
            .authorize(super::rolling_stock_list(
                RollingStockPrivilege::CanRead,
                Subject::User(User(1)),
            ))
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        let mut rs_write_grant = authorizer
            .authorize(super::rolling_stock_list(
                RollingStockPrivilege::CanWrite,
                Subject::User(User(1)),
            ))
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        let mut rs_can_delete_grant = authorizer
            .authorize(super::rolling_stock_list(
                RollingStockPrivilege::CanDelete,
                Subject::User(User(1)),
            ))
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        let mut rs_group_can_write_grant = authorizer
            .authorize(super::rolling_stock_list(
                RollingStockPrivilege::CanWrite,
                Subject::Group(Group(1)),
            ))
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        rs_read_grant.sort();
        rs_write_grant.sort();
        rs_can_delete_grant.sort();
        rs_group_can_write_grant.sort();
        assert_eq!(
            rs_read_grant,
            vec![
                RollingStock(1),
                RollingStock(2),
                RollingStock(3),
                RollingStock(4)
            ]
        );
        assert_eq!(rs_write_grant, vec![RollingStock(3), RollingStock(4)]);
        assert_eq!(rs_can_delete_grant, vec![RollingStock(4)]);
        assert_eq!(rs_group_can_write_grant, vec![RollingStock(1)]);
    }

    #[tokio::test]
    async fn rolling_stock_list_no_matching_rolling_stock() {
        let openfga = crate::authz_client!();
        let authorizer = Authorize(&openfga);
        openfga
            .prepare_writes()
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .execute()
            .await
            .unwrap();
        let rs_write_grants = authorizer
            .authorize(super::rolling_stock_list(
                RollingStockPrivilege::CanWrite,
                Subject::User(User(1)),
            ))
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(rs_write_grants, vec![]);
    }

    #[tokio::test]
    async fn rolling_stock_list_nonexistent_user() {
        let openfga = crate::authz_client!();
        let authorizer = Authorize(&openfga);
        openfga
            .prepare_writes()
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .execute()
            .await
            .unwrap();
        let rs_write_grants = authorizer
            .authorize(super::rolling_stock_list(
                RollingStockPrivilege::CanWrite,
                Subject::User(User(2)), // does not exist
            ))
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(rs_write_grants, vec![]);
    }
}
