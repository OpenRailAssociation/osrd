use std::collections::HashSet;
use std::future::Future;

use fga::client::QueryError;
use fga::client::UserList;
use fga::model::Relation;
use futures::stream;
use itertools::Either;
use tracing::Level;

use crate::Authorization;
use crate::Error;
use crate::Role;
use crate::identity::GroupInfo;
use crate::identity::GroupName;
use crate::identity::User as UserSubject;
use crate::identity::UserIdentity;
use crate::identity::UserInfo;
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
    #[tracing::instrument(skip_all, fields(user), ret(level = Level::DEBUG), err)]
    pub async fn user_groups(&self, user: &User) -> Result<HashSet<Group>, Error<S::Error>> {
        if !self.user_exists(user.0).await? {
            return Err(Error::UnknownSubject(user.0));
        }
        let groups = self
            .openfga
            .list_users(User::group().query_users(user))
            .await
            .map_err(QueryError::parsing_ok)?;
        Ok(groups.users.into_iter().collect())
    }

    /// Returns the IDs of the users which are members of the provided group
    #[tracing::instrument(skip_all, fields(group), ret(level = Level::DEBUG), err)]
    pub async fn group_members(&self, group: &Group) -> Result<HashSet<User>, Error<S::Error>> {
        if !self.group_exists(group.0).await? {
            return Err(Error::UnknownSubject(group.0));
        }
        let members = self
            .openfga
            .list_users(Group::member().query_users(group))
            .await
            .map_err(QueryError::parsing_ok)?;

        debug_assert!(
            members.public_access.is_none(),
            "we don't write public accesses for groups"
        );
        Ok(members.users.into_iter().collect())
    }

    /// Adds some users to a group
    #[tracing::instrument(skip_all, fields(group, ?members), ret(level = Level::DEBUG), err)]
    pub async fn add_members(
        &self,
        group: &Group,
        members: HashSet<User>,
    ) -> Result<(), Error<S::Error>> {
        let existing_members = self.group_members(group).await?;
        let new_members = members.difference(&existing_members);
        let mut writes = self.openfga.prepare_writes();
        for user in new_members {
            if !self.user_exists(user.0).await? {
                return Err(Error::UnknownSubject(user.0));
            }
            writes.push(&Group::member().tuple(user, group));
            writes.push(&User::group().tuple(group, user));
        }
        writes.execute().await?;
        Ok(())
    }

    /// Removes some users from a group
    #[tracing::instrument(skip_all, fields(group, ?members), ret(level = Level::DEBUG), err)]
    pub async fn remove_members(
        &self,
        group: &Group,
        members: &HashSet<User>,
    ) -> Result<(), Error<S::Error>> {
        let existing_members = self.group_members(group).await?;
        let members = members.intersection(&existing_members);
        let mut deletes = self.openfga.prepare_deletes();
        for user in members {
            deletes.push(&Group::member().tuple(user, group));
            deletes.push(&User::group().tuple(group, user));
        }
        deletes.execute().await?;
        Ok(())
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

    #[tracing::instrument(skip_all, fields(user, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn grant_user_roles(
        &self,
        user: &User,
        roles: HashSet<Role>,
    ) -> Result<(), Error<S::Error>> {
        if !self.user_exists(user.0).await? {
            return Err(Error::UnknownSubject(user.0));
        }
        let mut writes = self.openfga.prepare_writes();
        let existing_roles = self.user_roles(user).await?;
        for role in roles.difference(&existing_roles) {
            writes.push(&User::role().tuple(role, user));
        }
        writes.execute().await?;
        Ok(())
    }

    #[tracing::instrument(skip_all, fields(user, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn revoke_user_roles(
        &self,
        user: &User,
        roles: HashSet<Role>,
    ) -> Result<(), Error<S::Error>> {
        if !self.user_exists(user.0).await? {
            return Err(Error::UnknownSubject(user.0));
        }
        let mut deletes = self.openfga.prepare_deletes();
        let existing_roles = self.user_roles(user).await?;
        for role in roles.intersection(&existing_roles) {
            deletes.push(&User::role().tuple(role, user));
        }
        deletes.execute().await?;
        Ok(())
    }

    #[tracing::instrument(skip_all, fields(group, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn grant_group_roles(
        &self,
        group: &Group,
        roles: HashSet<Role>,
    ) -> Result<(), Error<S::Error>> {
        if !self.group_exists(group.0).await? {
            return Err(Error::UnknownSubject(group.0));
        }
        let mut writes = self.openfga.prepare_writes();
        let existing_roles = self.group_roles(group).await?;
        for role in roles.difference(&existing_roles) {
            writes.push(&Group::role().tuple(role, group));
        }
        writes.execute().await?;
        Ok(())
    }

    #[tracing::instrument(skip_all, fields(group, ?roles), ret(level = Level::DEBUG), err)]
    pub async fn revoke_group_roles(
        &self,
        group: &Group,
        roles: HashSet<Role>,
    ) -> Result<(), Error<S::Error>> {
        if !self.group_exists(group.0).await? {
            return Err(Error::UnknownSubject(group.0));
        }
        let mut deletes = self.openfga.prepare_deletes();
        let existing_roles = self.group_roles(group).await?;
        for role in roles.intersection(&existing_roles) {
            deletes.push(&Group::role().tuple(role, group));
        }
        deletes.execute().await?;
        Ok(())
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
    pub async fn infra_privileges(
        &self,
        user: &User,
        infra: &Infra,
    ) -> Result<HashSet<InfraPrivilege>, Error<S::Error>> {
        if self.is_admin(user).await? {
            return Ok(HashSet::from([
                InfraPrivilege::CanRead,
                InfraPrivilege::CanShareRead,
                InfraPrivilege::CanWrite,
                InfraPrivilege::CanShareWrite,
                InfraPrivilege::CanDelete,
                InfraPrivilege::CanShareOwnership,
            ]));
        }

        let (can_read, can_share_read, can_write, can_share_write, can_delete, can_share_ownership) =
            self.openfga
                .checks((
                    Infra::can_read().check(user, infra),
                    Infra::can_share_read().check(user, infra),
                    Infra::can_write().check(user, infra),
                    Infra::can_share_write().check(user, infra),
                    Infra::can_delete().check(user, infra),
                    Infra::can_share_ownership().check(user, infra),
                ))
                .await?;
        let mut privileges = HashSet::new();
        privileges.extend(can_read.then_some(InfraPrivilege::CanRead));
        privileges.extend(can_share_read.then_some(InfraPrivilege::CanShareRead));
        privileges.extend(can_write.then_some(InfraPrivilege::CanWrite));
        privileges.extend(can_share_write.then_some(InfraPrivilege::CanShareWrite));
        privileges.extend(can_delete.then_some(InfraPrivilege::CanDelete));
        privileges.extend(can_share_ownership.then_some(InfraPrivilege::CanShareOwnership));
        Ok(privileges)
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn infra_grant(
        &self,
        user: &User,
        infra: &Infra,
    ) -> Result<Option<InfraGrant>, Error<S::Error>> {
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

        // Calling openfga
        let (is_reader, is_writer, is_owner) = self
            .openfga
            .checks((
                model::Infra::reader().check(user, infra),
                model::Infra::writer().check(user, infra),
                model::Infra::owner().check(user, infra),
            ))
            .await?;

        match (is_reader, is_writer, is_owner) {
            (true, false, false) => Ok(Some(InfraGrant::Reader)),
            (false, true, false) => Ok(Some(InfraGrant::Writer)),
            (false, false, true) => Ok(Some(InfraGrant::Owner)),
            (false, false, false) => Ok(None),
            _ => {
                tracing::error!(
                    is_reader,
                    is_writer,
                    is_owner,
                    ?user,
                    ?infra,
                    "User has multiple grants on the same resource"
                );
                panic!(
                    "User {user:?} has multiple grants on the same resource {infra:?}, which is not supposed to happen by design. \n\
                    Detected grants: reader: {is_reader}, writer: {is_writer}, owner: {is_owner}"
                )
            }
        }
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn authorize_infra_read(
        &self,
        user: &User,
        infra: &Infra,
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

        // Calling openfga
        let check = self
            .openfga
            .check(model::Infra::can_read().check(user, infra))
            .await?;
        Ok(Authorization::from_privilege_check(check))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn authorize_infra_write(
        &self,
        user: &User,
        infra: &Infra,
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

        // Calling openfga
        let check = self
            .openfga
            .check(model::Infra::can_write().check(user, infra))
            .await?;
        Ok(Authorization::from_privilege_check(check))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn authorize_infra_delete(
        &self,
        user: &User,
        infra: &Infra,
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

        // Calling openfga
        let check = self
            .openfga
            .check(model::Infra::can_delete().check(user, infra))
            .await?;
        Ok(Authorization::from_privilege_check(check))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn authorize_infra_sharing_read(
        &self,
        user: &User,
        infra: &Infra,
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
        if self.check_roles(user, [Role::Admin].into()).await? {
            return Ok(Authorization::Bypassed);
        }

        // Calling openfga
        let result = self
            .openfga
            .check(model::Infra::can_share_read().check(user, infra))
            .await?;
        Ok(Authorization::from_privilege_check(result))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn authorize_infra_sharing_write(
        &self,
        user: &User,
        infra: &Infra,
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
        if self.check_roles(user, [Role::Admin].into()).await? {
            return Ok(Authorization::Bypassed);
        }

        // Calling openfga
        let result = self
            .openfga
            .check(model::Infra::can_share_write().check(user, infra))
            .await?;
        Ok(Authorization::from_privilege_check(result))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn authorize_infra_sharing_ownership(
        &self,
        user: &User,
        infra: &Infra,
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
        if self.check_roles(user, [Role::Admin].into()).await? {
            return Ok(Authorization::Bypassed);
        }

        // Calling openfga
        let result = self
            .openfga
            .check(model::Infra::can_share_ownership().check(user, infra))
            .await?;
        Ok(Authorization::from_privilege_check(result))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn get_infra_readers(
        &self,
        infra: &Infra,
    ) -> Result<Vec<Either<User, Group>>, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra.0)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra.0));
        }

        let UserList { users, .. } = self
            .openfga
            .list_users(Infra::reader().query_users(infra))
            .await
            .map_err(QueryError::parsing_ok)?;

        Ok(users.into_iter().map(Either::Left).collect())
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn get_infra_writers(
        &self,
        infra: &Infra,
    ) -> Result<Vec<Either<User, Group>>, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra.0)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra.0));
        }

        let UserList { users, .. } = self
            .openfga
            .list_users(Infra::writer().query_users(infra))
            .await
            .map_err(QueryError::parsing_ok)?;

        Ok(users.into_iter().map(Either::Left).collect())
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn get_infra_owners(
        &self,
        infra: &Infra,
    ) -> Result<Vec<Either<User, Group>>, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra.0)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra.0));
        }

        let UserList { users, .. } = self
            .openfga
            .list_users(Infra::owner().query_users(infra))
            .await
            .map_err(QueryError::parsing_ok)?;

        Ok(users.into_iter().map(Either::Left).collect())
    }

    /// Get IDS of infras a subject can read
    pub async fn list_authorized_infra(
        &self,
        user: &User,
    ) -> Result<Authorization<Vec<Infra>>, Error<S::Error>> {
        // Bypass if user is an admin
        if self.is_admin(user).await? {
            return Ok(Authorization::Bypassed);
        }

        let infra_list = self
            .openfga
            .list_objects(Infra::can_read().query_objects(user))
            .await
            .map_err(QueryError::parsing_ok)?;

        Ok(Authorization::Granted(infra_list))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn give_infra_grant_unchecked(
        &self,
        user: &User,
        infra: &Infra,
        grant: InfraGrant,
    ) -> Result<(), Error<S::Error>> {
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

        // Remove other grants before to add the new one
        self.revoke_infra_grants_unchecked(user, infra).await?;

        // Grant the new one
        let mut writes = self.openfga.prepare_writes();
        match grant {
            InfraGrant::Reader => {
                writes.push(&Infra::reader().tuple(user, infra));
            }
            InfraGrant::Writer => {
                writes.push(&Infra::writer().tuple(user, infra));
            }
            InfraGrant::Owner => {
                writes.push(&Infra::owner().tuple(user, infra));
            }
        }
        writes.execute().await?;

        Ok(())
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn give_infra_grant(
        &self,
        issuer: &User,
        user: &User,
        infra: &Infra,
        grant: InfraGrant,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        let authz_share = match grant {
            InfraGrant::Reader => self.authorize_infra_sharing_read(issuer, infra).await?,
            InfraGrant::Writer => self.authorize_infra_sharing_write(issuer, infra).await?,
            InfraGrant::Owner => {
                self.authorize_infra_sharing_ownership(issuer, infra)
                    .await?
            }
        };
        authz_share
            .allowed_then_try(async || {
                self.give_infra_grant_unchecked(user, infra, grant).await?;
                Ok(Authorization::Granted(()))
            })
            .await
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn revoke_infra_grants(
        &self,
        issuer: &User,
        user: &User,
        infra: &Infra,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        if !self.is_admin(issuer).await?
            && !self
                .openfga
                .check(Infra::owner().check(issuer, infra))
                .await?
        {
            return Ok(Authorization::Denied {
                reason: "only owners can revoke grants",
            });
        }
        self.revoke_infra_grants_unchecked(user, infra).await?;
        Ok(Authorization::Granted(()))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn revoke_infra_grants_unchecked(
        &self,
        user: &User,
        infra: &Infra,
    ) -> Result<(), Error<S::Error>> {
        // No need to check if the infra exists. If it doesn't, there won't be any tuples in OpenFGA.
        // And even if there is, we're about to remove them anyway.
        // Likewise about both users.

        let mut delete = self.openfga.prepare_deletes();

        if self
            .openfga
            .check(Infra::reader().check(user, infra))
            .await?
        {
            delete.push(&Infra::reader().tuple(user, infra));
        }

        if self
            .openfga
            .check(Infra::writer().check(user, infra))
            .await?
        {
            delete.push(&Infra::writer().tuple(user, infra));
        }

        if self
            .openfga
            .check(Infra::owner().check(user, infra))
            .await?
        {
            delete.push(&Infra::owner().tuple(user, infra));
        }

        delete.execute().await?;
        Ok(())
    }
}
