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

#[cfg(test)]
mod tests {
    use crate::v2::TestClientExt as _;
    use crate::v2::special_authorizers::Authorize;

    use super::*;

    #[tokio::test]
    async fn rolling_stock_effective_grant_direct_and_inherited() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        openfga
            .write_tuples(&[RollingStock::reader().tuple(&User(1), &RollingStock(1))])
            .await
            .unwrap();

        let grant = rolling_stock_effective_grant(Subject::user(1), RollingStock(1))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(grant, Some(RollingStockGrant::Reader));

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(1)))
            .write(
                &RollingStock::owner().tuple(Group::member().userset(&Group(1)), &RollingStock(1)),
            )
            .execute()
            .await
            .unwrap();

        let grant = rolling_stock_effective_grant(Subject::user(1), RollingStock(1))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(grant, Some(RollingStockGrant::Owner));
    }

    #[tokio::test]
    async fn user_rolling_stock_direct_grant() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        let rs_grant = async |user_id: i64| {
            rolling_stock_direct_grant(Subject::user(user_id), RollingStock(1))
                .authorize(&authorize)
                .await
                .unwrap()
                .unwrap_authorized()
                .await
        };

        assert_eq!(rs_grant(1).await, None);

        openfga
            .prepare_writes()
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .write(&RollingStock::writer().tuple(&User(2), &RollingStock(1)))
            .write(&RollingStock::owner().tuple(&User(3), &RollingStock(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(rs_grant(1).await, Some(RollingStockGrant::Reader));
        assert_eq!(rs_grant(2).await, Some(RollingStockGrant::Writer));
        assert_eq!(rs_grant(3).await, Some(RollingStockGrant::Owner));
    }

    #[tokio::test]
    async fn group_rolling_stock_direct_grant() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        let rs_grant = async |group_id: i64| {
            rolling_stock_direct_grant(Subject::group(group_id), RollingStock(1))
                .authorize(&authorize)
                .await
                .unwrap()
                .unwrap_authorized()
                .await
        };

        assert_eq!(rs_grant(1).await, None);

        openfga
            .prepare_writes()
            .write(
                &RollingStock::reader().tuple(Group::member().userset(&Group(1)), &RollingStock(1)),
            )
            .write(
                &RollingStock::writer().tuple(Group::member().userset(&Group(2)), &RollingStock(1)),
            )
            .write(
                &RollingStock::owner().tuple(Group::member().userset(&Group(3)), &RollingStock(1)),
            )
            .execute()
            .await
            .unwrap();

        assert_eq!(rs_grant(1).await, Some(RollingStockGrant::Reader));
        assert_eq!(rs_grant(2).await, Some(RollingStockGrant::Writer));
        assert_eq!(rs_grant(3).await, Some(RollingStockGrant::Owner));
    }

    #[tokio::test]
    async fn no_inference_rolling_stock_direct_grant() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(1)))
            .write(&Group::member().tuple(&User(2), &Group(2)))
            .write(&Group::member().tuple(&User(3), &Group(3)))
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .write(
                &RollingStock::writer().tuple(Group::member().userset(&Group(2)), &RollingStock(1)),
            )
            .write(&RollingStock::owner().tuple(&User(3), &RollingStock(1)))
            .write(
                &RollingStock::reader().tuple(Group::member().userset(&Group(3)), &RollingStock(1)),
            )
            .execute()
            .await
            .unwrap();

        let user_direct_grant = async |user_id: i64| {
            rolling_stock_direct_grant(Subject::user(user_id), RollingStock(1))
                .authorize(&authorize)
                .await
                .unwrap()
                .unwrap_authorized()
                .await
        };

        let group_direct_grant = async |group_id: i64| {
            rolling_stock_direct_grant(Subject::group(group_id), RollingStock(1))
                .authorize(&authorize)
                .await
                .unwrap()
                .unwrap_authorized()
                .await
        };

        assert_eq!(user_direct_grant(1).await, Some(RollingStockGrant::Reader));
        assert_eq!(group_direct_grant(1).await, None);

        assert_eq!(user_direct_grant(2).await, None);
        assert_eq!(group_direct_grant(2).await, Some(RollingStockGrant::Writer));

        assert_eq!(user_direct_grant(3).await, Some(RollingStockGrant::Owner));
        assert_eq!(group_direct_grant(3).await, Some(RollingStockGrant::Reader));
    }

    #[tokio::test]
    #[should_panic]
    async fn rolling_stock_direct_grant_inconsistent_state_panics() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        openfga
            .prepare_writes()
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .write(&RollingStock::writer().tuple(&User(1), &RollingStock(1)))
            .execute()
            .await
            .unwrap();

        rolling_stock_direct_grant(Subject::user(1), RollingStock(1))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
    }

    #[tokio::test]
    async fn rolling_stock_privileges_non_admin() {
        let openfga = crate::authz_client!();

        openfga
            .write_tuples(&[RollingStock::writer().tuple(&User(1), &RollingStock(1))])
            .await
            .unwrap();

        assert_eq!(
            openfga
                .rolling_stock_privileges(User(1), RollingStock(1))
                .await,
            HashSet::from_iter([
                RollingStockPrivilege::CanRead,
                RollingStockPrivilege::CanShareRead,
                RollingStockPrivilege::CanWrite,
                RollingStockPrivilege::CanShareWrite,
            ])
        );
    }

    #[tokio::test]
    async fn rolling_stock_privileges_admin() {
        let openfga = crate::authz_client!();

        openfga
            .prepare_writes()
            .write(&User::role().tuple(&Role::Admin, &User(1)))
            .write(&RollingStock::reader().tuple(&User(2), &RollingStock(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(
            openfga
                .rolling_stock_privileges(User(1), RollingStock(1))
                .await,
            HashSet::from_iter([
                RollingStockPrivilege::CanRead,
                RollingStockPrivilege::CanShareRead,
                RollingStockPrivilege::CanWrite,
                RollingStockPrivilege::CanShareWrite,
                RollingStockPrivilege::CanDelete,
                RollingStockPrivilege::CanShareOwnership,
            ])
        );
    }

    #[tokio::test]
    async fn no_rolling_stock_privileges() {
        let openfga = crate::authz_client!();

        openfga
            .write_tuples(&[RollingStock::reader().tuple(&User(2), &RollingStock(1))])
            .await
            .unwrap();

        assert_eq!(
            openfga
                .rolling_stock_privileges(User(1), RollingStock(1))
                .await,
            HashSet::new(),
        );
    }
}
