use std::{collections::HashSet, future::Future};

use tracing::debug;
use tracing::Level;

use crate::roles::BuiltinRoleSet;

pub type UserIdentity = String;
pub type UserName = String;

#[derive(Debug, Clone)]
pub struct UserInfo {
    pub identity: UserIdentity,
    pub name: UserName,
}

#[derive(Clone)]
pub struct Authorizer<S: StorageDriver> {
    user: UserInfo,
    user_id: i64,
    user_roles: HashSet<S::BuiltinRole>,
    #[allow(unused)] // will be used soon
    storage: S,
}

pub trait StorageDriver: Clone {
    type BuiltinRole: BuiltinRoleSet + std::fmt::Debug;
    type Error: std::error::Error;

    fn get_user_id(
        &self,
        user_identity: &UserIdentity,
    ) -> impl Future<Output = Result<Option<i64>, Self::Error>> + Send;

    fn get_user_info(
        &self,
        user_id: i64,
    ) -> impl Future<Output = Result<Option<UserInfo>, Self::Error>> + Send;

    fn ensure_user(&self, user: &UserInfo)
        -> impl Future<Output = Result<i64, Self::Error>> + Send;

    fn fetch_subject_roles(
        &self,
        subject_id: i64,
    ) -> impl Future<Output = Result<HashSet<Self::BuiltinRole>, Self::Error>> + Send;

    fn ensure_subject_roles(
        &self,
        subject_id: i64,
        roles: HashSet<Self::BuiltinRole>,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;

    fn remove_subject_roles(
        &self,
        subject_id: i64,
        roles: HashSet<Self::BuiltinRole>,
    ) -> impl Future<Output = Result<HashSet<Self::BuiltinRole>, Self::Error>> + Send;
}

impl<S: StorageDriver> Authorizer<S> {
    #[tracing::instrument(skip_all, fields(%user), err)]
    pub async fn try_initialize(user: UserInfo, storage_driver: S) -> Result<Self, S::Error> {
        let user_id = storage_driver.ensure_user(&user).await?;
        debug!(%user, %user_id, "user authenticated");
        let user_roles = storage_driver.fetch_subject_roles(user_id).await?;
        Ok(Self {
            user,
            user_id,
            user_roles,
            storage: storage_driver,
        })
    }

    pub fn new_superuser(storage_driver: S) -> Self {
        Self {
            user: UserInfo {
                identity: "superuser".to_string(),
                name: "Super User".to_string(),
            },
            user_id: -1,
            user_roles: HashSet::from([S::BuiltinRole::superuser()]),
            storage: storage_driver,
        }
    }

    pub fn user_id(&self) -> i64 {
        self.user_id
    }

    pub fn is_superuser(&self) -> bool {
        self.user_roles.contains(&S::BuiltinRole::superuser())
    }

    /// Returns whether a user with some id exists
    #[tracing::instrument(skip_all, fields(user_id = %user_id), ret(level = Level::DEBUG), err)]
    pub async fn user_exists(&self, user_id: i64) -> Result<bool, S::Error> {
        self.storage
            .get_user_info(user_id)
            .await
            .map(|x| x.is_some())
    }

    /// Check that the user has all the required builting roles
    #[tracing::instrument(skip_all, fields(user = %self.user, user_roles = ?self.user_roles, ?required_roles), ret(level = Level::DEBUG), err)]
    pub async fn check_roles(
        &self,
        required_roles: HashSet<S::BuiltinRole>,
    ) -> Result<bool, S::Error> {
        if self.is_superuser() {
            tracing::debug!("role checking skipped for superuser");
            return Ok(true);
        }

        Ok(required_roles.is_subset(&self.user_roles))
    }

    #[tracing::instrument(skip_all, fields(user_id, auth_user = %self.user, user_roles = ?self.user_roles), ret(level = Level::DEBUG), err)]
    pub async fn user_builtin_roles(
        &self,
        user_id: i64,
    ) -> Result<HashSet<S::BuiltinRole>, S::Error> {
        let user_roles = self.storage.fetch_subject_roles(user_id).await?;
        Ok(user_roles.clone())
    }

    #[tracing::instrument(skip_all, fields(user_id, auth_user = %self.user, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn grant_roles(
        &mut self,
        user_id: i64,
        roles: HashSet<S::BuiltinRole>,
    ) -> Result<(), S::Error> {
        self.storage
            .ensure_subject_roles(user_id, roles.clone())
            .await?;
        self.user_roles.extend(roles);
        Ok(())
    }

    #[tracing::instrument(skip_all, fields(user_id, auth_user = %self.user, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn strip_roles(
        &mut self,
        user_id: i64,
        roles: HashSet<S::BuiltinRole>,
    ) -> Result<(), S::Error> {
        let removed_roles = self
            .storage
            .remove_subject_roles(user_id, roles.clone())
            .await?;
        tracing::debug!(?removed_roles, "removed roles");
        self.user_roles.retain(|r| !roles.contains(r));
        Ok(())
    }
}

