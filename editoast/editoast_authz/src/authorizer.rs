use std::collections::HashSet;
use tracing::Level;
use tracing::debug;

use crate::Authorization;
use crate::Error;
use crate::Infra;
use crate::InfraGrant;
use crate::Regulator;
use crate::Role;
use crate::StorageDriver;
use crate::Subject;
use crate::identity::UserIdentity;
use crate::identity::UserInfo;
use crate::model::InfraPrivilege;
use crate::model::User;

/// Represents how an authenticated user can interact with the authorization system
#[derive(Clone)]
pub struct Authorizer<S: StorageDriver> {
    user: UserInfo,
    user_id: i64,
    regulator: Regulator<S>,
}

impl<S: StorageDriver> Authorizer<S> {
    /// Initialize an authorizer for the given user.
    /// If the user doesn't exist, an error is returned.
    #[tracing::instrument(skip_all, fields(%user), ret(level = Level::DEBUG), err)]
    pub async fn try_initialize(
        user: UserIdentity,
        regulator: Regulator<S>,
    ) -> Result<Self, Error<S::Error>> {
        let user_info = regulator
            .driver
            .get_user_info_by_identity(&user)
            .await
            .map_err(Error::Storage)?
            .ok_or(Error::UnknownUser { identity: user })?;
        debug!(%user_info, "user authenticated");
        let authorizer = Self {
            user: user_info.info,
            user_id: user_info.id,
            regulator,
        };
        Ok(authorizer)
    }

    pub fn user_id(&self) -> i64 {
        self.user_id
    }

    pub fn user_name(&self) -> &str {
        &self.user.name
    }

    pub async fn user_roles(&self) -> Result<HashSet<Role>, Error<S::Error>> {
        self.regulator.user_roles(&User(self.user_id)).await
    }

    /// Check that the user has any of the required roles
    #[tracing::instrument(skip_all, fields(user = %self.user, ?roles), ret(level = Level::DEBUG))]
    pub async fn check_roles(&self, roles: HashSet<Role>) -> Result<bool, Error<S::Error>> {
        self.regulator.check_roles(&User(self.user_id), roles).await
    }

    pub async fn infra_privileges(
        &self,
        infra: &Infra,
    ) -> Result<HashSet<InfraPrivilege>, Error<S::Error>> {
        self.regulator
            .infra_privileges(&User(self.user_id), infra)
            .await
    }

    pub async fn infra_grant(&self, infra: &Infra) -> Result<Option<InfraGrant>, Error<S::Error>> {
        self.regulator.infra_grant(&User(self.user_id), infra).await
    }

    pub async fn authorize_infra_read(
        &self,
        infra: &Infra,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        self.regulator
            .authorize_infra_read(&User(self.user_id), infra)
            .await
    }

    pub async fn authorize_infra_write(
        &self,
        infra: &Infra,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        self.regulator
            .authorize_infra_write(&User(self.user_id), infra)
            .await
    }

    pub async fn authorize_infra_delete(
        &self,
        infra: &Infra,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        self.regulator
            .authorize_infra_delete(&User(self.user_id), infra)
            .await
    }

    pub async fn list_authorized_infra(
        &self,
    ) -> Result<Authorization<Vec<Infra>>, Error<S::Error>> {
        self.regulator
            .list_authorized_infra(&User(self.user_id))
            .await
    }

    pub async fn give_infra_grant(
        &self,
        user: &User,
        infra: &Infra,
        grant: InfraGrant,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        self.regulator
            .give_infra_grant(&User(self.user_id), user, infra, grant)
            .await
    }

    pub async fn revoke_infra_grants(
        &self,
        subject: &Subject,
        infra: &Infra,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        self.regulator
            .revoke_infra_grants(&User(self.user_id), subject, infra)
            .await
    }
}

