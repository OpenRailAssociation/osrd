use std::ops::DerefMut;
use std::sync::Arc;

use authz::StorageDriver;
use authz::identity::GroupInfo;
use authz::identity::GroupName;
use authz::identity::User;
use authz::identity::UserIdentity;
use authz::identity::UserInfo;
use authz::identity::UserName;
use database::DbConnection;
use database::DbConnectionPoolV2;
use diesel::dsl;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;

use database::tables::*;
use futures::StreamExt;
use itertools::Either;
use itertools::Itertools;
use tracing::Level;

#[derive(Debug, thiserror::Error, derive_more::From)]
pub enum AuthDriverError {
    #[error(transparent)]
    #[from(database::DatabaseError)]
    Database(#[from] crate::Error),
    #[error(transparent)]
    DatabaseUnavailable(#[from] database::db_connection_pool::DatabasePoolError),
    #[error("Subject with id {subject_id} not found")]
    SubjectNotFound { subject_id: i64 },
    #[error(transparent)]
    OpenFgaRequestFailure(#[from] fga::client::RequestFailure),
    #[error("The provided identity is already associated to another user: `{owner:?}`")]
    IdentityAlreadyOwned { owner: User },
}

impl From<diesel::result::Error> for AuthDriverError {
    fn from(e: diesel::result::Error) -> Self {
        Self::Database(e.into())
    }
}

#[derive(Clone)]
pub struct PgAuthDriver {
    pool: Arc<DbConnectionPoolV2>,
}

impl PgAuthDriver {
    pub fn new(pool: Arc<DbConnectionPoolV2>) -> Self {
        Self { pool }
    }
}

impl StorageDriver for PgAuthDriver {
    type Error = AuthDriverError;

    #[tracing::instrument(skip_all, fields(%user_identity), ret(level = Level::DEBUG), err)]
    async fn get_user_info_by_identity(
        &self,
        user_identity: &UserIdentity,
    ) -> Result<Option<User>, Self::Error> {
        let conn = self.pool.get().await?;
        let identities_alias = diesel::alias!(authn_user_identity as identities_alias);
        let subquery = identities_alias
            .select(identities_alias.field(authn_user_identity::user_id))
            .filter(
                identities_alias
                    .field(authn_user_identity::identity)
                    .eq(user_identity),
            );
        let mut user_identities = authn_user::table
            .inner_join(authn_user_identity::table)
            .filter(authn_user_identity::user_id.eq_any(subquery))
            .select((
                authn_user::id,
                authn_user::name,
                authn_user_identity::identity,
            ))
            .get_results::<(i64, String, String)>(&mut conn.write().await.deref_mut())
            .await?
            .into_iter();
        let user = match user_identities.next() {
            Some((id, name, identity)) => {
                let mut identities = user_identities
                    .map(|(_, _, identity)| identity)
                    .collect_vec();
                identities.push(identity);
                Some(User {
                    id,
                    info: UserInfo { identities, name },
                })
            }
            None => None,
        };
        Ok(user)
    }

    #[tracing::instrument(skip_all, fields(%user_identity), ret(level = Level::DEBUG), err)]
    async fn get_user_id(&self, user_identity: &UserIdentity) -> Result<Option<i64>, Self::Error> {
        let conn = self.pool.get().await?;
        let id = authn_user::table
            .inner_join(authn_user_identity::table)
            .select(authn_user::id)
            .filter(authn_user_identity::identity.eq(&user_identity))
            .first::<i64>(conn.write().await.deref_mut())
            .await
            .optional()?;
        Ok(id)
    }

    #[tracing::instrument(skip_all, fields(%group_name), ret(level = Level::DEBUG), err)]
    async fn get_group_id(&self, group_name: &GroupName) -> Result<Option<i64>, Self::Error> {
        let conn = self.pool.get().await?;
        let id = authn_group::table
            .select(authn_group::id)
            .filter(authn_group::name.eq(group_name))
            .first::<i64>(conn.write().await.deref_mut())
            .await
            .optional()?;
        Ok(id)
    }

    #[tracing::instrument(skip_all, fields(%user_id), ret(level = Level::DEBUG), err)]
    async fn get_user_info(&self, user_id: i64) -> Result<Option<UserInfo>, Self::Error> {
        let info = crate::authn::user::User::get_batch_user_identities(
            &[user_id],
            &mut self.pool.get().await?,
        )
        .await?
        .get(&user_id)
        .cloned();
        Ok(info)
    }

    #[tracing::instrument(skip_all, fields(%group_id), ret(level = Level::DEBUG), err)]
    async fn get_group_info(&self, group_id: i64) -> Result<Option<GroupInfo>, Self::Error> {
        let conn = self.pool.get().await?;
        let info = authn_group::table
            .select(authn_group::name)
            .filter(authn_group::id.eq(group_id))
            .first::<String>(conn.write().await.deref_mut())
            .await
            .optional()?
            .map(|name| GroupInfo { name });
        Ok(info)
    }

    #[tracing::instrument(skip_all, fields(user_name, user_identity), ret(level = Level::DEBUG), err)]
    async fn ensure_user(
        &self,
        user_name: &UserName,
        user_identity: &UserIdentity,
    ) -> Result<User, Self::Error> {
        let conn = self.pool.get().await?;
        conn.transaction(async move |conn| {
            match self.get_user_info_by_identity(user_identity).await? {
                Some(user) => {
                    if &user.info.name == user_name {
                        tracing::debug!(?user, "user already exists in db");
                        Ok(user)
                    } else {
                        tracing::debug!(?user, "identity already associated to another user");
                        Err(AuthDriverError::IdentityAlreadyOwned { owner: user })
                    }
                }
                None => {
                    tracing::info!("registering new user in db");
                    self.save_new_user(
                        &UserInfo {
                            name: user_name.to_string(),
                            identities: vec![user_identity.to_string()],
                        },
                        &conn,
                    )
                    .await
                }
            }
        })
        .await
    }

    #[tracing::instrument(skip_all, fields(%group), ret(level = Level::DEBUG), err)]
    async fn ensure_group(&self, group: &GroupInfo) -> Result<i64, Self::Error> {
        let conn = self.pool.get().await?;
        conn.transaction(async move |conn| {
            let group_id = authn_group::table
                .select(authn_group::id)
                .filter(authn_group::name.eq(&group.name))
                .first::<i64>(conn.write().await.deref_mut())
                .await
                .optional()?;
            match group_id {
                Some(group_id) => {
                    tracing::debug!(group_id, "group already exists in db");
                    Ok(group_id)
                }

                None => {
                    tracing::info!("registering new group in db");
                    let id = dsl::insert_into(authn_group::table)
                        .values(authn_group::name.eq(&group.name))
                        .returning(authn_group::id)
                        .get_result(conn.write().await.deref_mut())
                        .await?;

                    Ok(id)
                }
            }
        })
        .await
    }

    async fn list_users(
        &self,
    ) -> Result<
        impl futures::stream::TryStream<Ok = (i64, UserInfo), Error = Self::Error>,
        Self::Error,
    > {
        let conn = self.pool.get().await?;
        let users = authn_user::table
            .left_join(authn_user_identity::table)
            .group_by(authn_user::id)
            .select((
                authn_user::id,
                authn_user::name,
                diesel::dsl::sql::<
                    diesel::sql_types::Array<
                        diesel::sql_types::Nullable<diesel::sql_types::Varchar>,
                    >,
                >("array_agg(")
                .bind(authn_user_identity::identity)
                .sql(")"),
            ))
            .load_stream::<(i64, String, Vec<Option<String>>)>(&mut conn.write().await)
            .await?
            .map(|res| match res {
                Ok((id, name, identities)) => Ok((
                    id,
                    UserInfo {
                        identities: identities.into_iter().flatten().collect_vec(),
                        name,
                    },
                )),
                Err(e) => Err(e.into()),
            });
        Ok(users)
    }

    async fn list_groups(
        &self,
    ) -> Result<
        impl futures::stream::TryStream<Ok = (i64, GroupInfo), Error = Self::Error>,
        Self::Error,
    > {
        let conn = self.pool.get().await?;
        let groups = authn_group::table
            .select((authn_group::id, authn_group::name))
            .load_stream::<(i64, String)>(&mut conn.write().await)
            .await?
            .map(|res| match res {
                Ok((id, name)) => Ok((id, GroupInfo { name })),
                Err(e) => Err(e.into()),
            });
        Ok(groups)
    }

    #[tracing::instrument(skip_all, fields(%user_id), ret(level = Level::DEBUG), err)]
    async fn delete_user(&self, user_id: i64) -> Result<bool, Self::Error> {
        let conn = self.pool.get().await?;
        let s = dsl::delete(authn_user::table.filter(authn_user::id.eq(user_id)))
            .execute(&mut conn.write().await)
            .await?;
        Ok(s > 0)
    }

    #[tracing::instrument(skip_all, fields(identities, user = %user_identity), ret(level = Level::DEBUG), err)]
    async fn add_user_identities(
        &self,
        user_identity: Either<i64, String>,
        new_identities: &[String],
    ) -> Result<bool, Self::Error> {
        let conn = self.pool.get().await?;
        conn.transaction(async move |conn| {
            let existing_user = match user_identity {
                Either::Left(user_id) => authn_user::table
                    .left_join(authn_user_identity::table)
                    .select(authn_user::id)
                    .filter(authn_user::id.eq(user_id))
                    .first::<i64>(conn.write().await.deref_mut())
                    .await
                    .optional()?,
                Either::Right(identity) => authn_user::table
                    .left_join(authn_user_identity::table)
                    .select(authn_user::id)
                    .filter(authn_user_identity::identity.eq(identity))
                    .first::<i64>(conn.write().await.deref_mut())
                    .await
                    .optional()?,
            };
            match existing_user {
                None => Ok(false),
                Some(user_id) => {
                    for new_identity in new_identities {
                        let identity_owner = authn_user_identity::table
                            .select(authn_user_identity::user_id)
                            .filter(authn_user_identity::identity.eq(&new_identity))
                            .first::<i64>(conn.write().await.deref_mut())
                            .await
                            .optional()?;
                        match identity_owner {
                            Some(same_owner_id) if same_owner_id == user_id => {
                                tracing::warn!(
                                    "The identity `{}` is already associated with the target user (user_id: {})",
                                    new_identity,
                                    user_id
                                );
                                continue;
                            }
                            Some(different_owner_id) => {
                                tracing::warn!(
                                    "Could not add to user `{}` the identity `{}` as it is already associated with another user (user_id: {})",
                                    user_id,
                                    new_identity,
                                    different_owner_id
                                );
                                continue;
                            }
                            None => {
                                dsl::insert_into(authn_user_identity::table)
                                    .values(&vec![(
                                        authn_user_identity::identity.eq(&new_identity),
                                        authn_user_identity::user_id.eq(user_id),)])

                                    .execute(&mut conn.write().await)
                                .await
                                .map_err(AuthDriverError::from)?;
                        }
                    }
                }
                Ok(true)
            }
        }
        }).await
    }

    #[tracing::instrument(skip_all, fields(%group_id), ret(level = Level::DEBUG), err)]
    async fn delete_group(&self, group_id: i64) -> Result<bool, Self::Error> {
        let conn = self.pool.get().await?;
        let s = dsl::delete(authn_group::table.filter(authn_group::id.eq(group_id)))
            .execute(&mut conn.write().await)
            .await?;

        Ok(s > 0)
    }

    async fn infra_exists(&self, infra_id: i64) -> Result<bool, Self::Error> {
        // TODO model_migration: use Infra once available in editoast_models
        Ok(
            dsl::select(dsl::exists(infra::table.filter(infra::id.eq(infra_id))))
                .get_result::<bool>(self.pool.get().await?.write().await.deref_mut())
                .await?,
        )
    }
}

impl PgAuthDriver {
    async fn save_new_user(
        &self,
        user: &UserInfo,
        conn: &DbConnection,
    ) -> Result<User, <PgAuthDriver as StorageDriver>::Error> {
        let user_id = diesel::dsl::insert_into(authn_user::table)
            .values(authn_user::name.eq(&user.name))
            .returning(authn_user::id)
            .get_result::<i64>(&mut conn.write().await.deref_mut())
            .await?;
        diesel::dsl::insert_into(authn_user_identity::table)
            .values(
                &user
                    .identities
                    .iter()
                    .map(|identity| {
                        (
                            authn_user_identity::identity.eq(identity),
                            authn_user_identity::user_id.eq(user_id),
                        )
                    })
                    .collect_vec(),
            )
            .execute(&mut conn.write().await.deref_mut())
            .await?;
        Ok(User {
            id: user_id,
            info: UserInfo {
                name: user.name.to_owned(),
                identities: user.identities.clone(),
            },
        })
    }
}
