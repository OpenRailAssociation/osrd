use std::collections::HashSet;
use std::future::Future;

use fga::client::UserList;
use fga::fga;
use fga::model::Relation;
use futures::stream;
use tracing::Level;

use crate::Authorization;
use crate::Error;
use crate::Role;
use crate::model;
use crate::model::*;
use crate::subject::GroupInfo;
use crate::subject::GroupName;
use crate::subject::User as UserSubject;
use crate::subject::UserIdentity;
use crate::subject::UserInfo;

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

    /// Returns the IDs of the groups for the provided user
    #[tracing::instrument(skip_all, fields(user_id, group_id), ret(level = Level::DEBUG), err)]
    pub async fn user_groups(&self, user_id: i64) -> Result<HashSet<i64>, Error<S::Error>> {
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }
        let user = fga!(User:user_id);
        let groups = self
            .openfga
            .list_users(User::group().query_users(&user))
            .await?;
        Ok(groups
            .users
            .into_iter()
            .filter_map(|Group(group)| match group.parse() {
                Ok(id) => Some(id),
                Err(_) => {
                    tracing::error!(group, "unparsable group - skipping it");
                    None
                }
            })
            .collect())
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
        let roles =
            Role::list_roles(&self.openfga, model::User::role(), &fga!(User:user_id)).await?;
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

    pub async fn is_admin(&self, user_id: i64) -> Result<bool, Error<S::Error>> {
        let user_roles = self.user_roles(user_id).await?;
        Ok(user_roles.contains(&Role::Admin))
    }

    pub async fn check_infra_grant_reader(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<bool, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        // Calling openfga
        let user = fga!(User:user_id);
        let infra = fga!(Infra:infra_id);
        let result = self
            .openfga
            .check(model::Infra::reader().check(&user, &infra))
            .await?;
        Ok(result)
    }

    pub async fn check_infra_grant_writer(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<bool, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        // Calling openfga
        let user = fga!(User:user_id);
        let infra = fga!(Infra:infra_id);
        let result = self
            .openfga
            .check(model::Infra::writer().check(&user, &infra))
            .await?;
        Ok(result)
    }

    pub async fn check_infra_grant_owner(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<bool, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        // Calling openfga
        let user = fga!(User:user_id);
        let infra = fga!(Infra:infra_id);
        let result = self
            .openfga
            .check(model::Infra::owner().check(&user, &infra))
            .await?;
        Ok(result)
    }

    pub async fn authorize_infra_read(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        // Bypass if user is an admin
        if self.is_admin(user_id).await? {
            return Ok(Authorization::Bypassed(()));
        }

        // Calling openfga
        let user = fga!(User:user_id);
        let infra = fga!(Infra:infra_id);
        let check = self
            .openfga
            .check(model::Infra::can_read().check(&user, &infra))
            .await?;
        Ok(Authorization::from_privilege_check(check))
    }

    pub async fn check_infra_privilege_can_share_read(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<bool, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        // Bypass if user is an admin
        if self.check_roles(user_id, [Role::Admin].into()).await? {
            return Ok(true);
        }

        // Calling openfga
        let user = fga!(User:user_id);
        let infra = fga!(Infra:infra_id);
        let result = self
            .openfga
            .check(model::Infra::can_share_read().check(&user, &infra))
            .await?;
        Ok(result)
    }

    pub async fn check_infra_privilege_can_share_write(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<bool, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        // Bypass if user is an admin
        if self.check_roles(user_id, [Role::Admin].into()).await? {
            return Ok(true);
        }

        // Calling openfga
        let user = fga!(User:user_id);
        let infra = fga!(Infra:infra_id);
        let result = self
            .openfga
            .check(model::Infra::can_share_write().check(&user, &infra))
            .await?;
        Ok(result)
    }

    pub async fn check_infra_privilege_can_share_ownership(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<bool, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        // Bypass if user is an admin
        if self.check_roles(user_id, [Role::Admin].into()).await? {
            return Ok(true);
        }

        // Calling openfga
        let user = fga!(User:user_id);
        let infra = fga!(Infra:infra_id);
        let result = self
            .openfga
            .check(model::Infra::can_share_ownership().check(&user, &infra))
            .await?;
        Ok(result)
    }

    pub async fn get_infra_readers(
        &self,
        infra_id: i64,
    ) -> Result<Vec<UserSubject>, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        let infra = fga!(Infra:infra_id);
        let result = self
            .openfga
            .list_users(Infra::reader().query_users(&infra))
            .await?;

        let users = self.parse_userlist(result).await?;
        Ok(users)
    }

    pub async fn get_infra_writers(
        &self,
        infra_id: i64,
    ) -> Result<Vec<UserSubject>, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        let infra = fga!(Infra:infra_id);
        let result = self
            .openfga
            .list_users(Infra::writer().query_users(&infra))
            .await?;

        let users = self.parse_userlist(result).await?;
        Ok(users)
    }

    pub async fn get_infra_owners(
        &self,
        infra_id: i64,
    ) -> Result<Vec<UserSubject>, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        let infra = fga!(Infra:infra_id);
        let result = self
            .openfga
            .list_users(Infra::owner().query_users(&infra))
            .await?;

        let users = self.parse_userlist(result).await?;
        Ok(users)
    }

    async fn parse_userlist(
        &self,
        userlist: UserList<User>,
    ) -> Result<Vec<UserSubject>, Error<S::Error>> {
        let user_ids =
            userlist
                .users
                .into_iter()
                .filter_map(|User(user)| match user.parse::<i64>() {
                    Ok(id) => Some(id),
                    Err(_) => {
                        tracing::error!(user, "unparsable user member — skipping it");
                        None
                    }
                });

        let mut users = Vec::new();
        for user_id in user_ids {
            let user_info = self
                .driver
                .get_user_info(user_id)
                .await
                .map_err(Error::Storage)?;

            if let Some(user_info) = user_info {
                users.push(UserSubject {
                    id: user_id,
                    info: user_info,
                });
            }
        }
        Ok(users)
    }

    pub async fn grant_infra_reader_unchecked(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        let has_grant = self.check_infra_grant_reader(user_id, infra_id).await?;
        if !has_grant {
            // Remove other grants before to add the new one
            self.revoke_infra_writer_unchecked(user_id, infra_id)
                .await?;
            self.revoke_infra_owner_unchecked(user_id, infra_id).await?;
            // Grant the new one
            let user = fga!(User:user_id);
            let infra = fga!(Infra:infra_id);
            self.openfga
                .prepare_writes()
                .write(&Infra::reader().tuple(&user, &infra))
                .execute()
                .await?;
        }

        Ok(())
    }

    pub async fn grant_infra_reader(
        &self,
        issuer_id: i64,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check that issuer has the right to add the grants
        let can_share = self
            .check_infra_privilege_can_share_read(issuer_id, infra_id)
            .await?;
        if !can_share {
            return Err(Error::Unauthorized);
        }

        // Grant
        self.grant_infra_reader_unchecked(user_id, infra_id).await?;
        Ok(())
    }

    pub async fn grant_infra_writer_unchecked(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        let has_grant = self.check_infra_grant_writer(user_id, infra_id).await?;
        if !has_grant {
            // Remove other grants before to add the new one
            self.revoke_infra_reader_unchecked(user_id, infra_id)
                .await?;
            self.revoke_infra_owner_unchecked(user_id, infra_id).await?;
            // Grant the new one
            let user = fga!(User:user_id);
            let infra = fga!(Infra:infra_id);
            self.openfga
                .prepare_writes()
                .write(&Infra::writer().tuple(&user, &infra))
                .execute()
                .await?;
        }

        Ok(())
    }
    pub async fn grant_infra_writer(
        &self,
        issuer_id: i64,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check that issuer has the right to add the grants
        let can_share = self
            .check_infra_privilege_can_share_write(issuer_id, infra_id)
            .await?;
        if !can_share {
            return Err(Error::Unauthorized);
        }

        // Grant
        self.grant_infra_writer_unchecked(user_id, infra_id).await?;
        Ok(())
    }

    pub async fn grant_infra_owner_unchecked(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        let has_grant = self.check_infra_grant_owner(user_id, infra_id).await?;
        if !has_grant {
            // Remove other grants before to add the new one
            self.revoke_infra_reader_unchecked(user_id, infra_id)
                .await?;
            self.revoke_infra_writer_unchecked(user_id, infra_id)
                .await?;
            // Grant the new one
            let user = fga!(User:user_id);
            let infra = fga!(Infra:infra_id);
            self.openfga
                .prepare_writes()
                .write(&Infra::owner().tuple(&user, &infra))
                .execute()
                .await?;
        }

        Ok(())
    }

    pub async fn grant_infra_owner(
        &self,
        issuer_id: i64,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check that issuer has the right to add the grants
        let can_share = self
            .check_infra_privilege_can_share_ownership(issuer_id, infra_id)
            .await?;
        if !can_share {
            return Err(Error::Unauthorized);
        }

        // Grant
        self.grant_infra_owner_unchecked(user_id, infra_id).await?;
        Ok(())
    }

    pub async fn revoke_infra_reader_unchecked(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        // Check if the user has already the grant, if not, grant it
        let has_grant = self.check_infra_grant_reader(user_id, infra_id).await?;
        if has_grant {
            let user = fga!(User:user_id);
            let infra = fga!(Infra:infra_id);
            self.openfga
                .prepare_deletes()
                .delete(&Infra::reader().tuple(&user, &infra))
                .execute()
                .await?;
        }

        Ok(())
    }

    pub async fn revoke_infra_reader(
        &self,
        issuer_id: i64,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check that the connected user has the right to remove the grants
        let is_owner = self.check_infra_grant_owner(issuer_id, infra_id).await?;
        if !is_owner {
            return Err(Error::Unauthorized);
        }

        // Revoke
        self.revoke_infra_reader_unchecked(user_id, infra_id)
            .await?;
        Ok(())
    }

    pub async fn revoke_infra_writer_unchecked(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        let has_grant = self.check_infra_grant_writer(user_id, infra_id).await?;
        if has_grant {
            let user = fga!(User:user_id);
            let infra = fga!(Infra:infra_id);
            self.openfga
                .prepare_deletes()
                .delete(&Infra::writer().tuple(&user, &infra))
                .execute()
                .await?;
        }

        Ok(())
    }

    pub async fn revoke_infra_writer(
        &self,
        issuer_id: i64,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check that the connected user has the right to remove the grants
        let is_owner = self.check_infra_grant_owner(issuer_id, infra_id).await?;
        if !is_owner {
            return Err(Error::Unauthorized);
        }

        // Revoke
        self.revoke_infra_writer_unchecked(user_id, infra_id)
            .await?;
        Ok(())
    }

    pub async fn revoke_infra_owner_unchecked(
        &self,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra_id)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra_id));
        }

        // Check if user exists
        if !self.user_exists(user_id).await? {
            return Err(Error::UnknownSubject(user_id));
        }

        let has_grant = self.check_infra_grant_owner(user_id, infra_id).await?;
        if has_grant {
            let user = fga!(User:user_id);
            let infra = fga!(Infra:infra_id);
            self.openfga
                .prepare_deletes()
                .delete(&Infra::owner().tuple(&user, &infra))
                .execute()
                .await?;
        }

        Ok(())
    }

    pub async fn revoke_infra_owner(
        &self,
        issuer_id: i64,
        user_id: i64,
        infra_id: i64,
    ) -> Result<(), Error<S::Error>> {
        // Check that the connected user has the right to remove the grants
        let is_owner = self.check_infra_grant_owner(issuer_id, infra_id).await?;
        if !is_owner {
            return Err(Error::Unauthorized);
        }

        // Revoke
        self.revoke_infra_owner_unchecked(user_id, infra_id).await?;
        Ok(())
    }
}
