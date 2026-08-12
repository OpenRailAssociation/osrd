use fga::client::UserList;
use fga::model::Relation as _;
use futures::FutureExt;
use itertools::Itertools as _;
use std::collections::HashSet;

use super::Check;
use super::Protected;
use crate::Group;
use crate::Role;
use crate::RollingStock;
use crate::RollingStockGrant;
use crate::RollingStockPrivilege;
use crate::Subject;
use crate::User;
use crate::v2::Actor;
use crate::v2::validate_direct_grant;

pub fn rolling_stock_privileges(
    user: User,
    rolling_stock: RollingStock,
) -> Protected<HashSet<RollingStockPrivilege>> {
    Protected::new(move |openfga| {
        async move {
            let (
                admin,
                can_restricted_read,
                can_read,
                can_share_read,
                can_write,
                can_share_write,
                can_delete,
                can_revoke,
                can_share_ownership,
            ) = openfga
                .checks((
                    User::role().check(&Role::Admin, &user),
                    RollingStock::can_restricted_read().check(&user, &rolling_stock),
                    RollingStock::can_read().check(&user, &rolling_stock),
                    RollingStock::can_share_read().check(&user, &rolling_stock),
                    RollingStock::can_write().check(&user, &rolling_stock),
                    RollingStock::can_share_write().check(&user, &rolling_stock),
                    RollingStock::can_delete().check(&user, &rolling_stock),
                    RollingStock::can_revoke().check(&user, &rolling_stock),
                    RollingStock::can_share_ownership().check(&user, &rolling_stock),
                ))
                .await?;
            let mut privileges = HashSet::new();
            privileges.extend(
                (admin || can_restricted_read).then_some(RollingStockPrivilege::CanRestrictedRead),
            );
            privileges.extend((admin || can_read).then_some(RollingStockPrivilege::CanRead));
            privileges
                .extend((admin || can_share_read).then_some(RollingStockPrivilege::CanShareRead));
            privileges.extend((admin || can_write).then_some(RollingStockPrivilege::CanWrite));
            privileges
                .extend((admin || can_share_write).then_some(RollingStockPrivilege::CanShareWrite));
            privileges.extend((admin || can_delete).then_some(RollingStockPrivilege::CanDelete));
            privileges.extend((admin || can_revoke).then_some(RollingStockPrivilege::CanRevoke));
            privileges.extend(
                (admin || can_share_ownership).then_some(RollingStockPrivilege::CanShareOwnership),
            );
            Ok(privileges)
        }
        .boxed()
    })
    .with_check(Check::HasRollingStockPrivilege(
        Actor::Issuer,
        RollingStockPrivilege::CanRestrictedRead,
        rolling_stock,
    ))
}

/// Returns the effective (maximum) grant a subject has on an [RollingStock], if any
///
/// A given user may have multiple grants on the same resource. This can happen
/// if a user inherits a grant from one of its groups and also has a direct grant.
/// Inherited grants are not the same thing as privileges: they do not have the same semantic,
/// are not represented by the same enum, do no work on the same scale nor in the same way.
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
    .with_check(Check::HasRollingStockPrivilege(
        Actor::Issuer,
        RollingStockPrivilege::CanRead,
        rolling_stock,
    ))
}

