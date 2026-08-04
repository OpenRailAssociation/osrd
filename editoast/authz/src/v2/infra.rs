use std::collections::HashSet;

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
use crate::v2::Actor;
use crate::v2::Check;
use crate::v2::Protected;
use crate::v2::ResourcesList;
use crate::v2::subject_roles;
use crate::v2::validate_direct_grant;

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
                    openfga.tuple_exists(Infra::reader().tuple(user, &infra)),
                    openfga.tuple_exists(Infra::writer().tuple(user, &infra)),
                    openfga.tuple_exists(Infra::owner().tuple(user, &infra)),
                )?,
                Subject::Group(group) => tokio::try_join!(
                    openfga.tuple_exists(
                        Infra::reader().tuple(Group::member().userset(group), &infra)
                    ),
                    openfga.tuple_exists(
                        Infra::writer().tuple(Group::member().userset(group), &infra)
                    ),
                    openfga
                        .tuple_exists(Infra::owner().tuple(Group::member().userset(group), &infra)),
                )?,
            };
            Ok(
                validate_direct_grant(is_reader, is_writer, is_owner, *infra, subject)
                    .map(Into::into),
            )
        }
        .boxed()
    })
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
    .with_check(Check::HasInfraPrivilege(
        Actor::Issuer,
        InfraPrivilege::CanRead,
        infra,
    ))
}

/// Sets the (direct) grant a subject has on an [Infra].
///
/// No transaction is setup as OpenFGA does not support them.
pub fn infra_set_grant(subject: Subject, infra: Infra, new_grant: InfraGrant) -> Protected<()> {
    let prot = infra_revoke_grant(subject, infra).map(move |openfga, _has_revoked| {
        async move {
            let mut writes = openfga.prepare_writes();
            match (subject, new_grant) {
                (Subject::User(user), InfraGrant::RestrictedReader) => {
                    writes.push(&Infra::restricted_reader().tuple(&user, &infra))
                }
                (Subject::User(user), InfraGrant::Reader) => {
                    writes.push(&Infra::reader().tuple(&user, &infra))
                }
                (Subject::User(user), InfraGrant::Writer) => {
                    writes.push(&Infra::writer().tuple(&user, &infra))
                }
                (Subject::User(user), InfraGrant::Owner) => {
                    writes.push(&Infra::owner().tuple(&user, &infra))
                }
                (Subject::Group(group), InfraGrant::RestrictedReader) => writes.push(
                    &Infra::restricted_reader().tuple(Group::member().userset(&group), &infra),
                ),
                (Subject::Group(group), InfraGrant::Reader) => {
                    writes.push(&Infra::reader().tuple(Group::member().userset(&group), &infra))
                }
                (Subject::Group(group), InfraGrant::Writer) => {
                    writes.push(&Infra::writer().tuple(Group::member().userset(&group), &infra))
                }
                (Subject::Group(group), InfraGrant::Owner) => {
                    writes.push(&Infra::owner().tuple(Group::member().userset(&group), &infra))
                }
            };
            writes.execute().await?;
            Ok(())
        }
        .boxed()
    });

    let share_privilege = match new_grant {
        InfraGrant::RestrictedReader => InfraPrivilege::CanRestrictedRead,
        InfraGrant::Reader => InfraPrivilege::CanShareRead,
        InfraGrant::Writer => InfraPrivilege::CanShareWrite,
        InfraGrant::Owner => InfraPrivilege::CanShareOwnership,
    };

    // Set grant rules:
    // 1. Issuer must have the correct sharing privilege [HasInfraPrivilege]
    // 2. Issuer is admin (may not have any direct grant on the resource)
    //     1. *can* demote the last owner [Authorizer admin bypass]
    //     2. can demote or promote anyone to any grant level otherwise [Authorizer admin bypass]
    //     3. can demote or promote any group [Authorizer admin bypass]
    // 3. Issuer is owner
    //     1. cannot demote the last owner (including self) [IsNotLastInfraOwner]
    //     2. cannot demote another owner [CanAlterSubjectInfraGrant]
    //     3. can demote or promote anyone to any grant level otherwise [CanAlterSubjectInfraGrant]
    //     4. **cannot** demote or promote any group [CanAlterSubjectInfraGrant]
    // 4. Issuer is anything else
    //     1. can demote self [HasInfraPrivilege]
    //     2. cannot promote self [HasInfraPrivilege]
    //     3. can promote anyone up to their own grant level [CanAlterSubjectInfraGrant + HasInfraPrivilege]
    //     4. can demote anyone with a strictly lower grant level than their own [CanAlterSubjectInfraGrant]
    //     5. **cannot** demote or promote any group [CanAlterSubjectInfraGrant]
    let prot = prot
        .reset_checks() // get rid of revoking-specific checks
        .with_check(Check::HasInfraPrivilege(
            Actor::Issuer,
            share_privilege,
            infra,
        ))
        .with_check(Check::CanAlterSubjectInfraGrant(subject, infra, new_grant));

    if new_grant != InfraGrant::Owner {
        prot.with_check(Check::IsNotLastInfraOwner(subject, infra))
    } else {
        prot
    }
}

