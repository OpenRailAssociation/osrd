use std::collections::HashSet;
use std::future::Future;

use fga::fga;
use fga::model::Relation;
use futures::stream;
use tracing::debug;
use tracing::Level;

use crate::model::*;
use crate::BuiltinRole;

pub type UserIdentity = String;
pub type UserName = String;
pub type GroupName = String;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserInfo {
    pub identity: UserIdentity,
    pub name: UserName,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GroupInfo {
    pub name: GroupName,
}

// TODO: move to dedicated module
/// Entry point for managing authorizations (roles and grants)
///
/// Works by interacting with both an (OpenFGA client)[fga::Client] and a [StorageDriver].
///
/// It differs from an [Authorizer] in that the latter's API targets a single authenticated user.
#[derive(Clone)]
pub struct Regulator<S: StorageDriver> {
    openfga: fga::Client,
    driver: S,
}

/// Represents how an authenticated user can interact with the authorization system
#[derive(Clone)]
pub struct Authorizer<S: StorageDriver> {
    user: UserInfo,
    user_id: i64,
    regulator: Regulator<S>,
}

/// An authorization error that can originate from either the OpenFGA client or the storage driver
#[derive(Debug, thiserror::Error)]
pub enum Error<StorageError: std::error::Error> {
    #[error("unknown subject {0}")]
    UnknownSubject(i64),
    #[error(transparent)]
    OpenFga(#[from] fga::client::RequestFailure),
    #[error(transparent)]
    Storage(StorageError),
}

/// A sans-IO style interface the [Regulator] uses to interact with the user and group storage layer
pub trait StorageDriver: Clone {
    type Error: std::error::Error;

    fn get_user_id(
        &self,
        user_identity: &UserIdentity,
    ) -> impl Future<Output = Result<Option<i64>, Self::Error>> + Send;

    fn get_group_id(
        &self,
        group_name: &GroupName,
    ) -> impl Future<Output = Result<Option<i64>, Self::Error>> + Send;

    fn get_user_info(
        &self,
        user_id: i64,
    ) -> impl Future<Output = Result<Option<UserInfo>, Self::Error>> + Send;

    fn get_group_info(
        &self,
        group_id: i64,
    ) -> impl Future<Output = Result<Option<GroupInfo>, Self::Error>> + Send;

    fn ensure_user(&self, user: &UserInfo)
        -> impl Future<Output = Result<i64, Self::Error>> + Send;

    fn ensure_group(
        &self,
        group: &GroupInfo,
    ) -> impl Future<Output = Result<i64, Self::Error>> + Send;

    fn list_users(
        &self,
    ) -> impl Future<
        Output = Result<
            impl stream::TryStream<Ok = (i64, UserInfo), Error = Self::Error>,
            Self::Error,
        >,
    > + Send;

    fn list_groups(
        &self,
    ) -> impl Future<
        Output = Result<
            impl stream::TryStream<Ok = (i64, GroupInfo), Error = Self::Error>,
            Self::Error,
        >,
    > + Send;
}

impl<S: StorageDriver> Regulator<S> {
    pub fn new(openfga: fga::Client, driver: S) -> Self {
        Self { openfga, driver }
    }

    pub fn driver(&self) -> &S {
        &self.driver
    }

    pub fn openfga(&self) -> &fga::Client {
        &self.openfga
    }

    /// Returns whether a user with some id exists
    #[tracing::instrument(skip_all, fields(user_id = %user_id), ret(level = Level::DEBUG), err)]
    pub async fn user_exists(&self, user_id: i64) -> Result<bool, Error<S::Error>> {
        self.driver
            .get_user_info(user_id)
            .await
            .map(|x| x.is_some())
            .map_err(Error::Storage)
    }

    /// Returns whether a group with some id exists
    #[tracing::instrument(skip_all, fields(group_id = %group_id), ret(level = Level::DEBUG), err)]
    pub async fn group_exists(&self, group_id: i64) -> Result<bool, Error<S::Error>> {
        self.driver
            .get_group_info(group_id)
            .await
            .map(|x| x.is_some())
            .map_err(Error::Storage)
    }

    /// Returns the IDs of the users which are members of the provided group
    #[tracing::instrument(skip_all, fields(user_id, group_id), ret(level = Level::DEBUG), err)]
    pub async fn group_members(&self, group_id: i64) -> Result<HashSet<i64>, Error<S::Error>> {
        if !self.group_exists(group_id).await? {
            return Err(Error::UnknownSubject(group_id));
        }
        let group = fga!(Group:group_id);
        let members = self
            .openfga
            .list_users(Group::member().query_users(&group))
            .await?;
        debug_assert!(
            members.public_access.is_none(),
            "we don't write public accesses for groups"
        );
        Ok(members
            .users
            .into_iter()
            .filter_map(|User(user)| match user.parse() {
                Ok(id) => Some(id),
                Err(_) => {
                    tracing::error!(user, "unparsable group member — skipping it");
                    None
                }
            })
            .collect())
    }

    /// Adds some users to a group
    #[tracing::instrument(skip_all, fields(group_id, ?user_ids), ret(level = Level::DEBUG), err)]
    pub async fn add_members(
        &self,
        group_id: i64,
        user_ids: HashSet<i64>,
    ) -> Result<(), Error<S::Error>> {
        let existing_members = self.group_members(group_id).await?;
        let new_members = user_ids.difference(&existing_members);
        let group = fga!(Group:group_id);
        let mut writes = self.openfga.prepare_writes();
        for user_id in new_members {
            if !self.user_exists(*user_id).await? {
                return Err(Error::UnknownSubject(*user_id));
            }
            let user = fga!(User:user_id);
            writes.push(&Group::member().tuple(&user, &group));
            writes.push(&User::group().tuple(&group, &user));
        }
        writes.execute().await?;
        Ok(())
    }

    /// Removes some users from a group
    #[tracing::instrument(skip_all, fields(group_id, ?user_ids), ret(level = Level::DEBUG), err)]
    pub async fn remove_members(
        &self,
        group_id: i64,
        user_ids: HashSet<i64>,
    ) -> Result<(), Error<S::Error>> {
        let existing_members = self.group_members(group_id).await?;
        let members = user_ids.intersection(&existing_members);
        let group = fga!(Group:group_id);
        let mut deletes = self.openfga.prepare_deletes();
        for user_id in members {
            let user = fga!(User:user_id);
            deletes.push(&Group::member().tuple(&user, &group));
            deletes.push(&User::group().tuple(&group, &user));
        }
        deletes.execute().await?;
        Ok(())
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn user_roles(&self, user_id: i64) -> Result<HashSet<BuiltinRole>, Error<S::Error>> {
        // no need to check for user inexistence, an empty set will be returned in this case
        let roles =
            BuiltinRole::list_roles(&self.openfga, User::role(), &fga!(User:user_id)).await?;
        Ok(roles.into_iter().collect())
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn group_roles(
        &self,
        group_id: i64,
    ) -> Result<HashSet<BuiltinRole>, Error<S::Error>> {
        // no need to check for group inexistence, an empty set will be returned in this case
        let roles =
            BuiltinRole::list_roles(&self.openfga, Group::role(), &fga!(Group:group_id)).await?;
        Ok(roles.into_iter().collect())
    }

    #[tracing::instrument(skip_all, fields(user_id, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn grant_user_roles(
        &self,
        user_id: i64,
        roles: HashSet<BuiltinRole>,
    ) -> Result<(), Error<S::Error>> {
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }
        let user = fga!(User:user_id);
        let mut writes = self.openfga.prepare_writes();
        let existing_roles = self.user_roles(user_id).await?;
        for role in roles.difference(&existing_roles) {
            writes.push(&User::role().tuple(&Role::from(*role), &user));
        }
        writes.execute().await?;
        Ok(())
    }

    // TODO: s/strip/revoke/
    #[tracing::instrument(skip_all, fields(user_id, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn strip_user_roles(
        &self,
        user_id: i64,
        roles: HashSet<BuiltinRole>,
    ) -> Result<(), Error<S::Error>> {
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }
        let user = fga!(User:user_id);
        let mut deletes = self.openfga.prepare_deletes();
        let existing_roles = self.user_roles(user_id).await?;
        for role in roles.intersection(&existing_roles) {
            deletes.push(&User::role().tuple(&Role::from(*role), &user));
        }
        deletes.execute().await?;
        Ok(())
    }

    #[tracing::instrument(skip_all, fields(group_id, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn grant_group_roles(
        &self,
        group_id: i64,
        roles: HashSet<BuiltinRole>,
    ) -> Result<(), Error<S::Error>> {
        if !self.group_exists(group_id).await? {
            return Err(Error::UnknownSubject(group_id));
        }
        let group = fga!(Group:group_id);
        let mut writes = self.openfga.prepare_writes();
        let existing_roles = self.group_roles(group_id).await?;
        for role in roles.difference(&existing_roles) {
            writes.push(&Group::role().tuple(&Role::from(*role), &group));
        }
        writes.execute().await?;
        Ok(())
    }

    #[tracing::instrument(skip_all, fields(group_id, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn strip_group_roles(
        &self,
        group_id: i64,
        roles: HashSet<BuiltinRole>,
    ) -> Result<(), Error<S::Error>> {
        if !self.group_exists(group_id).await? {
            return Err(Error::UnknownSubject(group_id));
        }
        let group = fga!(Group:group_id);
        let mut deletes = self.openfga.prepare_deletes();
        let existing_roles = self.group_roles(group_id).await?;
        for role in roles.intersection(&existing_roles) {
            deletes.push(&Group::role().tuple(&Role::from(*role), &group));
        }
        deletes.execute().await?;
        Ok(())
    }

    #[tracing::instrument(skip(self), fields(%user_id, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn check_roles(
        &self,
        user_id: i64,
        roles: HashSet<BuiltinRole>,
    ) -> Result<bool, Error<S::Error>> {
        // checks will fail if the user doesn't exist, so no need to query the DB
        if roles.is_empty() {
            return Ok(true);
        }
        let user_roles = self.user_roles(user_id).await?;
        if !roles.is_disjoint(&user_roles) {
            return Ok(true);
        }
        if user_roles.contains(&BuiltinRole::Admin) {
            tracing::info!(user_id, "role check bypassed for admin");
            return Ok(true);
        }
        Ok(false)
    }
}

