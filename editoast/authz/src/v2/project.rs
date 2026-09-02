use std::collections::HashSet;

use fga::client::UserList;
use fga::model::Relation as _;
use futures::FutureExt;

use crate::Group;
use crate::ProjectPrivilege;
use crate::Role;
use crate::Subject;
use crate::User;
use crate::model::Project;
use crate::model::ProjectGrant;
use crate::v2::Actor;
use crate::v2::Check;
use crate::v2::Protected;
use crate::v2::ResourcesList;
use crate::v2::subject_roles;

/// Returns the *direct grant* a subject has for a [Project].
///
/// A user can have *indirect grants* on a resource through group membership.
/// For those, use [`project_effective_grant`].
pub fn project_direct_grant(subject: Subject, project: Project) -> Protected<Option<ProjectGrant>> {
    Protected::new(move |openfga| {
        async move {
            let is_owner = match &subject {
                Subject::User(user) => {
                    openfga
                        .tuple_exists(Project::owner().tuple(user, &project))
                        .await?
                }
                Subject::Group(group) => {
                    openfga
                        .tuple_exists(
                            Project::owner().tuple(Group::member().userset(group), &project),
                        )
                        .await?
                }
            };

            Ok(is_owner.then_some(ProjectGrant::Owner))
        }
        .boxed()
    })
}

/// Returns the effective grant a subject has on an [Project]
///
/// For direct grants, see [`project_direct_grant`].
pub fn project_effective_grant(
    subject: Subject,
    project: Project,
) -> Protected<Option<ProjectGrant>> {
    Protected::new(move |openfga| {
        async move {
            let is_owner = match subject {
                Subject::User(user) => openfga.check(Project::owner().check(&user, &project)).await,
                Subject::Group(group) => {
                    openfga
                        .check(Project::owner().check(Group::member().userset(&group), &project))
                        .await
                }
            }?;

            Ok(is_owner.then_some(ProjectGrant::Owner))
        }
        .boxed()
    })
}

pub fn project_set_grant(subject: Subject, project: Project) -> Protected<()> {
    project_direct_grant(subject, project)
        .then(move |openfga, grant| {
            async move {
                // Projects only have one grant level, the subject either has it or doesn't
                let update = match grant {
                    Some(ProjectGrant::Owner) => false,
                    None => true,
                };

                if !update {
                    return Ok(());
                }

                match subject {
                    Subject::User(user) => {
                        openfga
                            .write_tuples(&[Project::owner().tuple(&user, &project)])
                            .await
                    }
                    Subject::Group(group) => {
                        openfga
                            .write_tuples(&[
                                Project::owner().tuple(Group::member().userset(&group), &project)
                            ])
                            .await
                    }
                }?;

                Ok(())
            }
            .boxed()
        })
        .with_check(Check::CanGiveSubjectProjectGrant(subject, project))
}

/// Revokes the (direct) grant a subject has on an [Project], if any
///
/// Returns `true` if a grant was revoked, `false` otherwise, making the operation idempotent.
/// No transaction is setup as OpenFGA does not support them.
pub fn project_revoke_grant(subject: Subject, project: Project) -> Protected<bool> {
    // Revoking rules:
    // Only admins can fully revoke grants
    project_direct_grant(subject, project)
        .then(move |openfga, grant| {
            async move {
                let Some(grant) = grant else {
                    return Ok(false);
                };

                let mut delete = openfga.prepare_deletes();
                match (subject, grant) {
                    (Subject::User(user), ProjectGrant::Owner) => {
                        delete.push(&Project::owner().tuple(&user, &project))
                    }
                    (Subject::Group(group), ProjectGrant::Owner) => delete
                        .push(&Project::owner().tuple(Group::member().userset(&group), &project)),
                };
                delete.execute().await?;
                Ok(true)
            }
            .boxed()
        })
        .with_check(Check::HasRole(Actor::Issuer, Role::Admin))
}

