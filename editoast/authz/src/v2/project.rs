use fga::model::Relation as _;
use futures::FutureExt;

use crate::Group;
use crate::Subject;
use crate::model::Project;
use crate::model::ProjectGrant;
use crate::v2::Check;
use crate::v2::Protected;

/// Returns the *direct grant* a subject has for a [Project].
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
    .with_check(Check::SubjectExists(subject))
    .with_check(Check::ProjectExists(project))
}

#[cfg(test)]
mod tests {
    use crate::User;
    use crate::authz_client;
    use crate::model::Project;
    use crate::v2::TestClientExt;

    use super::*;

    #[tokio::test]
    async fn user_project_direct_grant() {
        let openfga = authz_client!();

        let user_grant = async |user_id: i64| -> Option<ProjectGrant> {
            openfga
                .project_direct_grant(Subject::user(user_id), Project(1))
                .await
        };

        assert_eq!(user_grant(1).await, None);

        openfga
            .prepare_writes()
            .write(&Project::owner().tuple(&User(1), &Project(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(user_grant(1).await, Some(ProjectGrant::Owner));
    }

    #[tokio::test]
    async fn group_project_direct_grant() {
        let openfga = authz_client!();

        let group_grant = async |group_id: i64| -> Option<ProjectGrant> {
            openfga
                .project_direct_grant(Subject::group(group_id), Project(1))
                .await
        };

        assert_eq!(group_grant(1).await, None);

        openfga
            .prepare_writes()
            .write(&Project::owner().tuple(Group::member().userset(&Group(1)), &Project(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(group_grant(1).await, Some(ProjectGrant::Owner));
    }

    #[tokio::test]
    /// Verify that there is no inherance of direct grant between an user and a group
    async fn no_inference_project_direct_grant() {
        let openfga = authz_client!();

        let user_grant = async |user_id: i64| -> Option<ProjectGrant> {
            openfga
                .project_direct_grant(Subject::user(user_id), Project(1))
                .await
        };
        let group_grant = async |group_id: i64| -> Option<ProjectGrant> {
            openfga
                .project_direct_grant(Subject::group(group_id), Project(1))
                .await
        };

        openfga
            .prepare_writes()
            .write(&Group::member().tuple(&User(1), &Group(1)))
            .write(&Project::owner().tuple(Group::member().userset(&Group(1)), &Project(1)))
            .execute()
            .await
            .unwrap();

        assert_eq!(user_grant(1).await, None);
        assert_eq!(group_grant(1).await, Some(ProjectGrant::Owner));
    }
}
