mod authorizer;
pub mod identity;
mod model;
mod regulator;

pub use authorizer::Authorizer;
pub use regulator::Regulator;
pub use regulator::StorageDriver;

pub use model::Group;
pub use model::Infra;
pub use model::InfraGrant;
pub use model::InfraPrivilege;
pub use model::Role;
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
    OpenFga(#[from] fga::client::RequestFailure),
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

impl<T: Default> Authorization<T> {
    #[inline]
    fn from_privilege_check(allowed: bool) -> Self {
        if allowed {
            Authorization::Granted(T::default())
        } else {
            Authorization::Denied {
                reason: "insufficient privileges",
            }
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

    use futures::stream;

    use crate::InfraGrant;
    use crate::Regulator;
    use crate::Role;
    use crate::StorageDriver;
    use crate::identity::GroupInfo;
    use crate::identity::GroupName;
    use crate::identity::User;
    use crate::identity::UserIdentity;
    use crate::identity::UserInfo;
    use crate::model;

    #[derive(Debug, Clone, Default)]
    pub struct MockAuthDriver {
        counter: Arc<RwLock<i64>>,
        pub users: Arc<Mutex<HashMap<UserIdentity, i64>>>,
        groups: Arc<Mutex<HashMap<GroupName, i64>>>,
    }

    // Synchronous one-liners to setup tests concisely
    impl Regulator<MockAuthDriver> {
        pub fn create_user(&self, identity: &str, name: &str) -> model::User {
            futures::executor::block_on(async {
                model::User(
                    self.driver
                        .ensure_user(&UserInfo {
                            identity: identity.to_owned(),
                            name: name.to_owned(),
                        })
                        .await
                        .expect("user creation should succeed")
                        .id,
                )
            })
        }

        pub fn set_role(&self, user: model::User, role: Role) {
            futures::executor::block_on(async {
                self.grant_user_roles(&user, HashSet::from([role]))
                    .await
                    .expect("role set should succeed")
            });
        }

        pub fn get_infra_grant(
            &self,
            user: model::User,
            infra: model::Infra,
        ) -> Option<InfraGrant> {
            futures::executor::block_on(async {
                self.infra_direct_grant(&user.into(), &infra)
                    .await
                    .expect("infra grant get should succeed")
            })
        }

        pub fn set_infra_grant(&self, user: model::User, infra: model::Infra, grant: InfraGrant) {
            futures::executor::block_on(async {
                self.give_infra_grant_unchecked(&user.into(), &infra, grant)
                    .await
                    .expect("infra grant set should succeed")
            });
        }

        pub fn revoke_infra_grant(&self, user: model::User, infra: model::Infra) {
            futures::executor::block_on(async {
                self.revoke_infra_grants_unchecked(&user.into(), &infra)
                    .await
                    .expect("infra grant revoke should succeed")
            });
        }

        #[track_caller]
        pub fn assert_infra_grant_eq(
            &self,
            user: model::User,
            infra: model::Infra,
            grant: Option<InfraGrant>,
        ) {
            let actual_grant = self.get_infra_grant(user, infra);
            assert_eq!(actual_grant, grant);
        }

        // https://en.wikipedia.org/wiki/Alice_and_Bob#Cast_of_characters

        /// Regular user
        pub fn alice(&self) -> model::User {
            self.create_user("alice", "Alice")
        }

        /// Regular user
        pub fn bob(&self) -> model::User {
            self.create_user("bob", "Bob")
        }

        /// Malicious user
        pub fn chad(&self) -> model::User {
            self.create_user("chad", "Chad")
        }

        /// Regular user
        pub fn dave(&self) -> model::User {
            self.create_user("dave", "Dave")
        }

        /// Admin user
        pub fn walter(&self) -> model::User {
            let user = self.create_user("walter", "Walter");
            self.set_role(user, Role::Admin);
            user
        }
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

        async fn delete_user(&self, user_id: i64) -> Result<bool, Self::Error> {
            let map = self.users.lock().unwrap();
            let user_identity = map
                .iter()
                .find_map(|(k, &v)| if v == user_id { Some(k) } else { None });

            let mut map = self.users.lock().unwrap();
            if let Some(identity) = user_identity {
                map.remove(identity);
                Ok(true)
            } else {
                Ok(false)
            }
        }

        async fn delete_group(&self, group_id: i64) -> Result<bool, Self::Error> {
            let groups = self.groups.lock().unwrap();

            let group_name = groups
                .iter()
                .find_map(|(k, &v)| if v == group_id { Some(k) } else { None });

            if let Some(name) = group_name {
                let mut groups = self.groups.lock().unwrap();
                groups.remove(name);
                Ok(true)
            } else {
                Ok(false)
            }
        }
    }
}