impl<S: StorageDriver> std::fmt::Debug for Authorizer<S> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Authorizer")
            .field("user", &self.user)
            .field("user_id", &self.user_id)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Role;
    use crate::identity::GroupInfo;
    use crate::identity::GroupName;
    use crate::identity::User;
    use crate::identity::UserIdentity;
    use crate::model;
    use crate::model::Group;
    use futures::stream;
    use pretty_assertions::assert_eq;
    use std::collections::HashMap;
    use std::convert::Infallible;
    use std::sync::Arc;
    use std::sync::Mutex;
    use std::sync::RwLock;

    #[derive(Debug, Clone, Default)]
    struct MockAuthDriver {
        counter: Arc<RwLock<i64>>,
        users: Arc<Mutex<HashMap<UserIdentity, i64>>>,
        groups: Arc<Mutex<HashMap<GroupName, i64>>>,
    }

    #[tokio::test]
    async fn check_user_grants() {
        let user_identity = || "toto".to_owned();
        let user = || UserInfo {
            identity: user_identity(),
            name: "Sir Toto, the One and Only".to_owned(),
        };
        let regulator = Regulator::new(crate::openfga!(), MockAuthDriver::default());
        let regulator = move || regulator.clone();

        let user_id = regulator()
            .driver
            .ensure_user(&user())
            .await
            .expect("toto should be created")
            .id;

        let authorizer = Authorizer::try_initialize(user_identity(), regulator())
            .await
            .unwrap();

        authorizer
            .regulator
            .give_infra_grant_unchecked(&User(authorizer.user_id()), &Infra(1), InfraGrant::Reader)
            .await
            .expect("Update grants should be successful");
        let grant = authorizer
            .infra_grant(&Infra(1))
            .await
            .expect("Check grants should be successful");
        assert_eq!(grant, Some(InfraGrant::Reader));

        authorizer
            .regulator
            .give_infra_grant_unchecked(&User(user_id), &Infra(1), InfraGrant::Writer)
            .await
            .expect("Update grants should be successful");
        let grant = authorizer
            .infra_grant(&Infra(1))
            .await
            .expect("Check grants should be successful");
        assert_eq!(grant, Some(InfraGrant::Writer));

        authorizer
            .regulator
            .give_infra_grant_unchecked(&User(user_id), &Infra(1), InfraGrant::Owner)
            .await
            .expect("Update grants should be successful");
        let grant = authorizer
            .infra_grant(&Infra(1))
            .await
            .expect("Check grants should be successful");
        assert_eq!(grant, Some(InfraGrant::Owner));
    }

    #[tokio::test]
    async fn check_user_roles() {
        let user_identity = || "toto".to_owned();
        let user = || UserInfo {
            identity: user_identity(),
            name: "Sir Toto, the One and Only".to_owned(),
        };
        let regulator = Regulator::new(crate::openfga!(), MockAuthDriver::default());
        let regulator = move || regulator.clone();

        // setup user
        let user_id = {
            let regulator = regulator();
            let User { id, .. } = regulator.driver.ensure_user(&user()).await.unwrap();
            let users = regulator.driver.users.lock().unwrap();
            assert_eq!(
                users.iter().next(),
                Some((&"toto".to_owned(), &id)),
                "new user should have been created"
            );
            id
        };

        let id = {
            let authorizer = Authorizer::try_initialize(user_identity(), regulator())
                .await
                .unwrap();
            authorizer.user_id()
        };
        assert_eq!(user_id, id);

        // setup roles
        {
            regulator()
                .grant_user_roles(
                    &User(user_id),
                    HashSet::from([Role::OperationalStudies, Role::Stdcm]),
                )
                .await
                .expect("roles should be granted");
        }

        assert!(
            Authorizer::try_initialize(user_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([Role::OperationalStudies]))
                .await
                .expect("should check roles successfully")
        );
        assert!(
            Authorizer::try_initialize(user_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([Role::Stdcm, Role::Admin]))
                .await
                .expect("should check roles successfully")
        );
        assert!(
            !Authorizer::try_initialize(user_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([Role::Admin]))
                .await
                .expect("should check roles successfully")
        );

        // remove role
        {
            regulator()
                .revoke_user_roles(&User(user_id), HashSet::from([Role::OperationalStudies]))
                .await
                .expect("roles should be stripped");
        }

        assert!(
            !Authorizer::try_initialize(user_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([Role::OperationalStudies]))
                .await
                .expect("should check roles successfully")
        );
        assert!(
            Authorizer::try_initialize(user_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([Role::Stdcm]))
                .await
                .expect("should check roles successfully")
        );

        // no roles
        assert!(
            Authorizer::try_initialize(user_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([]))
                .await
                .expect("should check roles successfully")
        );

        // unknown user
        assert!(
            !regulator()
                .check_roles(&User(i64::MAX), HashSet::from([Role::Stdcm]))
                .await
                .expect("should check roles successfully")
        );

        assert_eq!(
            regulator()
                .user_roles(&User(i64::MAX))
                .await
                .expect("should query roles successfully"),
            HashSet::new()
        );
    }

    #[tokio::test]
    async fn check_group_roles() {
        editoast_common::setup_tracing_for_test();
        let alice_identity = || "alice".to_owned();
        let alice = || UserInfo {
            identity: alice_identity(),
            name: "Alice".to_owned(),
        };
        let bob_identity = || "bob".to_owned();
        let bob = || UserInfo {
            identity: bob_identity(),
            name: "Bob".to_owned(),
        };
        let friends = || GroupInfo {
            name: "friends".to_owned(),
        };

        let regulator = Regulator::new(crate::openfga!(), MockAuthDriver::default());
        let regulator = move || regulator.clone();

        // setup subjects
        let alice_id = regulator()
            .driver
            .ensure_user(&alice())
            .await
            .expect("alice should be created")
            .id;
        let bob_id = regulator()
            .driver
            .ensure_user(&bob())
            .await
            .expect("bob should be created")
            .id;
        let friends = model::Group(
            regulator()
                .driver
                .ensure_group(&friends())
                .await
                .expect("group should be created"),
        );

        // add members
        regulator()
            .add_members(&friends, HashSet::from([User(alice_id), User(bob_id)]))
            .await
            .expect("members should be added");

        // setup roles
        regulator()
            .grant_group_roles(&friends, HashSet::from([Role::OperationalStudies]))
            .await
            .expect("group's roles should be granted");

        regulator()
            .grant_user_roles(&User(bob_id), HashSet::from([Role::Stdcm]))
            .await
            .expect("bob's roles should be granted");

        // check roles
        assert!(
            Authorizer::try_initialize(alice_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([Role::OperationalStudies]))
                .await
                .expect("should check roles successfully")
        );

        assert!(
            Authorizer::try_initialize(bob_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([Role::OperationalStudies]))
                .await
                .expect("should check roles successfully")
        );

        assert!(
            !Authorizer::try_initialize(alice_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([Role::Stdcm]))
                .await
                .expect("should check roles successfully")
        );

        assert!(
            Authorizer::try_initialize(bob_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([Role::Stdcm]))
                .await
                .expect("should check roles successfully")
        );

        // remove user
        regulator()
            .remove_members(&friends, &HashSet::from([User(bob_id)]))
            .await
            .expect("bob should be removed from the group");

        assert!(
            !Authorizer::try_initialize(bob_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([Role::OperationalStudies])) // now he doesn't have the group's roles...
                .await
                .expect("should check roles successfully")
        );

        assert!(
            Authorizer::try_initialize(bob_identity(), regulator())
                .await
                .unwrap()
                .check_roles(HashSet::from([Role::Stdcm])) // ...but still has its own
                .await
                .expect("should check roles successfully")
        );

        // unknown group
        assert_eq!(
            regulator()
                .group_roles(&Group(i64::MAX))
                .await
                .expect("should query roles successfully"),
            HashSet::new()
        );
    }

    impl StorageDriver for MockAuthDriver {
        type Error = Infallible;

        async fn ensure_user(&self, user: &UserInfo) -> Result<User, Self::Error> {
            let mut users = self.users.lock().unwrap();
            let user_id = {
                let id = self.counter.read().unwrap();
                *users.entry(user.identity.clone()).or_insert(*id)
            };
            *self.counter.write().unwrap() += 1;
            Ok(User {
                id: user_id,
                info: user.clone(),
            })
        }

        async fn ensure_group(&self, group: &GroupInfo) -> Result<i64, Self::Error> {
            let mut groups = self.groups.lock().unwrap();
            let group_id = {
                let id = self.counter.read().unwrap();
                *groups.entry(group.name.clone()).or_insert(*id)
            };
            *self.counter.write().unwrap() += 1;
            Ok(group_id)
        }

        async fn get_user_id(
            &self,
            user_identity: &UserIdentity,
        ) -> Result<Option<i64>, Self::Error> {
            Ok(self.users.lock().unwrap().get(user_identity).copied())
        }

        async fn get_group_id(&self, group_name: &GroupName) -> Result<Option<i64>, Self::Error> {
            Ok(self.groups.lock().unwrap().get(group_name).copied())
        }

        async fn get_user_info(&self, user_id: i64) -> Result<Option<UserInfo>, Self::Error> {
            let users = self.users.lock().unwrap();
            let user_info = users
                .iter()
                .find(|(_, id)| **id == user_id)
                .map(|(identity, _)| UserInfo {
                    identity: identity.clone(),
                    name: "Mocked User".to_owned(),
                });
            Ok(user_info)
        }

        async fn get_group_info(&self, group_id: i64) -> Result<Option<GroupInfo>, Self::Error> {
            let groups = self.groups.lock().unwrap();
            let group_info = groups
                .iter()
                .find(|(_, id)| **id == group_id)
                .map(|(name, _)| GroupInfo { name: name.clone() });
            Ok(group_info)
        }

        async fn list_users(
            &self,
        ) -> Result<impl stream::TryStream<Ok = (i64, UserInfo), Error = Self::Error>, Self::Error>
        {
            Ok(stream::iter(
                self.users
                    .lock()
                    .unwrap()
                    .clone()
                    .into_iter()
                    .map(|(identity, id)| {
                        Ok((
                            id,
                            UserInfo {
                                name: format!("Mocked user {identity}"),
                                identity,
                            },
                        ))
                    }),
            ))
        }

        async fn list_groups(
            &self,
        ) -> Result<impl stream::TryStream<Ok = (i64, GroupInfo), Error = Self::Error>, Self::Error>
        {
            Ok(stream::iter(
                self.groups
                    .lock()
                    .unwrap()
                    .clone()
                    .into_iter()
                    .map(|(name, id)| Ok((id, GroupInfo { name }))),
            ))
        }

        async fn infra_exists(&self, _infra_id: i64) -> Result<bool, Self::Error> {
            // Mock implementation, always return true
            Ok(true)
        }
    }
}
