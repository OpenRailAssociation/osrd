use std::collections::HashSet;
use tracing::Level;
use tracing::debug;

use crate::Authorization;
use crate::Error;
use crate::Infra;
use crate::Regulator;
use crate::Role;
use crate::StorageDriver;
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
        #[allow(deprecated)] // soon to be removed
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

    /// Check that the user has any of the required roles
    #[tracing::instrument(skip_all, fields(user = %self.user, ?roles), ret(level = Level::DEBUG))]
    pub async fn check_roles(&self, roles: HashSet<Role>) -> Result<bool, Error<S::Error>> {
        self.regulator.check_roles(&User(self.user_id), roles).await
    }

    pub async fn authorize_infra(
        &self,
        infra: &Infra,
        privilege: InfraPrivilege,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        self.regulator
            .authorize_infra(&User(self.user_id), infra, privilege)
            .await
    }

    pub async fn authorize_project(
        &self,
        project: &Project,
        privilege: ProjectPrivilege,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        self.regulator
            .authorize_project(&User(self.user_id), project, privilege)
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