/// Revokes the (direct) grant a subject has on an [Infra], if any
///
/// Returns `true` if a grant was revoked, `false` otherwise, making the operation idempotent.
/// No transaction is setup as OpenFGA does not support them.
pub fn infra_revoke_grant(subject: Subject, infra: Infra) -> Protected<bool> {
    let prot = infra_direct_grant(subject, infra).map(move |openfga, grant| {
        async move {
            let Some(grant) = grant else {
                return Ok(false);
            };

            let mut delete = openfga.prepare_deletes();
            match (subject, grant) {
                (Subject::User(user), InfraGrant::RestrictedReader) => {
                    delete.push(&Infra::restricted_reader().tuple(&user, &infra))
                }
                (Subject::User(user), InfraGrant::Reader) => {
                    delete.push(&Infra::reader().tuple(&user, &infra))
                }
                (Subject::User(user), InfraGrant::Writer) => {
                    delete.push(&Infra::writer().tuple(&user, &infra))
                }
                (Subject::User(user), InfraGrant::Owner) => {
                    delete.push(&Infra::owner().tuple(&user, &infra))
                }
                (Subject::Group(group), InfraGrant::RestrictedReader) => delete.push(
                    &Infra::restricted_reader().tuple(Group::member().userset(&group), &infra),
                ),
                (Subject::Group(group), InfraGrant::Reader) => {
                    delete.push(&Infra::reader().tuple(Group::member().userset(&group), &infra))
                }
                (Subject::Group(group), InfraGrant::Writer) => {
                    delete.push(&Infra::writer().tuple(Group::member().userset(&group), &infra))
                }
                (Subject::Group(group), InfraGrant::Owner) => {
                    delete.push(&Infra::owner().tuple(Group::member().userset(&group), &infra))
                }
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
    prot.with_check(Check::HasInfraPrivilege(
        Actor::Issuer,
        InfraPrivilege::CanRevoke,
        infra,
    ))
    .with_check(Check::SubjectEffectiveInfraGrantIsNot(
        InfraGrant::Owner,
        subject,
        infra,
    ))
    .with_check(Check::IsNotLastInfraOwner(subject, infra))
}

pub fn infra_privileges(user: User, infra: Infra) -> Protected<HashSet<InfraPrivilege>> {
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
                can_share_ownership,
                can_revoke,
            ) = openfga
                .checks((
                    User::role().check(&Role::Admin, &user),
                    Infra::can_restricted_read().check(&user, &infra),
                    Infra::can_read().check(&user, &infra),
                    Infra::can_share_read().check(&user, &infra),
                    Infra::can_write().check(&user, &infra),
                    Infra::can_share_write().check(&user, &infra),
                    Infra::can_delete().check(&user, &infra),
                    Infra::can_share_ownership().check(&user, &infra),
                    Infra::can_revoke().check(&user, &infra),
                ))
                .await?;
            let mut privileges = HashSet::new();
            privileges.extend(
                (admin || can_restricted_read).then_some(InfraPrivilege::CanRestrictedRead),
            );
            privileges.extend((admin || can_read).then_some(InfraPrivilege::CanRead));
            privileges.extend((admin || can_share_read).then_some(InfraPrivilege::CanShareRead));
            privileges.extend((admin || can_write).then_some(InfraPrivilege::CanWrite));
            privileges.extend((admin || can_share_write).then_some(InfraPrivilege::CanShareWrite));
            privileges.extend((admin || can_delete).then_some(InfraPrivilege::CanDelete));
            privileges.extend(
                (admin || can_share_ownership).then_some(InfraPrivilege::CanShareOwnership),
            );
            privileges.extend((admin || can_revoke).then_some(InfraPrivilege::CanRevoke));
            Ok(privileges)
        }
        .boxed()
    })
    .with_check(Check::HasInfraPrivilege(
        Actor::Issuer,
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
                    InfraGrant::RestrictedReader => {
                        openfga
                            .list_users(Infra::restricted_reader().query_users(&infra))
                            .await
                    }
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
            }
            .boxed()
        })
    }
    fn get_granted_groups(infra: Infra, grant: InfraGrant) -> Protected<Vec<Group>> {
        Protected::new(move |openfga| {
            async move {
                match grant {
                    InfraGrant::RestrictedReader => {
                        openfga
                            .list_usersets(
                                Infra::restricted_reader().query_usersets(Group::member(), &infra),
                            )
                            .await
                    }
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
        .with_check(Check::HasInfraPrivilege(
            Actor::Issuer,
            InfraPrivilege::CanRead,
            infra,
        ))
}

pub fn infra_list(user: User, privilege: InfraPrivilege) -> Protected<ResourcesList<Infra>> {
    subject_roles(Subject::user(user)).map(move |openfga, roles| {
        async move {
            if roles.contains(&Role::Admin) {
                return Ok(ResourcesList::All);
            }
            let authorized_infras = match privilege {
                InfraPrivilege::CanRestrictedRead => {
                    openfga
                        .list_objects(Infra::can_restricted_read().query_objects(&user))
                        .await?
                }
                InfraPrivilege::CanRead => {
                    openfga
                        .list_objects(Infra::can_read().query_objects(&user))
                        .await?
                }
                InfraPrivilege::CanShareRead => {
                    openfga
                        .list_objects(Infra::can_share_read().query_objects(&user))
                        .await?
                }
                InfraPrivilege::CanWrite => {
                    openfga
                        .list_objects(Infra::can_write().query_objects(&user))
                        .await?
                }
                InfraPrivilege::CanShareWrite => {
                    openfga
                        .list_objects(Infra::can_share_write().query_objects(&user))
                        .await?
                }
                InfraPrivilege::CanDelete => {
                    openfga
                        .list_objects(Infra::can_delete().query_objects(&user))
                        .await?
                }
                InfraPrivilege::CanShareOwnership => {
                    openfga
                        .list_objects(Infra::can_share_ownership().query_objects(&user))
                        .await?
                }
                InfraPrivilege::CanRevoke => {
                    openfga
                        .list_objects(Infra::can_revoke().query_objects(&user))
                        .await?
                }
            };
            Ok(ResourcesList::Privileged(authorized_infras))
        }
        .boxed()
    })
}

#[cfg(test)]
mod tests {
    use rstest::rstest;

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

        let infra_grant = async |user_id: i64| {
            openfga
                .infra_direct_grant(Subject::user(user_id), Infra(1))
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

        let infra_grant = async |group_id: i64| {
            openfga
                .infra_direct_grant(Subject::group(group_id), Infra(1))
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
            openfga
                .infra_direct_grant(Subject::user(user_id), Infra(1))
                .await
        };

        let group_direct_grant = async |group_id: i64| {
            openfga
                .infra_direct_grant(Subject::group(group_id), Infra(1))
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

        openfga
            .prepare_writes()
            .write(&Infra::reader().tuple(&User(1), &Infra(1)))
            .write(&Infra::writer().tuple(&User(1), &Infra(1)))
            .execute()
            .await
            .unwrap();

        openfga.infra_direct_grant(Subject::user(1), Infra(1)).await;
    }

    #[rstest::rstest]
    #[case::user_reader(Subject::user(1), InfraGrant::Reader)]
    #[case::user_writer(Subject::user(1), InfraGrant::Writer)]
    #[case::user_owner(Subject::user(1), InfraGrant::Owner)]
    #[case::group_reader(Subject::group(1), InfraGrant::Reader)]
    #[case::group_writer(Subject::group(1), InfraGrant::Writer)]
    #[case::group_owner(Subject::group(1), InfraGrant::Owner)]
    #[tokio::test]
    async fn infra_set_grant_ok(#[case] subject: Subject, #[case] grant: InfraGrant) {
        let openfga = crate::authz_client!();
        openfga.infra_set_grant(subject, Infra(1), grant).await;
        assert_eq!(
            openfga.infra_direct_grant(subject, Infra(1)).await,
            Some(grant)
        );
    }

    #[tokio::test]
    async fn infra_set_grant_replaces_existing_direct_grant() {
        let openfga = crate::authz_client!();

        openfga
            .infra_set_grant(Subject::user(1), Infra(1), InfraGrant::Reader)
            .await;
        assert_eq!(
            openfga.infra_direct_grant(Subject::user(1), Infra(1)).await,
            Some(InfraGrant::Reader)
        );

        openfga
            .infra_set_grant(Subject::user(1), Infra(1), InfraGrant::Writer)
            .await;
        assert_eq!(
            openfga.infra_direct_grant(Subject::user(1), Infra(1)).await,
            Some(InfraGrant::Writer)
        );
    }

    #[tokio::test]
    async fn infra_set_grant_preserves_inherited() {
        let openfga = crate::authz_client!();

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(10)))
            .write(&Infra::writer().tuple(Group::member().userset(&Group(10)), &Infra(1))) // inherited
            .write(&Infra::reader().tuple(&User(1), &Infra(1))) // direct
            .write(&Infra::owner().tuple(&User(1), &Infra(2))) // unrelated
            .execute()
            .await
            .unwrap();

        openfga
            .infra_set_grant(Subject::user(1), Infra(1), InfraGrant::Writer)
            .await;

        assert_eq!(
            openfga.infra_direct_grant(Subject::user(1), Infra(1)).await,
            Some(InfraGrant::Writer)
        );
        assert_eq!(
            openfga
                .infra_direct_grant(Subject::group(10), Infra(1))
                .await,
            Some(InfraGrant::Writer)
        );
        assert_eq!(
            openfga.infra_direct_grant(Subject::user(1), Infra(2)).await,
            Some(InfraGrant::Owner)
        );
    }

    #[rstest::rstest]
    #[case::user_reader(Subject::user(1), InfraGrant::Reader)]
    #[case::user_writer(Subject::user(1), InfraGrant::Writer)]
    #[case::user_owner(Subject::user(1), InfraGrant::Owner)]
    #[case::group_reader(Subject::group(1), InfraGrant::Reader)]
    #[case::group_writer(Subject::group(1), InfraGrant::Writer)]
    #[case::group_owner(Subject::group(1), InfraGrant::Owner)]
    #[tokio::test]
    async fn revoke_infra_grant_ok(#[case] subject: Subject, #[case] grant: InfraGrant) {
        let openfga = crate::authz_client!();
        openfga.infra_set_grant(subject, Infra(1), grant).await;
        assert_eq!(
            openfga.infra_direct_grant(subject, Infra(1)).await,
            Some(grant)
        );
        assert!(openfga.infra_revoke_grant(subject, Infra(1)).await);
        assert_eq!(openfga.infra_direct_grant(subject, Infra(1)).await, None);
    }

    #[tokio::test]
    async fn revoke_infra_grant_noop() {
        let openfga = crate::authz_client!();
        assert!(!openfga.infra_revoke_grant(Subject::user(1), Infra(1)).await);
    }

    #[tokio::test]
    async fn revoke_infra_grant_with_inherited() {
        let openfga = crate::authz_client!();

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(10)))
            .write(&Infra::writer().tuple(Group::member().userset(&Group(10)), &Infra(1))) // inherited
            .write(&Infra::reader().tuple(&User(1), &Infra(1))) // direct
            .write(&Infra::owner().tuple(&User(1), &Infra(2))) // unrelated
            .execute()
            .await
            .unwrap();

        assert_eq!(
            openfga.infra_direct_grant(Subject::user(1), Infra(1)).await,
            Some(InfraGrant::Reader)
        );
        assert!(openfga.infra_revoke_grant(Subject::user(1), Infra(1)).await);
        assert_eq!(
            openfga.infra_direct_grant(Subject::user(1), Infra(1)).await,
            None
        );
        assert_eq!(
            openfga
                .infra_effective_grant(Subject::user(1), Infra(1))
                .await,
            Some(InfraGrant::Writer)
        );
        assert_eq!(
            openfga.infra_direct_grant(Subject::user(1), Infra(2)).await,
            Some(InfraGrant::Owner)
        );
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
                InfraPrivilege::CanRestrictedRead,
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
                InfraPrivilege::CanRestrictedRead,
                InfraPrivilege::CanRead,
                InfraPrivilege::CanShareRead,
                InfraPrivilege::CanWrite,
                InfraPrivilege::CanShareWrite,
                InfraPrivilege::CanDelete,
                InfraPrivilege::CanShareOwnership,
                InfraPrivilege::CanRevoke,
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
    async fn infra_granted_subjects_direct_and_indirect() {
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

    #[tokio::test]
    async fn infra_list_direct_inherited_and_admin_bypass() {
        let openfga = crate::authz_client!();
        openfga
            .prepare_writes()
            .write(&Infra::reader().tuple(&User(1), &Infra(1)))
            .write(&Infra::reader().tuple(&User(1), &Infra(3)))
            .write(&Infra::writer().tuple(&User(2), &Infra(2)))
            .write(&User::role().tuple(&Role::Admin, &User(3)))
            .execute()
            .await
            .unwrap();
        let infras_1 = openfga
            .infra_list(User(1), InfraPrivilege::CanRead)
            .await
            .unwrap_privileged()
            .into_iter();
        let infras_2 = openfga
            .infra_list(User(2), InfraPrivilege::CanRead)
            .await
            .unwrap_privileged()
            .into_iter();
        let infras_no_rights = openfga
            .infra_list(User(4), InfraPrivilege::CanRead)
            .await
            .unwrap_privileged();
        let infras_admin = openfga.infra_list(User(3), InfraPrivilege::CanRead).await;
        assert_eq!(infras_1.sorted().collect_vec(), vec![Infra(1), Infra(3)]);
        assert_eq!(infras_2.sorted().collect_vec(), vec![Infra(2)]);
        assert_eq!(infras_no_rights, vec![]);
        assert!(matches!(infras_admin, ResourcesList::All));
    }

    #[tokio::test]
    async fn infra_list_different_privileges() {
        let openfga = crate::authz_client!();
        openfga
            .prepare_writes()
            .write(&Infra::reader().tuple(&User(1), &Infra(1)))
            .write(&Infra::writer().tuple(&User(2), &Infra(1)))
            .execute()
            .await
            .unwrap();
        let infras_read_user_1 = openfga.infra_list(User(1), InfraPrivilege::CanRead).await;
        let infras_read_user_2 = openfga.infra_list(User(2), InfraPrivilege::CanRead).await;
        let infras_write_user_1 = openfga.infra_list(User(1), InfraPrivilege::CanWrite).await;
        let infras_write_user_2 = openfga.infra_list(User(2), InfraPrivilege::CanWrite).await;
        let (infras_1, infras_2) = (
            infras_read_user_1.unwrap_privileged(),
            infras_read_user_2.unwrap_privileged(),
        );
        // Both users should have the infra listed as readable
        assert_eq!(infras_1, vec![Infra(1)]);
        assert_eq!(infras_2, vec![Infra(1)]);
        let (infras_1, infras_2) = (
            infras_write_user_1.unwrap_privileged(),
            infras_write_user_2.unwrap_privileged(),
        );
        // Only user_2 with reader grant should see the infra as being writable
        assert_eq!(infras_1, vec![]);
        assert_eq!(infras_2, vec![Infra(1)]);
    }

    #[rstest]
    #[case::infra_direct_grant(infra_direct_grant(Subject::user(1), Infra(1)).checks, &[])]
    #[case::infra_effective_grant(
        infra_effective_grant(Subject::user(1), Infra(1)).checks,
        &[Check::HasInfraPrivilege(Actor::Issuer, InfraPrivilege::CanRead, Infra(1))]
    )]
    #[case::infra_revoke_grant(
        infra_revoke_grant(Subject::user(1), Infra(1)).checks,
        &[
            Check::HasInfraPrivilege(Actor::Issuer, InfraPrivilege::CanRevoke, Infra(1)),
            Check::IsNotLastInfraOwner(Subject::user(1), Infra(1)),
            Check::SubjectEffectiveInfraGrantIsNot(InfraGrant::Owner, Subject::user(1), Infra(1))
        ]
    )]
    #[case::infra_privileges(
        infra_privileges(User(1), Infra(1)).checks,
        &[Check::HasInfraPrivilege(Actor::Issuer, InfraPrivilege::CanRead, Infra(1))]
    )]
    #[case::infra_privileges(
        infra_granted_subjects(Infra(1), InfraGrant::Owner).checks,
        &[Check::HasInfraPrivilege(Actor::Issuer, InfraPrivilege::CanRead, Infra(1))]
    )]
    #[case::infra_list(infra_list(User(1), InfraPrivilege::CanRead).checks, &[])]
    fn protected_contains_expected_checks(
        #[case] protected_checks: HashSet<Check>,
        #[case] expected_checks: &[Check],
    ) {
        // Make sure that each public protected op contains its expected list of checks
        let expected_checks = expected_checks.iter().copied().collect::<HashSet<_>>();
        assert_eq!(expected_checks, protected_checks);
    }
}