pub fn project_privileges(user: User, project: Project) -> Protected<HashSet<ProjectPrivilege>> {
    Protected::new(move |openfga| {
        async move {
            let (admin, has_access) = openfga
                .checks((
                    User::role().check(&Role::Admin, &user),
                    Project::has_access().check(&user, &project),
                ))
                .await?;

            let privilege_set = if admin || has_access {
                HashSet::from([ProjectPrivilege::HasAccess])
            } else {
                Default::default()
            };
            Ok(privilege_set)
        }
        .boxed()
    })
    .with_check(Check::HasProjectPrivilege(
        Actor::Issuer,
        ProjectPrivilege::HasAccess,
        project,
    ))
}

/// Lists all the projects a user has access to
pub fn project_list(user: User) -> Protected<ResourcesList<Project>> {
    subject_roles(Subject::user(user)).then(move |openfga, roles| {
        async move {
            if roles.contains(&Role::Admin) {
                return Ok(ResourcesList::All);
            }

            let authorized_projects = openfga
                .list_objects(Project::has_access().query_objects(&user))
                .await?;
            Ok(ResourcesList::Privileged(authorized_projects))
        }
        .boxed()
    })
}

/// Return an operation that checks the list of subjects which have the owner grant on a project.
pub fn project_granted_subjects(project: Project) -> Protected<Vec<Subject>> {
    fn get_granted_users(project: Project) -> Protected<Vec<User>> {
        Protected::new(move |openfga| {
            async move {
                openfga
                    .list_users(Project::owner().query_users(&project))
                    .await
                    .map(|UserList { users, .. }| users)
            }
            .boxed()
        })
    }
    fn get_granted_groups(project: Project) -> Protected<Vec<Group>> {
        Protected::new(move |openfga| {
            async move {
                openfga
                    .list_usersets(Project::owner().query_usersets(Group::member(), &project))
                    .await
            }
            .boxed()
        })
    }
    get_granted_users(project)
        .zip(get_granted_groups(project))
        .map(async move |(users, groups)| {
            users
                .into_iter()
                .map(Subject::User)
                .chain(groups.into_iter().map(Subject::Group))
                .collect()
        })
        .with_check(Check::HasProjectPrivilege(
            Actor::Issuer,
            ProjectPrivilege::HasAccess,
            project,
        ))
}

#[cfg(test)]
mod tests {
    use fga::Client;
    use std::collections::HashSet;

    use crate::User;
    use crate::authz_client;
    use crate::model::Project;
    use crate::v2::Check;
    use crate::v2::TestClientExt;

    use super::*;

    async fn user_direct_grant(openfga: &Client, user_id: i64) -> Option<ProjectGrant> {
        openfga
            .project_direct_grant(Subject::user(user_id), Project(1))
            .await
    }

    async fn group_direct_grant(openfga: &Client, group_id: i64) -> Option<ProjectGrant> {
        openfga
            .project_direct_grant(Subject::group(group_id), Project(1))
            .await
    }

