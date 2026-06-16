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
use crate::v2::ResourcesList;
use crate::v2::subject_roles;

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
                can_revoke,
                can_share_ownership,
            ) = openfga
                .checks((
                    User::role().check(&Role::Admin, &user),
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
    .with_check(Check::RollingStockExists(rolling_stock))
    .with_check(Check::SubjectExists(Subject::user(user)))
    .with_check(Check::HasRollingStockPrivilege(
        Actor::Issuer,
        RollingStockPrivilege::CanRead,
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
    .with_check(Check::SubjectExists(subject))
    .with_check(Check::RollingStockExists(rolling_stock))
    .with_check(Check::HasRollingStockPrivilege(
        Actor::Issuer,
        RollingStockPrivilege::CanRead,
        rolling_stock,
    ))
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
        .with_check(Check::RollingStockExists(rolling_stock))
}

pub fn rolling_stock_list(
    user: User,
    privilege: RollingStockPrivilege,
) -> Protected<ResourcesList<RollingStock>> {
    subject_roles(Subject::user(user)).map(move |openfga, roles| {
        async move {
            if roles.contains(&Role::Admin) {
                return Ok(ResourcesList::All);
            }
            let authorized_rolling_stocks = match privilege {
                RollingStockPrivilege::CanRead => {
                    openfga
                        .list_objects(RollingStock::can_read().query_objects(&user))
                        .await?
                }
                RollingStockPrivilege::CanShareRead => {
                    openfga
                        .list_objects(RollingStock::can_share_read().query_objects(&user))
                        .await?
                }
                RollingStockPrivilege::CanWrite => {
                    openfga
                        .list_objects(RollingStock::can_write().query_objects(&user))
                        .await?
                }
                RollingStockPrivilege::CanShareWrite => {
                    openfga
                        .list_objects(RollingStock::can_share_write().query_objects(&user))
                        .await?
                }
                RollingStockPrivilege::CanDelete => {
                    openfga
                        .list_objects(RollingStock::can_delete().query_objects(&user))
                        .await?
                }
                RollingStockPrivilege::CanShareOwnership => {
                    openfga
                        .list_objects(RollingStock::can_share_ownership().query_objects(&user))
                        .await?
                }
                RollingStockPrivilege::CanRevoke => {
                    openfga
                        .list_objects(RollingStock::can_revoke().query_objects(&user))
                        .await?
                }
            };
            Ok(ResourcesList::Privileged(authorized_rolling_stocks))
        }
        .boxed()
    })
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
    async fn check_rolling_stock_list_no_rights_and_admin() {
        let openfga = crate::authz_client!();
        openfga
            .prepare_writes()
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(3)))
            .write(&RollingStock::writer().tuple(&User(2), &RollingStock(2)))
            .write(&User::role().tuple(&Role::Admin, &User(3)))
            .execute()
            .await
            .unwrap();
        let rolling_stocks_1 = openfga
            .rolling_stock_list(User(1), RollingStockPrivilege::CanRead)
            .await
            .unwrap_privileged()
            .into_iter();
        let rolling_stocks_2 = openfga
            .rolling_stock_list(User(2), RollingStockPrivilege::CanRead)
            .await
            .unwrap_privileged()
            .into_iter();
        let rolling_stocks_no_rights = openfga
            .rolling_stock_list(User(4), RollingStockPrivilege::CanRead)
            .await
            .unwrap_privileged();
        let rolling_stocks_admin = openfga
            .rolling_stock_list(User(3), RollingStockPrivilege::CanRead)
            .await;
        assert_eq!(
            rolling_stocks_1.sorted().collect_vec(),
            vec![RollingStock(1), RollingStock(3)]
        );
        assert_eq!(
            rolling_stocks_2.sorted().collect_vec(),
            vec![RollingStock(2)]
        );
        assert_eq!(rolling_stocks_no_rights, vec![]);
        assert!(matches!(rolling_stocks_admin, ResourcesList::All));
    }

    #[tokio::test]
    async fn rolling_stock_list_only_returns_resources_with_the_queried_privilege() {
        let openfga = crate::authz_client!();
        openfga
            .prepare_writes()
            .write(&RollingStock::reader().tuple(&User(1), &RollingStock(1)))
            .write(&RollingStock::writer().tuple(&User(2), &RollingStock(2)))
            .execute()
            .await
            .unwrap();

        // A reader grant grants read access and not write access
        let reader_can_read = openfga
            .rolling_stock_list(User(1), RollingStockPrivilege::CanRead)
            .await
            .unwrap_privileged();
        assert_eq!(reader_can_read, vec![RollingStock(1)]);

        let reader_can_write = openfga
            .rolling_stock_list(User(1), RollingStockPrivilege::CanWrite)
            .await
            .unwrap_privileged();
        assert_eq!(reader_can_write, vec![]);

        // A writer grant grants both read and write access
        let writer_can_write = openfga
            .rolling_stock_list(User(2), RollingStockPrivilege::CanWrite)
            .await
            .unwrap_privileged();
        assert_eq!(writer_can_write, vec![RollingStock(2)]);
    }

    #[rstest]
    #[case::rolling_stock_privileges(
        rolling_stock_privileges(User(1), RollingStock(1)).checks,
        &[
           Check::SubjectExists(Subject::user(1)),
           Check::HasRollingStockPrivilege(Actor::Issuer, RollingStockPrivilege::CanRead, RollingStock(1)),
           Check::RollingStockExists(RollingStock(1))
        ]
    )]
    #[rstest]
    #[case::rolling_stock_effective_grant(
        rolling_stock_effective_grant(Subject::user(1), RollingStock(1)).checks,
        &[
           Check::SubjectExists(Subject::user(1)),
           Check::HasRollingStockPrivilege(Actor::Issuer, RollingStockPrivilege::CanRead, RollingStock(1)),
           Check::RollingStockExists(RollingStock(1))
        ]
    )]
    #[rstest]
    #[case::rolling_stock_granted_subjects(
        rolling_stock_granted_subjects(RollingStock(1), RollingStockGrant::Writer).checks,
        &[
           Check::HasRollingStockPrivilege(Actor::Issuer, RollingStockPrivilege::CanRead, RollingStock(1)),
           Check::RollingStockExists(RollingStock(1))
        ]
    )]
    #[rstest]
    #[case::rolling_stock_list(
        rolling_stock_list(User(1), RollingStockPrivilege::CanRead).checks,
        &[
           Check::SubjectExists(Subject::user(1)),
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