/// Sets the (direct) grant a subject has on an [RollingStock].
///
/// No transaction is setup as OpenFGA does not support them.
pub fn rolling_stock_set_grant(
    subject: Subject,
    rolling_stock: RollingStock,
    new_grant: RollingStockGrant,
) -> Protected<()> {
    let prot =
        rolling_stock_revoke_grant(subject, rolling_stock).map(move |openfga, _has_revoked| {
            async move {
                let mut writes = openfga.prepare_writes();
                match (subject, new_grant) {
                    (Subject::User(user), RollingStockGrant::RestrictedReader) => {
                        writes.push(&RollingStock::restricted_reader().tuple(&user, &rolling_stock))
                    }
                    (Subject::User(user), RollingStockGrant::Reader) => {
                        writes.push(&RollingStock::reader().tuple(&user, &rolling_stock))
                    }
                    (Subject::User(user), RollingStockGrant::Writer) => {
                        writes.push(&RollingStock::writer().tuple(&user, &rolling_stock))
                    }
                    (Subject::User(user), RollingStockGrant::Owner) => {
                        writes.push(&RollingStock::owner().tuple(&user, &rolling_stock))
                    }
                    (Subject::Group(group), RollingStockGrant::RestrictedReader) => writes.push(
                        &RollingStock::restricted_reader()
                            .tuple(Group::member().userset(&group), &rolling_stock),
                    ),
                    (Subject::Group(group), RollingStockGrant::Reader) => writes.push(
                        &RollingStock::reader()
                            .tuple(Group::member().userset(&group), &rolling_stock),
                    ),
                    (Subject::Group(group), RollingStockGrant::Writer) => writes.push(
                        &RollingStock::writer()
                            .tuple(Group::member().userset(&group), &rolling_stock),
                    ),
                    (Subject::Group(group), RollingStockGrant::Owner) => writes.push(
                        &RollingStock::owner()
                            .tuple(Group::member().userset(&group), &rolling_stock),
                    ),
                };
                writes.execute().await?;
                Ok(())
            }
            .boxed()
        });

    let share_privilege = match new_grant {
        RollingStockGrant::RestrictedReader => RollingStockPrivilege::CanRestrictedRead,
        RollingStockGrant::Reader => RollingStockPrivilege::CanShareRead,
        RollingStockGrant::Writer => RollingStockPrivilege::CanShareWrite,
        RollingStockGrant::Owner => RollingStockPrivilege::CanShareOwnership,
    };

    // Set grant rules:
    // 1. Issuer must have the correct sharing privilege [HasRollingStockPrivilege]
    // 2. Issuer is admin (may not have any direct grant on the resource)
    //     1. *can* demote the last owner [Authorizer admin bypass]
    //     2. can demote or promote anyone to any grant level otherwise [Authorizer admin bypass]
    //     3. can demote or promote any group [Authorizer admin bypass]
    // 3. Issuer is owner
    //     1. cannot demote the last owner (including self) [IsNotLastRollingStockOwner]
    //     2. cannot demote another owner [CanAlterSubjectRollingStockGrant]
    //     3. can demote or promote anyone to any grant level otherwise [CanAlterSubjectRollingStockGrant]
    //     4. **cannot** demote or promote any group [CanAlterSubjectRollingStockGrant]
    // 4. Issuer is anything else
    //     1. can demote self [HasRollingStockPrivilege]
    //     2. cannot promote self [HasRollingStockPrivilege]
    //     3. can promote anyone up to their own grant level [CanAlterSubjectRollingStockGrant + HasRollingStockPrivilege]
    //     4. can demote anyone with a strictly lower grant level than their own [CanAlterSubjectRollingStockGrant]
    //     5. **cannot** demote or promote any group [CanAlterSubjectRollingStockGrant]
    let prot = prot
        .reset_checks() // get rid of revoking-specific checks
        .with_check(Check::HasRollingStockPrivilege(
            Actor::Issuer,
            share_privilege,
            rolling_stock,
        ))
        .with_check(Check::CanAlterSubjectRollingStockGrant(
            subject,
            rolling_stock,
            new_grant,
        ));

    if new_grant != RollingStockGrant::Owner {
        prot.with_check(Check::IsNotLastRollingStockOwner(subject, rolling_stock))
    } else {
        prot
    }
}

