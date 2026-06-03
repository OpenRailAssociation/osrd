use std::collections::HashSet;

use fga::client::UserList;
use fga::model::Relation as _;
use futures::FutureExt as _;
use itertools::Itertools as _;

use crate::Group;
use crate::Role;
use crate::User;
use crate::v2::Actor;
use crate::v2::Check;
use crate::v2::Protected;

pub fn group_members(group: Group) -> Protected<Vec<User>> {
    Protected::new(move |openfga| {
        async move {
            let UserList {
                users,
                public_access,
            } = openfga
                .list_users(Group::member().query_users(&group))
                .await?;
            debug_assert!(
                public_access.is_none(),
                "we don't write public accesses for groups"
            );
            Ok(users)
        }
        .boxed()
    })
    .with_check(Check::group(group))
}

pub fn user_groups(user: User) -> Protected<Vec<Group>> {
    Protected::new(move |openfga| {
        async move {
            let UserList {
                users,
                public_access,
            } = openfga.list_users(User::group().query_users(&user)).await?;
            debug_assert!(
                public_access.is_none(),
                "we don't write public accesses for user groups"
            );
            Ok(users)
        }
        .boxed()
    })
    .with_check(Check::user(user))
}

/// Adds some members to a group
///
/// Idempotent but not atomic due to the lack of transactions in OpenFGA.
pub fn add_members(group: Group, members: HashSet<User>) -> Protected<()> {
    let user_exists_checks = members.iter().map(|user| Check::user(*user)).collect_vec(); // members is moved in Protected

    group_members(group)
        .map(move |openfga, existing_members| {
            async move {
                let existing_members = HashSet::from_iter(existing_members);
                let new_members = members.difference(&existing_members);
                let mut writes = openfga.prepare_writes();
                for user in new_members {
                    writes.push(&Group::member().tuple(user, &group));
                    writes.push(&User::group().tuple(&group, user));
                }
                writes.execute().await?;
                Ok(())
            }
            .boxed()
        })
        .with_check_iter(user_exists_checks)
        .with_check(Check::HasRole(Actor::Issuer, Role::Admin))
}

/// Removes some members from a group
///
/// Idempotent but not atomic due to the lack of transactions in OpenFGA.
pub fn remove_members(group: Group, members: HashSet<User>) -> Protected<()> {
    let user_exists_checks = members.iter().map(|user| Check::user(*user)).collect_vec(); // members is moved in Protected

    group_members(group)
        .map(move |openfga, existing_members| {
            async move {
                let existing_members = HashSet::from_iter(existing_members);
                let expelled = members.intersection(&existing_members);
                let mut writes = openfga.prepare_deletes();
                for user in expelled {
                    writes.push(&Group::member().tuple(user, &group));
                    writes.push(&User::group().tuple(&group, user));
                }
                writes.execute().await?;
                Ok(())
            }
            .boxed()
        })
        .with_check_iter(user_exists_checks)
        .with_check(Check::HasRole(Actor::Issuer, Role::Admin))
}

#[cfg(test)]
mod tests {
    use crate::v2::TestClientExt as _;
    use crate::v2::special_authorizers::Authorize;

    use super::*;

    #[tokio::test]
    async fn add_members_idempotent() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2)])
        );

        add_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2)])
        );
    }

    #[tokio::test]
    async fn add_members_intersecting_calls() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2)])
        );

        add_members(Group(1), HashSet::from_iter([User(1), User(3)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2), User(3)])
        );
    }

    #[tokio::test]
    async fn remove_members_idempotent() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2)])
        );

        remove_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([])
        );

        remove_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([])
        );
    }

    #[tokio::test]
    async fn remove_members_intersecting_calls() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_members(Group(1), HashSet::from_iter([User(1), User(2), User(3)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(1), User(2), User(3)])
        );

        remove_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([User(3)])
        );

        remove_members(Group(1), HashSet::from_iter([User(1), User(3)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        assert_eq!(
            openfga.group_members(&Group(1)).await,
            HashSet::from_iter([])
        );
    }

    #[tokio::test]
    async fn user_groups_empty() {
        let openfga = crate::authz_client!();
        assert_eq!(openfga.user_groups(User(1)).await, HashSet::new());
    }

    #[tokio::test]
    async fn user_groups_some() {
        let openfga = crate::authz_client!();
        let authorize = Authorize(&openfga);

        add_members(Group(1), HashSet::from_iter([User(1), User(2)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;
        add_members(Group(2), HashSet::from_iter([User(1)]))
            .authorize(&authorize)
            .await
            .unwrap()
            .unwrap_authorized()
            .await;

        assert_eq!(
            openfga.user_groups(User(1)).await,
            HashSet::from([Group(1), Group(2)])
        );
    }
}
