use std::collections::HashSet;

use fga::model::Relation as _;
use futures::FutureExt as _;

use crate::Group;
use crate::Role;
use crate::Subject;
use crate::User;
use crate::v2::Actor;
use crate::v2::Check;
use crate::v2::Protected;

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
}

/// Gives the subject the specified roles
///
/// Idempotent but not atomic due to the lack of transactions in OpenFGA.
pub fn add_roles(subject: Subject, roles: HashSet<Role>) -> Protected<()> {
    subject_roles(subject)
        .then(move |openfga, existing_roles| {
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
        .with_check(Check::HasRole(Actor::Issuer, Role::Admin))
}

/// Removes the specified roles from the subject
///
/// Idempotent but not atomic due to the lack of transactions in OpenFGA.
pub fn remove_roles(subject: Subject, roles: HashSet<Role>) -> Protected<()> {
    subject_roles(subject)
        .then(move |openfga, existing_roles| {
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
        .with_check(Check::HasRole(Actor::Issuer, Role::Admin))
}

#[cfg(test)]
mod tests {
    use rstest::rstest;

    use crate::v2::TestClientExt as _;

    use super::*;

    #[tokio::test]
    async fn add_roles_idempotent() {
        let openfga = crate::authz_client!();

        openfga
            .add_roles(
                Subject::user(1),
                HashSet::from_iter([Role::Admin, Role::Stdcm]),
            )
            .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );

        openfga
            .add_roles(
                Subject::user(1),
                HashSet::from_iter([Role::Admin, Role::Stdcm]),
            )
            .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );
    }

    #[tokio::test]
    async fn add_roles_intersecting_calls() {
        let openfga = crate::authz_client!();

        openfga
            .add_roles(
                Subject::user(1),
                HashSet::from_iter([Role::Admin, Role::Stdcm]),
            )
            .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );

        openfga
            .add_roles(
                Subject::user(1),
                HashSet::from_iter([Role::Admin, Role::OperationalStudies]),
            )
            .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm, Role::OperationalStudies])
        );
    }

    #[tokio::test]
    async fn remove_roles_idempotent() {
        let openfga = crate::authz_client!();

        openfga
            .add_roles(
                Subject::user(1),
                HashSet::from_iter([Role::Admin, Role::Stdcm]),
            )
            .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );

        openfga
            .remove_roles(
                Subject::user(1),
                HashSet::from_iter([Role::Admin, Role::Stdcm]),
            )
            .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([])
        );

        openfga
            .remove_roles(
                Subject::user(1),
                HashSet::from_iter([Role::Admin, Role::Stdcm]),
            )
            .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([])
        );
    }

    #[tokio::test]
    async fn remove_roles_intersecting_calls() {
        let openfga = crate::authz_client!();

        openfga
            .add_roles(
                Subject::user(1),
                HashSet::from_iter([Role::Admin, Role::Stdcm, Role::OperationalStudies]),
            )
            .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm, Role::OperationalStudies])
        );

        openfga
            .remove_roles(
                Subject::user(1),
                HashSet::from_iter([Role::Admin, Role::Stdcm]),
            )
            .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::OperationalStudies])
        );

        openfga
            .remove_roles(
                Subject::user(1),
                HashSet::from_iter([Role::Admin, Role::OperationalStudies]),
            )
            .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([])
        );
    }

    #[tokio::test]
    async fn inherited_roles_from_group() {
        let openfga = crate::authz_client!();

        // 1: Admin
        // 2: nothing
        // 10: Stdcm w/ 1 & 2
        openfga
            .add_roles(Subject::user(1), HashSet::from_iter([Role::Admin]))
            .await;
        openfga
            .add_roles(Subject::group(10), HashSet::from_iter([Role::Stdcm]))
            .await;
        openfga
            .add_members(Group(10), HashSet::from_iter([User(1), User(2)]))
            .await;

        assert_eq!(
            openfga.subject_roles(&Subject::group(10)).await,
            HashSet::from_iter([Role::Stdcm])
        );
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );
        assert_eq!(
            openfga.subject_roles(&Subject::user(2)).await,
            HashSet::from_iter([Role::Stdcm])
        );

        // 11: OperationalStudies w/ 2
        openfga
            .add_roles(
                Subject::group(11),
                HashSet::from_iter([Role::OperationalStudies]),
            )
            .await;
        openfga
            .add_members(Group(11), HashSet::from_iter([User(2)]))
            .await;

        assert_eq!(
            openfga.subject_roles(&Subject::group(10)).await,
            HashSet::from_iter([Role::Stdcm])
        );
        assert_eq!(
            openfga.subject_roles(&Subject::group(11)).await,
            HashSet::from_iter([Role::OperationalStudies])
        );
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );
        assert_eq!(
            openfga.subject_roles(&Subject::user(2)).await,
            HashSet::from_iter([Role::Stdcm, Role::OperationalStudies])
        );

        // 11: nothing w/ 2
        openfga
            .remove_roles(
                Subject::group(11),
                HashSet::from_iter([Role::OperationalStudies]),
            )
            .await;

        assert_eq!(
            openfga.subject_roles(&Subject::group(10)).await,
            HashSet::from_iter([Role::Stdcm])
        );
        assert_eq!(
            openfga.subject_roles(&Subject::group(11)).await,
            HashSet::new()
        );
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );
        assert_eq!(
            openfga.subject_roles(&Subject::user(2)).await,
            HashSet::from_iter([Role::Stdcm])
        );
    }

    #[rstest]
    #[case::subject_roles(subject_roles(Subject::user(1)).checks, &[])]
    #[case::add_roles(
        add_roles(Subject::user(1), HashSet::from([Role::Admin, Role::Stdcm])).checks,
        &[Check::HasRole(Actor::Issuer, Role::Admin)]
    )]
    #[case::remove_roles(
        remove_roles(Subject::user(1), HashSet::from([Role::Admin, Role::Stdcm])).checks,
        &[Check::HasRole(Actor::Issuer, Role::Admin)]
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
