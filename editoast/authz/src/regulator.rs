use std::collections::HashSet;
use std::future::Future;

use fga::model::Relation as _;
use tracing::Level;

use crate::Authorization;
use crate::Error;
use crate::Role;
use crate::identity::GroupInfo;
use crate::identity::User as UserSubject;
use crate::identity::UserIdentity;
use crate::identity::UserInfo;
use crate::identity::UserName;
use crate::model;
use crate::model::*;

/// Entry point for managing authorizations (roles and grants)
///
/// Works by interacting with both an (OpenFGA client)[fga::Client] and a [StorageDriver].
///
/// It differs from an [Authorizer](crate::authorizer::Authorizer) in that the latter's API targets a single authenticated user.
#[derive(Clone)]
pub struct Regulator<S: StorageDriver> {
    pub(crate) openfga: fga::Client,
    pub(crate) driver: S,
}

/// A sans-IO style interface the [Regulator] uses to interact with the user and group storage layer
pub trait StorageDriver: Clone {
    type Error: std::error::Error;

    #[deprecated(note = "use editoast_models::User::retrieve_by_identity instead")]
    fn get_user_id(
        &self,
        user_identity: &UserIdentity,
    ) -> impl Future<Output = Result<Option<i64>, Self::Error>> + Send;

    #[deprecated(note = "use editoast_models::User directly")]
    fn get_user_info(
        &self,
        user_id: i64,
    ) -> impl Future<Output = Result<Option<UserInfo>, Self::Error>> + Send;

    #[deprecated(note = "use editoast_models::Group::retrieve directly")]
    fn get_group_info(
        &self,
        group_id: i64,
    ) -> impl Future<Output = Result<Option<GroupInfo>, Self::Error>> + Send;

    #[deprecated = "use the database directly"]
    async fn get_user_info_by_identity(
        &self,
        user_identity: &UserIdentity,
    ) -> Result<Option<UserSubject>, Self::Error> {
        #[expect(deprecated)]
        let Some(user_id) = self.get_user_id(user_identity).await? else {
            return Ok(None);
        };
        #[expect(deprecated)]
        Ok(self
            .get_user_info(user_id)
            .await?
            .map(|info| UserSubject { id: user_id, info }))
    }

    #[deprecated = "use editoast_models::User::register instead"]
    fn ensure_user(
        &self,
        user_name: &UserName,
        user: &UserIdentity,
    ) -> impl Future<Output = Result<UserSubject, Self::Error>> + Send;

    fn infra_exists(&self, infra_id: i64)
    -> impl Future<Output = Result<bool, Self::Error>> + Send;
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
        #[expect(deprecated)]
        self.driver
            .get_user_info(user_id)
            .await
            .map(|x| x.is_some())
            .map_err(Error::Storage)
    }

    /// Returns whether a group with some id exists
    #[tracing::instrument(skip_all, fields(group_id = %group_id), ret(level = Level::DEBUG), err)]
    pub async fn group_exists(&self, group_id: i64) -> Result<bool, Error<S::Error>> {
        #[expect(deprecated)] // to be removed soon
        self.driver
            .get_group_info(group_id)
            .await
            .map(|x| x.is_some())
            .map_err(Error::Storage)
    }

    pub async fn subject_exists(&self, subject: &Subject) -> Result<bool, Error<S::Error>> {
        match subject {
            Subject::User(user) => self.user_exists(user.0).await,
            Subject::Group(group) => self.group_exists(group.0).await,
        }
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn user_roles(&self, user: &User) -> Result<HashSet<Role>, Error<S::Error>> {
        // no need to check for user inexistence, an empty set will be returned in this case
        let roles = Role::list_roles(&self.openfga, model::User::role(), user).await?;
        Ok(roles.into_iter().collect())
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn group_roles(&self, group: &Group) -> Result<HashSet<Role>, Error<S::Error>> {
        // no need to check for group inexistence, an empty set will be returned in this case
        let roles = Role::list_roles(&self.openfga, Group::role(), group).await?;
        Ok(roles.into_iter().collect())
    }

    #[tracing::instrument(skip(self), fields(user, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn check_roles(
        &self,
        user: &User,
        roles: HashSet<Role>,
    ) -> Result<bool, Error<S::Error>> {
        // checks will fail if the user doesn't exist, so no need to query the DB
        if roles.is_empty() {
            return Ok(true);
        }
        let user_roles = self.user_roles(user).await?;
        if !roles.is_disjoint(&user_roles) {
            return Ok(true);
        }
        if user_roles.contains(&Role::Admin) {
            tracing::info!(user_id = user.0, "role check bypassed for admin");
            return Ok(true);
        }
        Ok(false)
    }

    pub async fn is_admin(&self, user: &User) -> Result<bool, Error<S::Error>> {
        let user_roles = self.user_roles(user).await?;
        Ok(user_roles.contains(&Role::Admin))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn authorize_infra(
        &self,
        user: &User,
        infra: &Infra,
        privilege: InfraPrivilege,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra.0)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra.0));
        }

        // Check if user exists
        if !self.user_exists(user.0).await? {
            return Err(Error::UnknownSubject(user.0));
        }

        // Bypass if user is an admin
        if self.is_admin(user).await? {
            return Ok(Authorization::Bypassed);
        }

        // Calling openfga with the appropriate privilege check
        let check = match privilege {
            InfraPrivilege::CanRead => {
                self.openfga
                    .check(model::Infra::can_read().check(user, infra))
                    .await?
            }
            InfraPrivilege::CanWrite => {
                self.openfga
                    .check(model::Infra::can_write().check(user, infra))
                    .await?
            }
            InfraPrivilege::CanDelete => {
                self.openfga
                    .check(model::Infra::can_delete().check(user, infra))
                    .await?
            }
            InfraPrivilege::CanShareRead => {
                self.openfga
                    .check(model::Infra::can_share_read().check(user, infra))
                    .await?
            }
            InfraPrivilege::CanShareWrite => {
                self.openfga
                    .check(model::Infra::can_share_write().check(user, infra))
                    .await?
            }
            InfraPrivilege::CanShareOwnership => {
                self.openfga
                    .check(model::Infra::can_share_ownership().check(user, infra))
                    .await?
            }
            InfraPrivilege::CanRevoke => {
                self.openfga
                    .check(model::Infra::can_revoke().check(user, infra))
                    .await?
            }
        };
        Ok(Authorization::from_privilege_check(check))
    }
}