impl<S: StorageDriver> Authorizer<S> {
    #[tracing::instrument(skip_all, fields(%user), ret(level = Level::DEBUG), err)]
    pub async fn try_initialize(
        user: UserInfo,
        regulator: Regulator<S>,
    ) -> Result<Self, Error<S::Error>> {
        let user_id = regulator
            .driver
            .ensure_user(&user)
            .await
            .map_err(Error::Storage)?;
        debug!(%user, %user_id, "user authenticated");
        let authorizer = Self {
            user,
            user_id,
            regulator,
        };
        Ok(authorizer)
    }

    pub fn user_id(&self) -> i64 {
        self.user_id
    }

    pub async fn user_roles(&self) -> Result<HashSet<BuiltinRole>, Error<S::Error>> {
        self.regulator.user_roles(self.user_id).await
    }

    /// Check that the user has any of the required roles
    #[tracing::instrument(skip_all, fields(user = %self.user, ?roles), ret(level = Level::DEBUG))]
    pub async fn check_roles(&self, roles: HashSet<BuiltinRole>) -> Result<bool, Error<S::Error>> {
        self.regulator.check_roles(self.user_id, roles).await
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

impl std::fmt::Display for UserInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({})", self.identity, self.name)
    }
}

impl std::fmt::Display for GroupInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::BuiltinRole;
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
    async fn check_user_roles() {
        let user = || UserInfo {
            identity: "toto".to_owned(),
            name: "Sir Toto, the One and Only".to_owned(),
        };
        let regulator = Regulator::new(crate::openfga!(), MockAuthDriver::default());
        let regulator = move || regulator.clone();

        // setup user (using the authorizer)
        let user_id = {
            let authorizer = Authorizer::try_initialize(user(), regulator())
                .await
                .unwrap();
            let users = authorizer.regulator.driver.users.lock().unwrap();
            assert_eq!(
                users.iter().next(),
                Some((&"toto".to_owned(), &0)),
                "new user should have been created"
            );
            authorizer.user_id()
        };

        let id = {
            let authorizer = Authorizer::try_initialize(user(), regulator())
                .await
                .unwrap();
            authorizer.user_id()
        };
        assert_eq!(user_id, id);

        // setup roles
        {
            regulator()
                .grant_user_roles(
                    user_id,
                    HashSet::from([BuiltinRole::OperationalStudies, BuiltinRole::Stdcm]),
                )
                .await
                .expect("roles should be granted");
        }

        assert!(Authorizer::try_initialize(user(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([BuiltinRole::OperationalStudies]))
            .await
            .expect("should check roles successfully"));
        assert!(Authorizer::try_initialize(user(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([BuiltinRole::Stdcm, BuiltinRole::Admin]))
            .await
            .expect("should check roles successfully"));
        assert!(!Authorizer::try_initialize(user(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([BuiltinRole::Admin]))
            .await
            .expect("should check roles successfully"));

        // remove role
        {
            regulator()
                .strip_user_roles(user_id, HashSet::from([BuiltinRole::OperationalStudies]))
                .await
                .expect("roles should be stripped");
        }

        assert!(!Authorizer::try_initialize(user(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([BuiltinRole::OperationalStudies]))
            .await
            .expect("should check roles successfully"));
        assert!(Authorizer::try_initialize(user(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([BuiltinRole::Stdcm]))
            .await
            .expect("should check roles successfully"));

        // no roles
        assert!(Authorizer::try_initialize(user(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([]))
            .await
            .expect("should check roles successfully"));

        // unknown user
        assert!(!regulator()
            .check_roles(i64::MAX, HashSet::from([BuiltinRole::Stdcm]))
            .await
            .expect("should check roles successfully"));

        assert_eq!(
            regulator()
                .user_roles(i64::MAX)
                .await
                .expect("should query roles successfully"),
            HashSet::new()
        );
    }

    #[tokio::test]
    async fn check_group_roles() {
        editoast_common::setup_tracing_for_test();
        let alice = || UserInfo {
            identity: "alice".to_owned(),
            name: "Alice".to_owned(),
        };
        let bob = || UserInfo {
            identity: "bob".to_owned(),
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
            .expect("alice should be created");
        let bob_id = regulator()
            .driver
            .ensure_user(&bob())
            .await
            .expect("bob should be created");
        let friends_id = regulator()
            .driver
            .ensure_group(&friends())
            .await
            .expect("group should be created");

        // add members
        regulator()
            .add_members(friends_id, HashSet::from([alice_id, bob_id]))
            .await
            .expect("members should be added");

        // setup roles
        regulator()
            .grant_group_roles(friends_id, HashSet::from([BuiltinRole::OperationalStudies]))
            .await
            .expect("group's roles should be granted");

        regulator()
            .grant_user_roles(bob_id, HashSet::from([BuiltinRole::Stdcm]))
            .await
            .expect("bob's roles should be granted");

        // check roles
        assert!(Authorizer::try_initialize(alice(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([BuiltinRole::OperationalStudies]))
            .await
            .expect("should check roles successfully"));

        assert!(Authorizer::try_initialize(bob(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([BuiltinRole::OperationalStudies]))
            .await
            .expect("should check roles successfully"));

        assert!(!Authorizer::try_initialize(alice(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([BuiltinRole::Stdcm]))
            .await
            .expect("should check roles successfully"));

        assert!(Authorizer::try_initialize(bob(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([BuiltinRole::Stdcm]))
            .await
            .expect("should check roles successfully"));

        // remove user
        regulator()
            .remove_members(friends_id, HashSet::from([bob_id]))
            .await
            .expect("bob should be removed from the group");

        assert!(!Authorizer::try_initialize(bob(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([BuiltinRole::OperationalStudies])) // now he doesn't have the group's roles...
            .await
            .expect("should check roles successfully"));

        assert!(Authorizer::try_initialize(bob(), regulator())
            .await
            .unwrap()
            .check_roles(HashSet::from([BuiltinRole::Stdcm])) // ...but still has its own
            .await
            .expect("should check roles successfully"));

        // unknown group
        assert_eq!(
            regulator()
                .group_roles(i64::MAX)
                .await
                .expect("should query roles successfully"),
            HashSet::new()
        );
    }

    impl StorageDriver for MockAuthDriver {
        type Error = Infallible;

        async fn ensure_user(&self, user: &UserInfo) -> Result<i64, Self::Error> {
            let mut users = self.users.lock().unwrap();
            let user_id = {
                let id = self.counter.read().unwrap();
                *users.entry(user.identity.clone()).or_insert(*id)
            };
            *self.counter.write().unwrap() += 1;
            Ok(user_id)
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
    }
}