/// Return an operation that checks the list of subjects which have the given grant on a rolling
/// stock.
pub fn rolling_stock_granted_subjects(
    rolling_stock: RollingStock,
    grant: RollingStockGrant,
) -> Protected<Vec<Subject>> {
    fn get_granted_users(
        rolling_stock: RollingStock,
        grant: RollingStockGrant,
    ) -> Protected<Vec<User>> {
        Protected::new(move |openfga| {
            async move {
                match grant {
                    RollingStockGrant::RestrictedReader => {
                        openfga
                            .list_users(
                                RollingStock::restricted_reader().query_users(&rolling_stock),
                            )
                            .await
                    }
                    RollingStockGrant::Reader => {
                        openfga
                            .list_users(RollingStock::reader().query_users(&rolling_stock))
                            .await
                    }
                    RollingStockGrant::Writer => {
                        openfga
                            .list_users(RollingStock::writer().query_users(&rolling_stock))
                            .await
                    }
                    RollingStockGrant::Owner => {
                        openfga
                            .list_users(RollingStock::owner().query_users(&rolling_stock))
                            .await
                    }
                }
                .map(|UserList { users, .. }| users)
            }
            .boxed()
        })
    }
    fn get_granted_groups(
        rolling_stock: RollingStock,
        grant: RollingStockGrant,
    ) -> Protected<Vec<Group>> {
        Protected::new(move |openfga| {
            async move {
                match grant {
                    RollingStockGrant::RestrictedReader => {
                        openfga
                            .list_usersets(
                                RollingStock::restricted_reader()
                                    .query_usersets(Group::member(), &rolling_stock),
                            )
                            .await
                    }
                    RollingStockGrant::Reader => {
                        openfga
                            .list_usersets(
                                RollingStock::reader()
                                    .query_usersets(Group::member(), &rolling_stock),
                            )
                            .await
                    }
                    RollingStockGrant::Writer => {
                        openfga
                            .list_usersets(
                                RollingStock::writer()
                                    .query_usersets(Group::member(), &rolling_stock),
                            )
                            .await
                    }
                    RollingStockGrant::Owner => {
                        openfga
                            .list_usersets(
                                RollingStock::owner()
                                    .query_usersets(Group::member(), &rolling_stock),
                            )
                            .await
                    }
                }
            }
            .boxed()
        })
    }
    get_granted_users(rolling_stock, grant)
        .zip(get_granted_groups(rolling_stock, grant))
        .map(move |_, (users, groups)| {
            async move {
                Ok(users
                    .into_iter()
                    .map(Subject::User)
                    .chain(groups.into_iter().map(Subject::Group))
                    .collect_vec())
            }
            .boxed()
        })
        .with_check(Check::HasRollingStockPrivilege(
            Actor::Issuer,
            RollingStockPrivilege::CanRead,
            rolling_stock,
        ))
}

/// Returns the *direct grant* a subject has on a [RollingStock], if any
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
                    openfga.tuple_exists(RollingStock::reader().tuple(user, &rolling_stock)),
                    openfga.tuple_exists(RollingStock::writer().tuple(user, &rolling_stock)),
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
                        RollingStock::owner().tuple(Group::member().userset(group), &rolling_stock)
                    ),
                )?,
            };
            Ok(
                validate_direct_grant(is_reader, is_writer, is_owner, *rolling_stock, subject)
                    .map(Into::into),
            )
        }
        .boxed()
    })
}

/// Revokes the (direct) grant a subject has on a [RollingStock], if any
///
/// Returns `true` if a grant was revoked, `false` otherwise, making the operation idempotent.
/// No transaction is setup as OpenFGA does not support them.
pub fn rolling_stock_revoke_grant(
    subject: Subject,
    rolling_stock: RollingStock,
) -> Protected<bool> {
    let prot = rolling_stock_direct_grant(subject, rolling_stock).map(move |openfga, grant| {
        async move {
            let Some(grant) = grant else {
                return Ok(false);
            };

            let mut delete = openfga.prepare_deletes();
            match (subject, grant) {
                (Subject::User(user), RollingStockGrant::RestrictedReader) => {
                    delete.push(&RollingStock::restricted_reader().tuple(&user, &rolling_stock))
                }
                (Subject::User(user), RollingStockGrant::Reader) => {
                    delete.push(&RollingStock::reader().tuple(&user, &rolling_stock))
                }
                (Subject::User(user), RollingStockGrant::Writer) => {
                    delete.push(&RollingStock::writer().tuple(&user, &rolling_stock))
                }
                (Subject::User(user), RollingStockGrant::Owner) => {
                    delete.push(&RollingStock::owner().tuple(&user, &rolling_stock))
                }
                (Subject::Group(group), RollingStockGrant::RestrictedReader) => delete.push(
                    &RollingStock::restricted_reader()
                        .tuple(Group::member().userset(&group), &rolling_stock),
                ),
                (Subject::Group(group), RollingStockGrant::Reader) => delete.push(
                    &RollingStock::reader().tuple(Group::member().userset(&group), &rolling_stock),
                ),
                (Subject::Group(group), RollingStockGrant::Writer) => delete.push(
                    &RollingStock::writer().tuple(Group::member().userset(&group), &rolling_stock),
                ),
                (Subject::Group(group), RollingStockGrant::Owner) => delete.push(
                    &RollingStock::owner().tuple(Group::member().userset(&group), &rolling_stock),
                ),
            };
            delete.execute().await?;
            Ok(true)
        }
        .boxed()
    });

    // Revoking rules:
    // 1. Only owners (and admins) can fully revoke grants
    // 2. The last owner of a resource cannot be revoked (admins can)
    // 3. An owner cannot revoke another owner
    prot.with_check(Check::HasRollingStockPrivilege(
        Actor::Issuer,
        RollingStockPrivilege::CanRevoke,
        rolling_stock,
    ))
    .with_check(Check::SubjectEffectiveRollingStockGrantIsNot(
        RollingStockGrant::Owner,
        subject,
        rolling_stock,
    ))
    .with_check(Check::IsNotLastRollingStockOwner(subject, rolling_stock))
}