    #[tokio::test]
    async fn user_project_direct_grant() {
        let openfga = authz_client!();

        assert_eq!(user_direct_grant(&openfga, 1).await, None);

        openfga
            .prepare_writes()
            .write(&Project::owner().tuple(&User(1), &Project(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(
            user_direct_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
    }

    #[tokio::test]
    async fn group_project_direct_grant() {
        let openfga = authz_client!();

        assert_eq!(group_direct_grant(&openfga, 1).await, None);

        openfga
            .prepare_writes()
            .write(&Project::owner().tuple(Group::member().userset(&Group(1)), &Project(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(
            group_direct_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
    }

    #[tokio::test]
    // Verify that there is no inheritance of direct grant between an user and a group
    async fn no_inference_project_direct_grant() {
        let openfga = authz_client!();

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(1)))
            .write(&Project::owner().tuple(Group::member().userset(&Group(1)), &Project(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(user_direct_grant(&openfga, 1).await, None);
        assert_eq!(
            group_direct_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
    }

    #[tokio::test]
    // Verify for an user that direct grant implies effective grant
    async fn user_project_effective_grant_direct() {
        let openfga = authz_client!();

        assert_eq!(user_direct_grant(&openfga, 1).await, None);

        openfga
            .prepare_writes()
            .write(&Project::owner().tuple(&User(1), &Project(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(
            user_direct_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
    }

    async fn user_effective_grant(openfga: &Client, user_id: i64) -> Option<ProjectGrant> {
        openfga
            .project_effective_grant(Subject::user(user_id), Project(1))
            .await
    }

    async fn group_effective_grant(openfga: &Client, group_id: i64) -> Option<ProjectGrant> {
        openfga
            .project_effective_grant(Subject::group(group_id), Project(1))
            .await
    }

    #[tokio::test]
    // Effective grants inherited from a group only apply to the members of that group
    async fn project_effective_grant_inherited() {
        let openfga = authz_client!();

        assert_eq!(user_effective_grant(&openfga, 1).await, None);
        assert_eq!(user_effective_grant(&openfga, 2).await, None);
        assert_eq!(group_effective_grant(&openfga, 1).await, None);

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(1)))
            .write(&Project::owner().tuple(Group::member().userset(&Group(1)), &Project(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(
            user_effective_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
        assert_eq!(user_effective_grant(&openfga, 2).await, None);
        assert_eq!(
            group_effective_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
    }

    #[tokio::test]
    // Verify for a group that effective grant implies direct grant
    // and that all users of the group users inherit its grant
    async fn no_inference_project_effective_grant() {
        let openfga = authz_client!();

        assert_eq!(user_effective_grant(&openfga, 1).await, None);
        assert_eq!(group_effective_grant(&openfga, 1).await, None);

        assert_eq!(user_effective_grant(&openfga, 2).await, None);
        assert_eq!(group_effective_grant(&openfga, 2).await, None);

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(1)))
            .write(&Group::member().tuple(&User(2), &Group(2)))
            .write(&Project::owner().tuple(&User(1), &Project(1)))
            .write(&Project::owner().tuple(Group::member().userset(&Group(2)), &Project(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(
            user_effective_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
        assert_eq!(group_effective_grant(&openfga, 1).await, None);

        assert_eq!(
            user_effective_grant(&openfga, 2).await,
            Some(ProjectGrant::Owner)
        );
        assert_eq!(
            group_effective_grant(&openfga, 2).await,
            Some(ProjectGrant::Owner)
        );
    }

    async fn user_revoke_grant(openfga: &Client, user_id: i64) -> bool {
        openfga
            .project_revoke_grant(Subject::user(user_id), Project(1))
            .await
    }

    async fn group_revoke_grant(openfga: &Client, group_id: i64) -> bool {
        openfga
            .project_revoke_grant(Subject::group(group_id), Project(1))
            .await
    }

    #[tokio::test]
    // Revoking a non-existent project grant should fail
    async fn project_revoke_no_op() {
        let openfga = authz_client!();
        assert!(!user_revoke_grant(&openfga, 1).await);
        assert!(!group_revoke_grant(&openfga, 1).await);
    }

    // TODO
    // Refactorize the two following tests using `rstest` when `project_set_grant` is done
    #[tokio::test]
    async fn project_revoke_grant_user_ok() {
        let openfga = authz_client!();

        assert_eq!(user_direct_grant(&openfga, 1).await, None);

        openfga
            .write_tuples(&[Project::owner().tuple(&User(1), &Project(1))])
            .await
            .unwrap();

        assert_eq!(
            user_direct_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
        assert!(user_revoke_grant(&openfga, 1).await);
        assert_eq!(user_direct_grant(&openfga, 1).await, None);
    }

    #[tokio::test]
    async fn project_revoke_grant_group_ok() {
        let openfga = authz_client!();

        assert_eq!(group_direct_grant(&openfga, 1).await, None);

        openfga
            .write_tuples(
                &[Project::owner().tuple(Group::member().userset(&Group(1)), &Project(1))],
            )
            .await
            .unwrap();

        assert_eq!(
            group_direct_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
        assert!(group_revoke_grant(&openfga, 1).await);
        assert_eq!(group_direct_grant(&openfga, 1).await, None);
    }

    #[tokio::test]
    // The inherited grants of a user on a project are not affected by revoking that user direct grants on the project
    async fn project_revoke_grant_keep_effective() {
        let openfga = authz_client!();

        assert_eq!(user_direct_grant(&openfga, 1).await, None);
        assert_eq!(group_direct_grant(&openfga, 1).await, None);

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(1)))
            .write(&Project::owner().tuple(&User(1), &Project(1)))
            .write(&Project::owner().tuple(Group::member().userset(&Group(1)), &Project(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(
            user_effective_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
        assert_eq!(
            group_effective_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );

        assert!(user_revoke_grant(&openfga, 1).await);

        assert_eq!(
            user_effective_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
        assert_eq!(
            group_effective_grant(&openfga, 1).await,
            Some(ProjectGrant::Owner)
        );
    }

    #[rstest::rstest]
    #[case(Subject::user(1))]
    #[case(Subject::group(1))]
    #[tokio::test]
    async fn project_set_grant_ok(#[case] subject: Subject) {
        let openfga = authz_client!();

        assert_eq!(
            openfga.project_direct_grant(subject, Project(1)).await,
            None
        );
        openfga.project_set_grant(subject, Project(1)).await;
        assert_eq!(
            openfga.project_direct_grant(subject, Project(1)).await,
            Some(ProjectGrant::Owner)
        );
    }

    #[rstest::rstest]
    #[case(Subject::user(1))]
    #[case(Subject::group(1))]
    #[tokio::test]
    async fn project_set_grant_idempotent(#[case] subject: Subject) {
        let openfga = authz_client!();

        assert_eq!(
            openfga.project_direct_grant(subject, Project(1)).await,
            None
        );

        openfga.project_set_grant(subject, Project(1)).await;

        assert_eq!(
            openfga.project_direct_grant(subject, Project(1)).await,
            Some(ProjectGrant::Owner)
        );
    }

    #[tokio::test]
    async fn project_privileges_non_admin() {
        let openfga = authz_client!();
        let subject = Subject::user(1);

        assert_eq!(
            openfga.project_direct_grant(subject, Project(1)).await,
            None
        );
        openfga.project_set_grant(subject, Project(1)).await;
        assert_eq!(
            openfga.project_privileges(User(1), Project(1)).await,
            HashSet::from_iter([ProjectPrivilege::HasAccess])
        )
    }

    #[tokio::test]
    async fn project_privileges_admin() {
        let openfga = authz_client!();

        assert_eq!(
            openfga
                .project_direct_grant(Subject::user(1), Project(1))
                .await,
            None
        );
        openfga
            .write_tuples(&[User::role().tuple(&Role::Admin, &User(1))])
            .await
            .unwrap();
        assert_eq!(
            openfga.project_privileges(User(1), Project(1)).await,
            HashSet::from_iter([ProjectPrivilege::HasAccess])
        )
    }

    #[tokio::test]
    async fn no_project_privileges() {
        let openfga = authz_client!();

        openfga
            .project_set_grant(Subject::user(2), Project(1))
            .await;

        assert_eq!(
            openfga.project_privileges(User(1), Project(1)).await,
            HashSet::from_iter([])
        );
        assert_eq!(
            openfga.project_privileges(User(2), Project(1)).await,
            HashSet::from_iter([ProjectPrivilege::HasAccess])
        );
    }

    async fn list(openfga: &Client, user: User) -> Vec<Project> {
        openfga.project_list(user).await.unwrap_privileged()
    }

    #[tokio::test]
    async fn no_project_list() {
        let openfga = authz_client!();
        assert!(list(&openfga, User(1)).await.is_empty());
    }

    #[tokio::test]
    async fn project_list_direct() {
        let openfga = authz_client!();

        openfga
            .project_set_grant(Subject::user(1), Project(1))
            .await;
        openfga
            .project_set_grant(Subject::user(1), Project(2))
            .await;
        openfga
            .project_set_grant(Subject::user(1), Project(3))
            .await;

        let mut projects = list(&openfga, User(1)).await;
        let mut expected = vec![Project(1), Project(2), Project(3)];

        projects.sort();
        expected.sort();

        assert_eq!(projects, expected)
    }

    #[tokio::test]
    async fn project_list_effective() {
        let openfga = authz_client!();

        openfga
            .write_tuples(&[
                Group::member().tuple(&User(1), &Group(1)),
                Group::member().tuple(&User(1), &Group(2)),
            ])
            .await
            .unwrap();
        openfga
            .project_set_grant(Subject::group(1), Project(1))
            .await;
        openfga
            .project_set_grant(Subject::group(2), Project(2))
            .await;
        openfga
            .project_set_grant(Subject::group(1), Project(3))
            .await;

        let mut projects = list(&openfga, User(1)).await;
        let mut expected = vec![Project(1), Project(2), Project(3)];

        projects.sort();
        expected.sort();

        assert_eq!(projects, expected)
    }

    #[tokio::test]
    async fn project_list_admin() {
        let openfga = authz_client!();
        openfga
            .write_tuples(&[User::role().tuple(&Role::Admin, &User(1))])
            .await
            .unwrap();

        assert!(matches!(
            openfga.project_list(User(1)).await,
            ResourcesList::All
        ));
    }

    #[tokio::test]
    async fn project_granted_subjects_direct() {
        let openfga = authz_client!();

        openfga
            .project_set_grant(Subject::user(1), Project(1))
            .await;
        openfga
            .project_set_grant(Subject::user(2), Project(1))
            .await;
        openfga
            .project_set_grant(Subject::user(3), Project(1))
            .await;

        let mut expected = vec![Subject::user(1), Subject::user(2), Subject::user(3)];
        let mut response = openfga.project_granted_subjects(Project(1)).await;
        expected.sort();
        response.sort();

        assert_eq!(response, expected);
    }

    #[tokio::test]
    async fn project_granted_subjects_indirect() {
        let openfga = authz_client!();

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(1)))
            .write(&Group::member().tuple(&User(2), &Group(1)))
            .write(&Project::owner().tuple(Group::member().userset(&Group(1)), &Project(1)))
            .execute()
            .await
            .unwrap();

        let mut expected = vec![Subject::user(1), Subject::user(2), Subject::group(1)];
        let mut response = openfga.project_granted_subjects(Project(1)).await;
        expected.sort();
        response.sort();

        assert_eq!(response, expected);
    }

    #[rstest::rstest]
    #[case::project_direct_grant(
        project_direct_grant(Subject::user(1), Project(1)).checks,
        &[]
    )]
    #[case::project_effective_grant(
        project_effective_grant(Subject::user(1), Project(1)).checks,
        &[]
    )]
    #[case::project_set_grant(
        project_set_grant(Subject::user(1), Project(1)).checks,
        &[Check::CanGiveSubjectProjectGrant(Subject::user(1), Project(1))]
    )]
    #[case::project_revoke_grant(
        project_revoke_grant(Subject::user(1), Project(1)).checks,
        &[Check::HasRole(Actor::Issuer, Role::Admin)]
    )]
    #[case::project_privileges(
        project_privileges(User(1), Project(1)).checks,
        &[
            Check::HasProjectPrivilege(Actor::Issuer, ProjectPrivilege::HasAccess, Project(1))
        ]
    )]
    #[case::project_list(
        project_list(User(1)).checks,
        &[]
    )]
    #[case::project_granted_subjects(
        project_granted_subjects(Project(1)).checks,
        &[
            Check::HasProjectPrivilege(Actor::Issuer, ProjectPrivilege::HasAccess, Project(1))
        ]
    )]
    #[tokio::test]
    async fn protected_contains_expected_checks(
        #[case] protected_checks: HashSet<Check>,
        #[case] expected_checks: &[Check],
    ) {
        // Make sure that each public protected op contains its expected list of checks
        let expected_checks = expected_checks.iter().copied().collect::<HashSet<_>>();
        assert_eq!(expected_checks, protected_checks);
    }
}
