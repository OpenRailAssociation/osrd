use std::collections::HashSet;

use fga::model::Relation as _;
use futures::FutureExt as _;

use crate::Group;
use crate::Role;
use crate::Subject;
use crate::User;
use crate::v2::Guardrail;
use crate::v2::Protected;
use crate::v2::SanityCheck;

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
    .with_check(SanityCheck::SubjectExists(subject))
}

/// Gives the subject the specified roles
///
/// Idempotent but not atomic due to the lack of transactions in OpenFGA.
pub fn add_roles(subject: Subject, roles: HashSet<Role>) -> Protected<()> {
    subject_roles(subject)
        .map(move |openfga, existing_roles| {
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
        .with_guardrail(Guardrail::IssuerHasRole(Role::Admin))
}

/// Removes the specified roles from the subject
///
/// Idempotent but not atomic due to the lack of transactions in OpenFGA.
pub fn remove_roles(subject: Subject, roles: HashSet<Role>) -> Protected<()> {
    subject_roles(subject)
        .map(move |openfga, existing_roles| {
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
        .with_guardrail(Guardrail::IssuerHasRole(Role::Admin))
}

#[cfg(test)]
mod tests {
    use crate::v2::TestClientExt as _;
    use crate::v2::special_authorizers::Authorize;

    use super::*;

    #[tokio::test]
    async fn add_roles_idempotent() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );
    }

    #[tokio::test]
    async fn add_roles_intersecting_calls() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::OperationalStudies]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm, Role::OperationalStudies])
        );
    }

    #[tokio::test]
    async fn remove_roles_idempotent() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm])
        );

        remove_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([])
        );

        remove_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([])
        );
    }

    #[tokio::test]
    async fn remove_roles_intersecting_calls() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm, Role::OperationalStudies]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::Admin, Role::Stdcm, Role::OperationalStudies])
        );

        remove_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::Stdcm]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([Role::OperationalStudies])
        );

        remove_roles(
            Subject::user(1),
            HashSet::from_iter([Role::Admin, Role::OperationalStudies]),
        )
        .authorize(&authorize)
        .await
        .unwrap()
        .unwrap_authorized()
        .await;
        assert_eq!(
            openfga.subject_roles(&Subject::user(1)).await,
            HashSet::from_iter([])
        );
    }
}
