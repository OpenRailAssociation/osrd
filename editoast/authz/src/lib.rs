mod authorizer;
pub mod identity;
mod model;
mod regulator;
pub mod v2;

pub use authorizer::Authorizer;
pub use regulator::Regulator;
pub use regulator::StorageDriver;

pub use model::Group;
pub use model::Infra;
pub use model::InfraGrant;
pub use model::InfraPrivilege;
pub use model::Project;
pub use model::ProjectGrant;
pub use model::ProjectPrivilege;
pub use model::Role;
pub use model::RollingStock;
pub use model::RollingStockGrant;
pub use model::RollingStockPrivilege;
pub use model::Subject;
pub use model::User;

/// An authorization error that can originate from either the OpenFGA client or the storage driver
#[derive(Debug, thiserror::Error)]
pub enum Error<StorageError: std::error::Error> {
    #[error("unknown subject {0}")]
    UnknownSubject(i64),
    #[error("unknown resource {0}")]
    UnknownResource(i64),
    #[error("unknown user {identity}")]
    UnknownUser { identity: String },
    #[error(transparent)]
    OpenFga(#[from] fga::client::Error),
    #[error(transparent)]
    Storage(StorageError),
}

/// A representation of an authorization decision over some resource
#[derive(derive_more::Debug, derive_more::Display)]
pub enum Authorization<T> {
    /// The initiator of the authorization is allowed to access the resource
    Granted(T),
    /// The initiator of the authorization is an admin and bypassed the authorization checks
    Bypassed,
    /// The initiator of the authorization is denied access to the resource
    Denied { reason: &'static str },
}

#[derive(Debug, thiserror::Error)]
#[error("Unauthorized (reason: {reason})")]
pub struct Unauthorized {
    pub reason: &'static str,
}

impl Authorization<()> {
    pub fn allowed(self) -> Result<(), Unauthorized> {
        match self {
            Authorization::Granted(()) | Authorization::Bypassed => Ok(()),
            Authorization::Denied { reason } => Err(Unauthorized { reason }),
        }
    }

    pub async fn allowed_then_try<U, E>(
        self,
        f: impl AsyncFnOnce() -> Result<Authorization<U>, E>,
    ) -> Result<Authorization<U>, E> {
        match self {
            Authorization::Granted(()) => f().await,
            Authorization::Bypassed => f().await,
            Authorization::Denied { reason } => Ok(Authorization::Denied { reason }),
        }
    }
}

impl<T> Authorization<T> {
    pub fn denied(&self) -> bool {
        matches!(self, Self::Denied { .. })
    }
}

impl<T: std::fmt::Debug> Authorization<T> {
    #[track_caller]
    pub fn expect_allowed(self, reason: &'static str) -> T {
        match self {
            Authorization::Granted(value) => value,
            other => panic!("expected Authorization::Granted, got {other:?}: {reason}"),
        }
    }

    #[track_caller]
    pub fn expect_denied(self, reason: &'static str) -> &'static str {
        match self {
            Authorization::Denied { reason } => reason,
            other => panic!("expected Authorization::Denied, got {other:?}: {reason}"),
        }
    }
}

#[cfg(test)]
macro_rules! authz_client {
    () => {{
        let client_authz = fga::test_client!("authz@");
        let client_migrations = fga::test_client!("migrations@");
        fga_migrations::run_migrations(
            client_authz.clone(),
            client_migrations,
            fga_migrations::TargetMigration::Latest,
        )
        .await
        .expect("Failed to initialize/update the authorization model");
        client_authz
    }};
}

#[cfg(test)]
use authz_client;

#[cfg(test)]
mod mock_driver {
    use std::collections::HashMap;
    use std::collections::HashSet;
    use std::convert::Infallible;
    use std::sync::Arc;
    use std::sync::Mutex;
    use std::sync::RwLock;

    use crate::InfraGrant;
    use crate::Regulator;
    use crate::Role;
    use crate::StorageDriver;
    use crate::identity::GroupInfo;
    use crate::identity::GroupName;
    use crate::identity::User;
    use crate::identity::UserIdentity;
    use crate::identity::UserInfo;
    use crate::identity::UserName;
    use crate::model;
    use crate::v2;
    use crate::v2::TestClientExt as _;

