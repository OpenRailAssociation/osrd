use std::collections::HashSet;
use std::future::Future;

use fga::client::QueryError;
use fga::client::UserList;
use fga::model::Relation;
use futures::stream;
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

    fn delete_user(&self, user_id: i64) -> impl Future<Output = Result<bool, Self::Error>> + Send;

    fn delete_group(&self, group_id: i64)
    -> impl Future<Output = Result<bool, Self::Error>> + Send;

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

    pub async fn subject_exists(&self, subject: &Subject) -> Result<bool, Error<S::Error>> {
        match subject {
            Subject::User(user) => self.user_exists(user.0).await,
            Subject::Group(group) => self.group_exists(group.0).await,
        }
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

    /// Returns the maximum grant a subject has on an infra
    ///
    /// A given user may have multiple grants on the same resource. This can happen
    /// if a user inherits a grant from one of its groups and also has a direct grant.
    /// Inherited grants are not the same thing as privileges: they do not have the same semantic,
    /// are not represented by the same enum, do no work on the same scale nor in the same way.
    ///
    /// Groups only have direct grants. If multiple direct grants are found, this function will panic.
    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn infra_grant(
        &self,
        subject: &Subject,
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

        // Check if subject exists
        if !self.subject_exists(subject).await? {
            return Err(Error::UnknownSubject(subject.id()));
        }

        // Calling openfga
        let (is_reader, is_writer, is_owner) = match subject {
            Subject::User(user) => {
                self.openfga
                    .checks((
                        model::Infra::reader().check(user, infra),
                        model::Infra::writer().check(user, infra),
                        model::Infra::owner().check(user, infra),
                    ))
                    .await?
            }
            Subject::Group(group) => {
                let (is_reader, is_writer, is_owner) = self
                    .openfga
                    .checks((
                        model::Infra::reader().check(Group::member().userset(group), infra),
                        model::Infra::writer().check(Group::member().userset(group), infra),
                        model::Infra::owner().check(Group::member().userset(group), infra),
                    ))
                    .await?;
                if !matches!(
                    (is_reader, is_writer, is_owner),
                    (true, false, false)
                        | (false, true, false)
                        | (false, false, true)
                        | (false, false, false)
                ) {
                    tracing::error!(
                        is_reader,
                        is_writer,
                        is_owner,
                        ?subject,
                        resource = ?infra,
                        "Group has multiple direct grants on the same resource"
                    );
                    panic!(
                        "Group {subject:?} has multiple direct grants on the same resource {infra:?}, which is not supposed to happen by design. \n\
                        While a user may have inherited grants from one of their groups, groups do not have inherited grants. \n\
                        Detected direct grants: reader: {is_reader}, writer: {is_writer}, owner: {is_owner}"
                    );
                }
                (is_reader, is_writer, is_owner)
            }
        };

        Ok(is_owner
            .then_some(InfraGrant::Owner)
            .or_else(|| is_writer.then_some(InfraGrant::Writer))
            .or_else(|| is_reader.then_some(InfraGrant::Reader)))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn infra_direct_grant(
        &self,
        subject: &Subject,
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

        // Check if subject exists
        if !self.subject_exists(subject).await? {
            return Err(Error::UnknownSubject(subject.id()));
        }

        // Calling openfga
        let (is_reader, is_writer, is_owner) = match subject {
            Subject::User(user) => tokio::try_join!(
                self.openfga
                    .tuple_exists(Infra::reader().tuple(user, infra)),
                self.openfga
                    .tuple_exists(Infra::writer().tuple(user, infra)),
                self.openfga.tuple_exists(Infra::owner().tuple(user, infra)),
            )?,
            Subject::Group(group) => tokio::try_join!(
                self.openfga
                    .tuple_exists(Infra::reader().tuple(Group::member().userset(group), infra)),
                self.openfga
                    .tuple_exists(Infra::writer().tuple(Group::member().userset(group), infra)),
                self.openfga
                    .tuple_exists(Infra::owner().tuple(Group::member().userset(group), infra)),
            )?,
        };

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
                    ?subject,
                    resource = ?infra,
                    "Subject has multiple direct grants on the same resource"
                );
                panic!(
                    "Subject '{subject:?}' has multiple direct grants on the same resource '{infra:?}', which is not supposed to happen by design. \n\
                    Detected direct grants: reader: {is_reader}, writer: {is_writer}, owner: {is_owner}"
                )
            }
        }
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
        };
        Ok(Authorization::from_privilege_check(check))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn get_infra_readers(&self, infra: &Infra) -> Result<Vec<Subject>, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra.0)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra.0));
        }

        let (UserList { users, .. }, groups) = tokio::try_join!(
            self.openfga.list_users(Infra::reader().query_users(infra)),
            self.openfga
                .list_usersets(Infra::reader().query_usersets(Group::member(), infra))
        )
        .map_err(QueryError::parsing_ok)?;

        Ok(users
            .into_iter()
            .map(Subject::User)
            .chain(groups.into_iter().map(Subject::Group))
            .collect())
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn get_infra_writers(&self, infra: &Infra) -> Result<Vec<Subject>, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra.0)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra.0));
        }

        let (UserList { users, .. }, groups) = tokio::try_join!(
            self.openfga.list_users(Infra::writer().query_users(infra)),
            self.openfga
                .list_usersets(Infra::writer().query_usersets(Group::member(), infra))
        )
        .map_err(QueryError::parsing_ok)?;

        Ok(users
            .into_iter()
            .map(Subject::User)
            .chain(groups.into_iter().map(Subject::Group))
            .collect())
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn get_infra_owners(&self, infra: &Infra) -> Result<Vec<Subject>, Error<S::Error>> {
        // Check if the infra exists
        if !self
            .driver
            .infra_exists(infra.0)
            .await
            .map_err(Error::Storage)?
        {
            return Err(Error::UnknownResource(infra.0));
        }

        let (UserList { users, .. }, groups) = tokio::try_join!(
            self.openfga.list_users(Infra::owner().query_users(infra)),
            self.openfga
                .list_usersets(Infra::owner().query_usersets(Group::member(), infra))
        )
        .map_err(QueryError::parsing_ok)?;

        Ok(users
            .into_iter()
            .map(Subject::User)
            .chain(groups.into_iter().map(Subject::Group))
            .collect())
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
        subject: &Subject,
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

        // Check if subject exists
        if !self.subject_exists(subject).await? {
            return Err(Error::UnknownSubject(subject.id()));
        }

        // Remove existing grants before adding the new one
        self.revoke_infra_grants_unchecked(subject, infra).await?;

        // Grant the new one
        let mut writes = self.openfga.prepare_writes();
        match (subject, grant) {
            (Subject::User(user), InfraGrant::Reader) => {
                writes.push(&Infra::reader().tuple(user, infra));
            }
            (Subject::User(user), InfraGrant::Writer) => {
                writes.push(&Infra::writer().tuple(user, infra));
            }
            (Subject::User(user), InfraGrant::Owner) => {
                writes.push(&Infra::owner().tuple(user, infra));
            }
            (Subject::Group(group), InfraGrant::Reader) => {
                writes.push(&Infra::reader().tuple(Group::member().userset(group), infra));
            }
            (Subject::Group(group), InfraGrant::Writer) => {
                writes.push(&Infra::writer().tuple(Group::member().userset(group), infra));
            }
            (Subject::Group(group), InfraGrant::Owner) => {
                writes.push(&Infra::owner().tuple(Group::member().userset(group), infra));
            }
        }
        writes.execute().await?;

        Ok(())
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn give_infra_grant(
        &self,
        issuer: &User,
        subject: &Subject,
        infra: &Infra,
        new_grant: InfraGrant,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        // Set grant rules:
        // 1. Issuer must have the correct sharing privilege
        // 2. Issuer is admin (may not have any direct grant on the resource)
        //     1. cannot demote the last owner (including self)
        //     2. can demote or promote anyone to any grant level otherwise
        // 3. Issuer is owner
        //     1. cannot demote the last owner (including self)
        //     2. can demote or promote anyone to any grant level otherwise
        // 4. Issuer is anything else
        //     1. can demote self
        //     2. cannot promote self
        //     3. can promote anyone up to their own grant level
        //     4. can demote anyone with a strictly lower grant level than their own

        // Rule 1., 4.2 and 4.3
        let authz_share = match new_grant {
            InfraGrant::Reader => {
                self.authorize_infra(issuer, infra, InfraPrivilege::CanShareRead)
                    .await?
            }
            InfraGrant::Writer => {
                self.authorize_infra(issuer, infra, InfraPrivilege::CanShareWrite)
                    .await?
            }
            InfraGrant::Owner => {
                self.authorize_infra(issuer, infra, InfraPrivilege::CanShareOwnership)
                    .await?
            }
        };

        let is_admin = self.is_admin(issuer).await?;
        let issuer = Subject::User(User(issuer.0));
        let issuer_grant = self.infra_grant(&issuer, infra).await?;
        let subject_grant = self.infra_grant(subject, infra).await?;

        // Rule 2.1 and 3.1
        if let Some(subject_grant) = subject_grant
            && subject_grant == InfraGrant::Owner
            && new_grant < subject_grant
        {
            let current_owners = self.get_infra_owners(infra).await?;
            if current_owners.len() == 1 && current_owners.contains(subject) {
                return Ok(Authorization::Denied {
                    reason: "cannot demote the last owner",
                });
            }
        }

        // Rule 3.2 and 4.4
        if !is_admin
            && let Some(issuer_grant) = issuer_grant // guaranteed by the model if sharing is allowed
            && let Some(subject_grant) = subject_grant
            && &issuer != subject // Rule 4.1
            && (new_grant < subject_grant && issuer_grant <= subject_grant)
        {
            return Ok(Authorization::Denied {
                reason: "cannot demote user without having a higher grant",
            });
        }

        authz_share
            .allowed_then_try(async || {
                self.give_infra_grant_unchecked(subject, infra, new_grant)
                    .await?;
                Ok(Authorization::Granted(()))
            })
            .await
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn revoke_infra_grants(
        &self,
        issuer: &User,
        subject: &Subject,
        infra: &Infra,
    ) -> Result<Authorization<()>, Error<S::Error>> {
        // TODO: add a can_revoke privilege in the authorization model

        // Revoking rules:
        // 1. Only owners (and admins) can fully revoke grants
        // 2. The last owner of a resource cannot be revoked, even by admins
        // 3. An owner cannot revoke another owner

        let is_subject_owner = match subject {
            Subject::User(user) => {
                self.openfga
                    .check(Infra::owner().check(user, infra))
                    .await?
            }
            Subject::Group(group) => {
                self.openfga
                    .check(Infra::owner().check(Group::member().userset(group), infra))
                    .await?
            }
        };

        if is_subject_owner {
            let current_owners = self.get_infra_owners(infra).await?;
            if current_owners.len() == 1 && current_owners.contains(subject) {
                return Ok(Authorization::Denied {
                    reason: "cannot remove the last owner from infrastructure",
                });
            }
        }

        if !self.is_admin(issuer).await? {
            let is_issuer_owner = self
                .openfga
                .check(Infra::owner().check(issuer, infra))
                .await?;

            if !is_issuer_owner {
                return Ok(Authorization::Denied {
                    reason: "only owners can revoke grants",
                });
            }

            // Rule 3: An owner cannot revoke another owner (only admins can)
            if is_issuer_owner && is_subject_owner {
                return Ok(Authorization::Denied {
                    reason: "owner cannot revoke another owner",
                });
            }
        }

        self.revoke_infra_grants_unchecked(subject, infra).await?;
        Ok(Authorization::Granted(()))
    }

    #[tracing::instrument(skip(self), ret(level = Level::DEBUG), err)]
    pub async fn revoke_infra_grants_unchecked(
        &self,
        subject: &Subject,
        infra: &Infra,
    ) -> Result<(), Error<S::Error>> {
        // No need to check if the infra exists. If it doesn't, there won't be any tuples in OpenFGA.
        // And even if there is, we're about to remove them anyway.
        // Likewise about both users.

        let mut delete = self.openfga.prepare_deletes();

        if subject
            .fetch(
                &self.openfga,
                |user| Infra::reader().tuple(user, infra),
                |group| Infra::reader().tuple(Group::member().userset(group), infra),
            )
            .await?
        {
            match subject {
                Subject::User(user) => delete.push(&Infra::reader().tuple(user, infra)),
                Subject::Group(group) => {
                    delete.push(&Infra::reader().tuple(Group::member().userset(group), infra))
                }
            }
        }

        if subject
            .fetch(
                &self.openfga,
                |user| Infra::writer().tuple(user, infra),
                |group| Infra::writer().tuple(Group::member().userset(group), infra),
            )
            .await?
        {
            match subject {
                Subject::User(user) => delete.push(&Infra::writer().tuple(user, infra)),
                Subject::Group(group) => {
                    delete.push(&Infra::writer().tuple(Group::member().userset(group), infra))
                }
            }
        }

        if subject
            .fetch(
                &self.openfga,
                |user| Infra::owner().tuple(user, infra),
                |group| Infra::owner().tuple(Group::member().userset(group), infra),
            )
            .await?
        {
            match subject {
                Subject::User(user) => delete.push(&Infra::owner().tuple(user, infra)),
                Subject::Group(group) => {
                    delete.push(&Infra::owner().tuple(Group::member().userset(group), infra))
                }
            }
        }
        delete.execute().await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Infra;
    use crate::InfraGrant;
    use crate::mock_driver::MockAuthDriver;

    // GRANTING TESTS

    #[tokio::test(flavor = "multi_thread")]
    async fn admin_cannot_demote_last_owner() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();
        let walter = regulator.walter();

        regulator.set_infra_grant(alice, infra, InfraGrant::Owner);

        regulator
            .give_infra_grant(&walter, &alice.into(), &infra, InfraGrant::Writer)
            .await
            .expect("grant operation should complete")
            .expect_denied("cannot demote the last owner");

        regulator.assert_infra_grant_eq(alice, infra, Some(InfraGrant::Owner));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn admin_can_promote_and_demote_anyone() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();
        let bob = regulator.bob();
        let walter = regulator.walter();

        regulator.set_infra_grant(alice, infra, InfraGrant::Owner);
        regulator.set_infra_grant(bob, infra, InfraGrant::Reader);

        // admin can promote anyone
        regulator
            .give_infra_grant(&walter, &bob.into(), &infra, InfraGrant::Owner)
            .await
            .expect("grant operation should complete")
            .expect_allowed("admin can promote anyone");

        regulator.assert_infra_grant_eq(bob, infra, Some(InfraGrant::Owner));

        // admin can demote anyone (when not last owner)
        regulator
            .give_infra_grant(&walter, &bob.into(), &infra, InfraGrant::Writer)
            .await
            .expect("grant operation should complete")
            .expect_allowed("admin can demote anyone");

        regulator.assert_infra_grant_eq(bob, infra, Some(InfraGrant::Writer));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn last_owner_cannot_demote_themself() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();

        regulator.set_infra_grant(alice, infra, InfraGrant::Owner);

        regulator
            .give_infra_grant(&alice, &alice.into(), &infra, InfraGrant::Writer)
            .await
            .expect("grant operation should complete")
            .expect_denied("cannot demote the last owner");

        regulator.assert_infra_grant_eq(alice, infra, Some(InfraGrant::Owner));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn owner_can_promote_and_demote_anyone() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();
        let bob = regulator.bob();

        regulator.set_infra_grant(alice, infra, InfraGrant::Owner);
        regulator.set_infra_grant(bob, infra, InfraGrant::Reader);

        // owner can promote anyone
        regulator
            .give_infra_grant(&alice, &bob.into(), &infra, InfraGrant::Writer)
            .await
            .expect("grant operation should complete")
            .expect_allowed("owner can promote anyone");

        regulator.assert_infra_grant_eq(bob, infra, Some(InfraGrant::Writer));

        // owner can demote anyone
        regulator
            .give_infra_grant(&alice, &bob.into(), &infra, InfraGrant::Reader)
            .await
            .expect("grant operation should complete")
            .expect_allowed("owner can demote anyone");

        regulator.assert_infra_grant_eq(bob, infra, Some(InfraGrant::Reader));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn user_can_demote_themself() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();

        regulator.set_infra_grant(alice, infra, InfraGrant::Writer);

        regulator
            .give_infra_grant(&alice, &alice.into(), &infra, InfraGrant::Reader)
            .await
            .expect("grant operation should complete")
            .expect_allowed("user can demote self");

        regulator.assert_infra_grant_eq(alice, infra, Some(InfraGrant::Reader));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn user_cannot_promote_themself() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();

        regulator.set_infra_grant(alice, infra, InfraGrant::Writer);

        regulator
            .give_infra_grant(&alice, &alice.into(), &infra, InfraGrant::Owner)
            .await
            .expect("grant operation should complete")
            .expect_denied("user cannot promote self");

        regulator.assert_infra_grant_eq(alice, infra, Some(InfraGrant::Writer));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn user_can_promote_up_to_own_level() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();
        let bob = regulator.bob();

        regulator.set_infra_grant(alice, infra, InfraGrant::Writer);
        regulator.set_infra_grant(bob, infra, InfraGrant::Reader);

        regulator
            .give_infra_grant(&alice, &bob.into(), &infra, InfraGrant::Writer)
            .await
            .expect("grant operation should complete")
            .expect_allowed("user can promote up to own level");

        regulator.assert_infra_grant_eq(bob, infra, Some(InfraGrant::Writer));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn user_cannot_promote_above_own_level() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();
        let bob = regulator.bob();

        regulator.set_infra_grant(alice, infra, InfraGrant::Writer);
        regulator.set_infra_grant(bob, infra, InfraGrant::Reader);

        regulator
            .give_infra_grant(&alice, &bob.into(), &infra, InfraGrant::Owner)
            .await
            .expect("grant operation should complete")
            .expect_denied("user cannot promote above own level");

        regulator.assert_infra_grant_eq(bob, infra, Some(InfraGrant::Reader));
    }

    // REVOKING TESTS

    #[tokio::test(flavor = "multi_thread")]
    async fn only_owners_can_revoke() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();
        let bob = regulator.bob();

        regulator.set_infra_grant(alice, infra, InfraGrant::Writer);
        regulator.set_infra_grant(bob, infra, InfraGrant::Reader);

        regulator
            .revoke_infra_grants(&alice, &bob.into(), &infra)
            .await
            .expect("revoke operation should complete")
            .expect_denied("only owners can revoke grants");

        regulator.assert_infra_grant_eq(bob, infra, Some(InfraGrant::Reader));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn admins_can_revoke() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();
        let walter = regulator.walter();

        regulator.set_infra_grant(alice, infra, InfraGrant::Reader);

        regulator
            .revoke_infra_grants(&walter, &alice.into(), &infra)
            .await
            .expect("revoke operation should complete")
            .expect_allowed("admin can revoke grants");

        regulator.assert_infra_grant_eq(alice, infra, None);
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn last_owner_cannot_be_revoked_by_admin() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();
        let walter = regulator.walter();

        regulator.set_infra_grant(alice, infra, InfraGrant::Owner);

        regulator
            .revoke_infra_grants(&walter, &alice.into(), &infra)
            .await
            .expect("revoke operation should complete")
            .expect_denied("last owner cannot be revoked");

        regulator.assert_infra_grant_eq(alice, infra, Some(InfraGrant::Owner));
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn owner_cannot_revoke_another_owner() {
        let regulator = Regulator::new(crate::authz_client!(), MockAuthDriver::default());
        let infra = Infra(1);
        let alice = regulator.alice();
        let bob = regulator.bob();

        regulator.set_infra_grant(alice, infra, InfraGrant::Owner);
        regulator.set_infra_grant(bob, infra, InfraGrant::Owner);

        regulator
            .revoke_infra_grants(&alice, &bob.into(), &infra)
            .await
            .expect("revoke operation should complete")
            .expect_denied("owner cannot revoke another owner");

        regulator.assert_infra_grant_eq(bob, infra, Some(InfraGrant::Owner));
    }
}
