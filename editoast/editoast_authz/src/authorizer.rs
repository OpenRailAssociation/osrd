use itertools::Itertools as _;
use std::{collections::HashSet, future::Future, sync::Arc};

use tracing::debug;
use tracing::Level;

use crate::roles::{BuiltinRoleSet, RoleConfig, RoleIdentifier};

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
    pub roles_config: Arc<RoleConfig<S::BuiltinRole>>,
    user_roles: HashSet<S::BuiltinRole>,
    #[allow(unused)] // will be used soon
    storage: S,
}

pub trait StorageDriver: Clone {
    type BuiltinRole: BuiltinRoleSet + std::fmt::Debug;
    type Error: std::error::Error;

    fn get_user_id(
        &self,
        user_info: &UserInfo,
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
        roles_config: &RoleConfig<Self::BuiltinRole>,
    ) -> impl Future<Output = Result<HashSet<Self::BuiltinRole>, Self::Error>> + Send;

    fn ensure_subject_roles(
        &self,
        subject_id: i64,
        roles_config: &RoleConfig<Self::BuiltinRole>,
        roles: HashSet<Self::BuiltinRole>,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;

    fn remove_subject_roles(
        &self,
        subject_id: i64,
        roles_config: &RoleConfig<Self::BuiltinRole>,
        roles: HashSet<Self::BuiltinRole>,
    ) -> impl Future<Output = Result<HashSet<Self::BuiltinRole>, Self::Error>> + Send;
}

impl<S: StorageDriver> Authorizer<S> {
    #[tracing::instrument(skip_all, fields(%user, roles_config = %roles_config.as_ref()), err)]
    pub async fn try_initialize(
        user: UserInfo,
        roles_config: Arc<RoleConfig<S::BuiltinRole>>,
        storage_driver: S,
    ) -> Result<Self, S::Error> {
        let user_id = storage_driver.ensure_user(&user).await?;
        debug!(%user, %user_id, "user authenticated");
        let user_roles = storage_driver
            .fetch_subject_roles(user_id, roles_config.as_ref())
            .await?;
        Ok(Self {
            user,
            user_id,
            roles_config,
            user_roles,
            storage: storage_driver,
        })
    }

    pub fn new_superuser(roles_config: Arc<RoleConfig<S::BuiltinRole>>, storage_driver: S) -> Self {
        debug_assert!(
            roles_config.is_superuser(),
            "Authorizer::new_superuser requires a superuser role config"
        );
        Self {
            user: UserInfo {
                identity: "superuser".to_string(),
                name: "Super User".to_string(),
            },
            user_id: -1,
            roles_config,
            user_roles: Default::default(),
            storage: storage_driver,
        }
    }

    pub fn user_id(&self) -> i64 {
        self.user_id
    }

    pub fn is_superuser(&self) -> bool {
        self.roles_config.is_superuser() || self.user_roles.contains(&S::BuiltinRole::superuser())
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
    pub async fn infer_application_roles(
        &self,
        user_id: i64,
    ) -> Result<Vec<RoleIdentifier>, S::Error> {
        if self.is_superuser() {
            return Ok(self.roles_config.application_roles().cloned().collect_vec());
        }

        let resolved_roles = &self.roles_config.resolved_roles;
        let user_roles = self
            .storage
            .fetch_subject_roles(user_id, &self.roles_config)
            .await?;

        let app_roles = resolved_roles
            .iter()
            .filter(|(_, builtins)| user_roles.is_superset(builtins))
            .map(|(app_role, _)| app_role)
            .cloned()
            .collect_vec();

        Ok(app_roles)
    }

    #[tracing::instrument(skip_all, fields(user_id, auth_user = %self.user, user_roles = ?self.user_roles), ret(level = Level::DEBUG), err)]
    pub async fn user_builtin_roles(
        &self,
        user_id: i64,
    ) -> Result<HashSet<S::BuiltinRole>, S::Error> {
        let user_roles = self
            .storage
            .fetch_subject_roles(user_id, &self.roles_config)
            .await?;
        Ok(user_roles.clone())
    }

    #[tracing::instrument(skip_all, fields(user_id, auth_user = %self.user, ?roles, role_config = ?self.roles_config), ret(level = Level::DEBUG), err)]
    pub async fn grant_roles(
        &mut self,
        user_id: i64,
        roles: HashSet<S::BuiltinRole>,
    ) -> Result<(), S::Error> {
        self.storage
            .ensure_subject_roles(user_id, &self.roles_config, roles.clone())
            .await?;
        self.user_roles.extend(roles);
        Ok(())
    }

    #[tracing::instrument(skip_all, fields(user_id, auth_user = %self.user, ?roles, role_config = ?self.roles_config), ret(level = Level::DEBUG), err)]
    pub async fn strip_roles(
        &mut self,
        user_id: i64,
        roles: HashSet<S::BuiltinRole>,
    ) -> Result<(), S::Error> {
        let removed_roles = self
            .storage
            .remove_subject_roles(user_id, &self.roles_config, roles.clone())
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
            .field("roles_config", &self.roles_config)
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
        let config = RoleConfig::new_superuser();
        let storage = MockStorageDriver::default();
        let authorizer = Authorizer::new_superuser(config.into(), storage);
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
        let config = default_test_config();
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
            config.into(),
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
            .check_roles(HashSet::from([TestBuiltinRole::DocEdit,]))
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
            _roles_config: &RoleConfig<Self::BuiltinRole>,
        ) -> Result<HashSet<Self::BuiltinRole>, Self::Error> {
            let user_roles = self.user_roles.lock().unwrap();
            let roles = user_roles.get(&subject_id).cloned().expect("no user");
            Ok(roles)
        }

        async fn ensure_subject_roles(
            &self,
            subject_id: i64,
            _roles_config: &RoleConfig<Self::BuiltinRole>,
            roles: HashSet<Self::BuiltinRole>,
        ) -> Result<(), Self::Error> {
            let mut user_roles = self.user_roles.lock().unwrap();
            user_roles.entry(subject_id).or_default().extend(roles);
            Ok(())
        }

        async fn remove_subject_roles(
            &self,
            subject_id: i64,
            _roles_config: &RoleConfig<Self::BuiltinRole>,
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

        async fn get_user_id(&self, user_info: &UserInfo) -> Result<Option<i64>, Self::Error> {
            Ok(self.users.lock().unwrap().get(&user_info.identity).copied())
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
