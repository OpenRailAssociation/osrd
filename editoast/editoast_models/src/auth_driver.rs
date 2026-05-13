use std::ops::DerefMut;
use std::sync::Arc;

use authz::StorageDriver;
use authz::identity::GroupInfo;
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
    OpenFgaRequestFailure(#[from] fga::client::Error),
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
            #[expect(deprecated)] // soon to be removed
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

    async fn infra_exists(&self, infra_id: i64) -> Result<bool, Self::Error> {
        // TODO model_migration: use Infra once available in crate
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