impl<S: StorageDriver> std::fmt::Debug for Authorizer<S> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Authorizer")
            .field("user", &self.user)
            .field("user_id", &self.user_id)
            .field("user_roles", &self.user_roles)
            .finish()
    }
}

impl std::fmt::Display for UserInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} ({})", self.identity, self.name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixtures::*;
    use pretty_assertions::assert_eq;
    use std::{
        collections::HashMap,
        convert::Infallible,
        sync::{Arc, Mutex},
    };

    #[derive(Debug, Clone, Default)]
    struct MockStorageDriver {
        users: Arc<Mutex<HashMap<UserIdentity, i64>>>,
        user_roles: Arc<Mutex<HashMap<i64, HashSet<TestBuiltinRole>>>>,
    }

    #[tokio::test]
    async fn superuser() {
        let storage = MockStorageDriver::default();
        let authorizer = Authorizer::new_superuser(storage);
        assert!(authorizer.is_superuser());
        // Check that the superuser has any role even if not explicitely granted
        assert_eq!(
            authorizer
                .check_roles(HashSet::from([TestBuiltinRole::UserBan]))
                .await,
            Ok(true)
        );
    }

    #[tokio::test]
    async fn check_roles() {
        let storage = MockStorageDriver::default();

        // insert some mocked roles
        {
            let mut user_roles = storage.user_roles.lock().unwrap();
            user_roles.insert(
                0,
                HashSet::from([
                    TestBuiltinRole::DocRead,
                    TestBuiltinRole::UserAdd,
                    TestBuiltinRole::UserBan,
                ]),
            );
        }

        let authorizer = Authorizer::try_initialize(
            UserInfo {
                identity: "toto".to_owned(),
                name: "Sir Toto, the One and Only".to_owned(),
            },
            storage,
        )
        .await
        .unwrap();

        {
            let users = authorizer.storage.users.lock().unwrap();
            assert_eq!(
                users.iter().next(),
                Some((&"toto".to_owned(), &0)),
                "new user should have been created"
            );
        }

        assert!(authorizer
            .check_roles(HashSet::from([TestBuiltinRole::DocRead]))
            .await
            .unwrap());
        assert!(authorizer
            .check_roles(HashSet::from([
                TestBuiltinRole::UserAdd,
                TestBuiltinRole::UserBan
            ]))
            .await
            .unwrap());
        assert!(authorizer
            .check_roles(HashSet::from([
                TestBuiltinRole::DocRead,
                TestBuiltinRole::UserAdd,
                TestBuiltinRole::UserBan
            ]))
            .await
            .unwrap());

        assert!(!authorizer
            .check_roles(HashSet::from([TestBuiltinRole::DocEdit]))
            .await
            .unwrap());
        assert!(!authorizer
            .check_roles(HashSet::from([
                TestBuiltinRole::DocRead,
                TestBuiltinRole::DocDelete,
            ]))
            .await
            .unwrap());

        assert!(authorizer.check_roles(HashSet::from([])).await.unwrap());
    }

    impl StorageDriver for MockStorageDriver {
        type BuiltinRole = TestBuiltinRole;
        type Error = Infallible;

        async fn ensure_user(&self, user: &UserInfo) -> Result<i64, Self::Error> {
            let mut users = self.users.lock().unwrap();
            let next_id = users.len() as i64;
            let user_id = users.entry(user.identity.clone()).or_insert(next_id);
            Ok(*user_id)
        }

        async fn fetch_subject_roles(
            &self,
            subject_id: i64,
        ) -> Result<HashSet<Self::BuiltinRole>, Self::Error> {
            let user_roles = self.user_roles.lock().unwrap();
            let roles = user_roles.get(&subject_id).cloned().expect("no user");
            Ok(roles)
        }

        async fn ensure_subject_roles(
            &self,
            subject_id: i64,
            roles: HashSet<Self::BuiltinRole>,
        ) -> Result<(), Self::Error> {
            let mut user_roles = self.user_roles.lock().unwrap();
            user_roles.entry(subject_id).or_default().extend(roles);
            Ok(())
        }

        async fn remove_subject_roles(
            &self,
            subject_id: i64,
            roles: HashSet<Self::BuiltinRole>,
        ) -> Result<HashSet<Self::BuiltinRole>, Self::Error> {
            let mut user_roles = self.user_roles.lock().unwrap();
            let user_roles = user_roles.entry(subject_id).or_default();
            let removed_roles = roles
                .iter()
                .filter(|role| user_roles.remove(*role))
                .cloned()
                .collect();
            Ok(removed_roles)
        }

        async fn get_user_id(
            &self,
            user_identity: &UserIdentity,
        ) -> Result<Option<i64>, Self::Error> {
            Ok(self.users.lock().unwrap().get(user_identity).copied())
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
    }
}
