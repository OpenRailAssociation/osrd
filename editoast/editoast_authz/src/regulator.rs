use std::collections::HashSet;
use std::future::Future;

use fga::fga;
use fga::model::Relation;
use futures::stream;
use tracing::Level;

use crate::model;
use crate::model::*;
use crate::subject::GroupInfo;
use crate::subject::GroupName;
use crate::subject::User as UserSubject;
use crate::subject::UserIdentity;
use crate::subject::UserInfo;
use crate::Error;
use crate::Role;

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

    async fn get_user_info_by_identity(
        &self,
        user_identity: &UserIdentity,
    ) -> Result<Option<UserSubject>, Self::Error> {
        let Some(user_id) = self.get_user_id(user_identity).await? else {
            return Ok(None);
        };
        Ok(self
            .get_user_info(user_id)
            .await?
            .map(|info| UserSubject { id: user_id, info }))
    }

    fn ensure_user(
        &self,
        user: &UserInfo,
    ) -> impl Future<Output = Result<UserSubject, Self::Error>> + Send;

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
    pub async fn user_roles(&self, user_id: i64) -> Result<HashSet<Role>, Error<S::Error>> {
        // no need to check for user inexistence, an empty set will be returned in this case
        let roles = Role::list_roles(&self.openfga, User::role(), &fga!(User:user_id)).await?;
        Ok(roles.into_iter().collect())
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn group_roles(&self, group_id: i64) -> Result<HashSet<Role>, Error<S::Error>> {
        // no need to check for group inexistence, an empty set will be returned in this case
        let roles = Role::list_roles(&self.openfga, Group::role(), &fga!(Group:group_id)).await?;
        Ok(roles.into_iter().collect())
    }

    #[tracing::instrument(skip_all, fields(user_id, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn grant_user_roles(
        &self,
        user_id: i64,
        roles: HashSet<Role>,
    ) -> Result<(), Error<S::Error>> {
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }
        let user = fga!(User:user_id);
        let mut writes = self.openfga.prepare_writes();
        let existing_roles = self.user_roles(user_id).await?;
        for role in roles.difference(&existing_roles) {
            writes.push(&User::role().tuple(&model::Role::from(*role), &user));
        }
        writes.execute().await?;
        Ok(())
    }

    #[tracing::instrument(skip_all, fields(user_id, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn revoke_user_roles(
        &self,
        user_id: i64,
        roles: HashSet<Role>,
    ) -> Result<(), Error<S::Error>> {
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }
        let user = fga!(User:user_id);
        let mut deletes = self.openfga.prepare_deletes();
        let existing_roles = self.user_roles(user_id).await?;
        for role in roles.intersection(&existing_roles) {
            deletes.push(&User::role().tuple(&model::Role::from(*role), &user));
        }
        deletes.execute().await?;
        Ok(())
    }

    #[tracing::instrument(skip_all, fields(group_id, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn grant_group_roles(
        &self,
        group_id: i64,
        roles: HashSet<Role>,
    ) -> Result<(), Error<S::Error>> {
        if !self.group_exists(group_id).await? {
            return Err(Error::UnknownSubject(group_id));
        }
        let group = fga!(Group:group_id);
        let mut writes = self.openfga.prepare_writes();
        let existing_roles = self.group_roles(group_id).await?;
        for role in roles.difference(&existing_roles) {
            writes.push(&Group::role().tuple(&model::Role::from(*role), &group));
        }
        writes.execute().await?;
        Ok(())
    }

    #[tracing::instrument(skip_all, fields(group_id, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn revoke_group_roles(
        &self,
        group_id: i64,
        roles: HashSet<Role>,
    ) -> Result<(), Error<S::Error>> {
        if !self.group_exists(group_id).await? {
            return Err(Error::UnknownSubject(group_id));
        }
        let group = fga!(Group:group_id);
        let mut deletes = self.openfga.prepare_deletes();
        let existing_roles = self.group_roles(group_id).await?;
        for role in roles.intersection(&existing_roles) {
            deletes.push(&Group::role().tuple(&model::Role::from(*role), &group));
        }
        deletes.execute().await?;
        Ok(())
    }

    #[tracing::instrument(skip(self), fields(%user_id, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn check_roles(
        &self,
        user_id: i64,
        roles: HashSet<Role>,
    ) -> Result<bool, Error<S::Error>> {
        // checks will fail if the user doesn't exist, so no need to query the DB
        if roles.is_empty() {
            return Ok(true);
        }
        let user_roles = self.user_roles(user_id).await?;
        if !roles.is_disjoint(&user_roles) {
            return Ok(true);
        }
        if user_roles.contains(&Role::Admin) {
            tracing::info!(user_id, "role check bypassed for admin");
            return Ok(true);
        }
        Ok(false)
    }
}