    #[derive(Debug, Clone, Default)]
    pub struct MockAuthDriver {
        counter: Arc<RwLock<i64>>,
        pub users: Arc<Mutex<HashMap<UserIdentity, i64>>>,
        groups: Arc<Mutex<HashMap<GroupName, i64>>>,
    }

    // Concise test utilities
    impl Regulator<MockAuthDriver> {
        pub async fn create_user(&self, identity: &str, name: &str) -> model::User {
            model::User(
                #[expect(deprecated)] // soon to be removed
                self.driver
                    .ensure_user(&name.to_string(), &identity.to_string())
                    .await
                    .expect("user creation should succeed")
                    .id,
            )
        }

        pub async fn set_role(&self, user: model::User, role: Role) {
            v2::add_roles(user.into(), HashSet::from([role]))
                .authorize(&v2::special_authorizers::Authorize(self.openfga()))
                .await
                .expect("role set should succeed")
                .unwrap_authorized()
                .await;
        }

        pub async fn get_infra_grant(
            &self,
            user: model::User,
            infra: model::Infra,
        ) -> Option<InfraGrant> {
            self.openfga()
                .infra_effective_grant(user.into(), infra)
                .await
        }

        pub async fn set_infra_grant(
            &self,
            user: model::User,
            infra: model::Infra,
            grant: InfraGrant,
        ) {
            v2::infra_set_grant(user.into(), infra, grant)
                .authorize(&v2::special_authorizers::Authorize(self.openfga()))
                .await
                .expect("infra grant set should succeed")
                .unwrap_authorized()
                .await;
        }

        pub async fn assert_infra_grant_eq(
            &self,
            user: model::User,
            infra: model::Infra,
            grant: Option<InfraGrant>,
        ) {
            let actual_grant = self.get_infra_grant(user, infra).await;
            assert_eq!(actual_grant, grant);
        }

        // https://en.wikipedia.org/wiki/Alice_and_Bob#Cast_of_characters

        /// Regular user
        pub async fn alice(&self) -> model::User {
            self.create_user("alice", "Alice").await
        }

        /// Regular user
        pub async fn bob(&self) -> model::User {
            self.create_user("bob", "Bob").await
        }

        /// Malicious user
        pub async fn chad(&self) -> model::User {
            self.create_user("chad", "Chad").await
        }

        /// Regular user
        pub async fn dave(&self) -> model::User {
            self.create_user("dave", "Dave").await
        }

        /// Admin user
        pub async fn walter(&self) -> model::User {
            let user = self.create_user("walter", "Walter").await;
            self.set_role(user, Role::Admin).await;
            user
        }
    }

    impl StorageDriver for MockAuthDriver {
        type Error = Infallible;

        async fn ensure_user(
            &self,
            user_name: &UserName,
            user_identity: &UserIdentity,
        ) -> Result<User, Self::Error> {
            let mut users = self.users.lock().unwrap();
            let user_id = {
                let id = self.counter.read().unwrap();
                users.entry(user_identity.clone()).or_insert(*id);
                *id
            };
            *self.counter.write().unwrap() += 1;
            Ok(User {
                id: user_id,
                info: UserInfo {
                    identities: vec![user_identity.to_owned()],
                    name: user_name.to_owned(),
                },
            })
        }

        async fn get_user_id(
            &self,
            user_identity: &UserIdentity,
        ) -> Result<Option<i64>, Self::Error> {
            Ok(self.users.lock().unwrap().get(user_identity).copied())
        }

        async fn get_user_info(&self, user_id: i64) -> Result<Option<UserInfo>, Self::Error> {
            let users = self.users.lock().unwrap();
            let identities = users
                .iter()
                .filter(|(_, id)| **id == user_id)
                .map(|(identity, _)| identity.clone())
                .collect::<Vec<_>>();
            if identities.is_empty() {
                return Ok(None);
            }
            Ok(Some(UserInfo {
                identities,
                name: "Mocked User".to_owned(),
            }))
        }

        async fn get_group_info(&self, group_id: i64) -> Result<Option<GroupInfo>, Self::Error> {
            let groups = self.groups.lock().unwrap();
            let group_info = groups
                .iter()
                .find(|(_, id)| **id == group_id)
                .map(|(name, _)| GroupInfo { name: name.clone() });
            Ok(group_info)
        }

        async fn infra_exists(&self, _infra_id: i64) -> Result<bool, Self::Error> {
            // Mock implementation, always return true
            Ok(true)
        }
    }
}