#[cfg(test)]
mod tests {
    use rstest::rstest;

    use crate::User;
    use crate::v2::TestClientExt as _;
    use crate::v2::special_authorizers::Authorize;

    use super::*;

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
                RollingStockPrivilege::CanRestrictedRead,
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
                RollingStockPrivilege::CanRestrictedRead,
                RollingStockPrivilege::CanRead,
                RollingStockPrivilege::CanShareRead,
                RollingStockPrivilege::CanWrite,
                RollingStockPrivilege::CanShareWrite,
                RollingStockPrivilege::CanDelete,
                RollingStockPrivilege::CanShareOwnership,
                RollingStockPrivilege::CanRevoke,
            ])
        );
    }

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

    #[tokio::test]
    async fn rolling_stock_granted_subjects_direct_and_indirect() {
        let openfga = crate::authz_client!();
        openfga
            .prepare_writes()
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .write(&RollingStock::writer().tuple(&User(2), &RollingStock(1)))
            .write(&Group::member().tuple(&User(3), &Group(1)))
            .write(
                &RollingStock::writer().tuple(Group::member().userset(&Group(1)), &RollingStock(1)),
            )
            .execute()
            .await
            .unwrap();
        assert_eq!(
            openfga
                .rolling_stock_granted_subjects(RollingStock(1), RollingStockGrant::Reader)
                .await,
            vec![Subject::User(User(1))]
        );
        let mut response = openfga
            .rolling_stock_granted_subjects(RollingStock(1), RollingStockGrant::Writer)
            .await;
        let mut expected = vec![
            Subject::user(2),  // Direct relationship
            Subject::user(3),  // Indirect relationship
            Subject::group(1), // Direct relationship
        ];
        expected.sort();
        response.sort();
        assert_eq!(response, expected);
    }

    #[tokio::test]
    async fn user_rolling_stock_direct_grant() {
        let openfga = crate::authz_client!();

        let rolling_stock_grant = async |user_id: i64| {
            openfga
                .rolling_stock_direct_grant(Subject::user(user_id), RollingStock(1))
                .await
        };

        assert_eq!(rolling_stock_grant(1).await, None);

        openfga
            .prepare_writes()
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .write(&RollingStock::writer().tuple(&User(2), &RollingStock(1)))
            .write(&RollingStock::owner().tuple(&User(3), &RollingStock(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(
            rolling_stock_grant(1).await,
            Some(RollingStockGrant::Reader)
        );
        assert_eq!(
            rolling_stock_grant(2).await,
            Some(RollingStockGrant::Writer)
        );
        assert_eq!(rolling_stock_grant(3).await, Some(RollingStockGrant::Owner));
    }

    #[tokio::test]
    async fn group_rolling_stock_direct_grant() {
        let openfga = crate::authz_client!();

        let rolling_stock_grant = async |group_id: i64| {
            openfga
                .rolling_stock_direct_grant(Subject::group(group_id), RollingStock(1))
                .await
        };

        assert_eq!(rolling_stock_grant(1).await, None);

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

        assert_eq!(
            rolling_stock_grant(1).await,
            Some(RollingStockGrant::Reader)
        );
        assert_eq!(
            rolling_stock_grant(2).await,
            Some(RollingStockGrant::Writer)
        );
        assert_eq!(rolling_stock_grant(3).await, Some(RollingStockGrant::Owner));
    }

    #[tokio::test]
    async fn no_inference_rolling_stock_direct_grant() {
        let openfga = crate::authz_client!();

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
            openfga
                .rolling_stock_direct_grant(Subject::user(user_id), RollingStock(1))
                .await
        };
        let group_direct_grant = async |group_id: i64| {
            openfga
                .rolling_stock_direct_grant(Subject::group(group_id), RollingStock(1))
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

        openfga
            .prepare_writes()
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .write(&RollingStock::writer().tuple(&User(1), &RollingStock(1)))
            .execute()
            .await
            .unwrap();

        openfga
            .rolling_stock_direct_grant(Subject::user(1), RollingStock(1))
            .await;
    }

    #[rstest::rstest]
    #[case::user_reader(Subject::user(1), RollingStockGrant::Reader)]
    #[case::user_writer(Subject::user(1), RollingStockGrant::Writer)]
    #[case::user_owner(Subject::user(1), RollingStockGrant::Owner)]
    #[case::group_reader(Subject::group(1), RollingStockGrant::Reader)]
    #[case::group_writer(Subject::group(1), RollingStockGrant::Writer)]
    #[case::group_owner(Subject::group(1), RollingStockGrant::Owner)]
    #[tokio::test]
    async fn revoke_rolling_stock_grant_ok(
        #[case] subject: Subject,
        #[case] grant: RollingStockGrant,
    ) {
        let openfga = crate::authz_client!();
        openfga
            .rolling_stock_set_grant(RollingStock(1), subject, grant)
            .await;
        assert_eq!(
            openfga
                .rolling_stock_direct_grant(subject, RollingStock(1))
                .await,
            Some(grant)
        );
        assert!(
            openfga
                .rolling_stock_revoke_grant(subject, RollingStock(1))
                .await
        );
        assert_eq!(
            openfga
                .rolling_stock_direct_grant(subject, RollingStock(1))
                .await,
            None
        );
    }

    #[tokio::test]
    async fn revoke_rolling_stock_grant_noop() {
        let openfga = crate::authz_client!();
        assert!(
            !openfga
                .rolling_stock_revoke_grant(Subject::user(1), RollingStock(1))
                .await
        );
    }

    #[tokio::test]
    async fn revoke_rolling_stock_grant_with_inherited() {
        let openfga = crate::authz_client!();

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(10)))
            .write(
                &RollingStock::writer()
                    .tuple(Group::member().userset(&Group(10)), &RollingStock(1)),
            ) // inherited
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1))) // direct
            .write(&RollingStock::owner().tuple(&User(1), &RollingStock(2))) // unrelated
            .execute()
            .await
            .unwrap();

        assert_eq!(
            openfga
                .rolling_stock_direct_grant(Subject::user(1), RollingStock(1))
                .await,
            Some(RollingStockGrant::Reader)
        );
        assert!(
            openfga
                .rolling_stock_revoke_grant(Subject::user(1), RollingStock(1))
                .await
        );
        assert_eq!(
            openfga
                .rolling_stock_direct_grant(Subject::user(1), RollingStock(1))
                .await,
            None
        );
        assert_eq!(
            openfga
                .rolling_stock_effective_grant(Subject::user(1), RollingStock(1))
                .await,
            Some(RollingStockGrant::Writer)
        );
        assert_eq!(
            openfga
                .rolling_stock_direct_grant(Subject::user(1), RollingStock(2))
                .await,
            Some(RollingStockGrant::Owner)
        );
    }

    #[rstest]
    #[case::rolling_stock_privileges(
        rolling_stock_privileges(User(1), RollingStock(1)).checks,
        &[
           Check::HasRollingStockPrivilege(Actor::Issuer, RollingStockPrivilege::CanRestrictedRead, RollingStock(1))
        ]
    )]
    #[rstest]
    #[case::rolling_stock_effective_grant(
        rolling_stock_effective_grant(Subject::user(1), RollingStock(1)).checks,
        &[
           Check::HasRollingStockPrivilege(Actor::Issuer, RollingStockPrivilege::CanRead, RollingStock(1))
        ]
    )]
    #[rstest]
    #[case::rolling_stock_granted_subjects(
        rolling_stock_granted_subjects(RollingStock(1), RollingStockGrant::Writer).checks,
        &[
           Check::HasRollingStockPrivilege(Actor::Issuer, RollingStockPrivilege::CanRead, RollingStock(1))
        ]
    )]
    fn protected_contains_expected_checks(
        #[case] protected_checks: HashSet<Check>,
        #[case] expected_checks: &[Check],
    ) {
        // Make sure that each public protected op contains its expected list of checks
        let expected_checks = expected_checks.iter().copied().collect::<HashSet<_>>();
        assert_eq!(expected_checks, protected_checks);
    }
}
