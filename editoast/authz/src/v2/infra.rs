use std::collections::HashSet;

use fga::client::QueryError;
use fga::client::UserList;
use fga::model::Relation as _;
use futures::FutureExt as _;
use itertools::Itertools as _;

use crate::Group;
use crate::Infra;
use crate::InfraGrant;
use crate::InfraPrivilege;
use crate::Role;
use crate::Subject;
use crate::User;
use crate::v2::Check;
use crate::v2::Protected;

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
    .with_check(Check::SubjectExists(subject))
    .with_check(Check::InfraExists(infra))
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
    .with_check(Check::SubjectExists(subject))
    .with_check(Check::InfraExists(infra))
    .with_check(Check::IssuerHasInfraPrivilege(InfraPrivilege::CanRead, infra))
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
    .with_check(Check::InfraExists(infra))
    .with_check(Check::SubjectExists(Subject::user(user)))
    .with_check(Check::IssuerHasInfraPrivilege(
        InfraPrivilege::CanRead,
        infra,
    ))
}

/// Return an operation that checks the list of subjects which have the given grant on an infra.
pub fn infra_granted_subjects(infra: Infra, grant: InfraGrant) -> Protected<Vec<Subject>> {
    fn get_granted_users(infra: Infra, grant: InfraGrant) -> Protected<Vec<User>> {
        Protected::new(move |openfga| {
            async move {
                match grant {
                    InfraGrant::Reader => {
                        openfga
                            .list_users(Infra::reader().query_users(&infra))
                            .await
                    }
                    InfraGrant::Writer => {
                        openfga
                            .list_users(Infra::writer().query_users(&infra))
                            .await
                    }
                    InfraGrant::Owner => {
                        openfga.list_users(Infra::owner().query_users(&infra)).await
                    }
                }
                .map(|UserList { users, .. }| users)
                .map_err(QueryError::parsing_ok)
            }
            .boxed()
        })
    }
    fn get_granted_groups(infra: Infra, grant: InfraGrant) -> Protected<Vec<Group>> {
        Protected::new(move |openfga| {
            async move {
                match grant {
                    InfraGrant::Reader => {
                        openfga
                            .list_usersets(Infra::reader().query_usersets(Group::member(), &infra))
                            .await
                    }
                    InfraGrant::Writer => {
                        openfga
                            .list_usersets(Infra::writer().query_usersets(Group::member(), &infra))
                            .await
                    }
                    InfraGrant::Owner => {
                        openfga
                            .list_usersets(Infra::owner().query_usersets(Group::member(), &infra))
                            .await
                    }
                }
                .map_err(QueryError::parsing_ok)
            }
            .boxed()
        })
    }
    get_granted_users(infra, grant)
        .zip(get_granted_groups(infra, grant))
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
        .with_check(Check::IssuerHasInfraPrivilege(
            InfraPrivilege::CanRead,
            infra,
        ))
        .with_check(Check::InfraExists(infra))
}

#[cfg(test)]
mod tests {
    use crate::v2::TestClientExt as _;
    use crate::v2::special_authorizers::Authorize;

    use super::*;

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

    #[tokio::test]
    async fn infra_granted_subjects() {
        let openfga = crate::authz_client!();
        openfga
            .prepare_writes()
            .write(&Infra::reader().tuple(&User(1), &Infra(1)))
            .write(&Infra::writer().tuple(&User(2), &Infra(1)))
            .write(&Group::member().tuple(&User(3), &Group(1)))
            .write(&Infra::writer().tuple(Group::member().userset(&Group(1)), &Infra(1)))
            .execute()
            .await
            .unwrap();
        assert_eq!(
            openfga
                .infra_granted_subjects(Infra(1), InfraGrant::Reader)
                .await,
            vec![Subject::User(User(1))]
        );
        let mut response = openfga
            .infra_granted_subjects(Infra(1), InfraGrant::Writer)
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
}
