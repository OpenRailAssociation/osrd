use std::ops::DerefMut;
use std::sync::Arc;

use crate::models::Infra;
use authz::StorageDriver;
use authz::identity::GroupInfo;
use authz::identity::GroupName;
use authz::identity::User;
use authz::identity::UserIdentity;
use authz::identity::UserInfo;
use database::DbConnectionPoolV2;
use diesel::dsl;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use diesel_async::scoped_futures::ScopedFutureExt as _;
use editoast_models::prelude::*;

use database::tables::*;
use futures::StreamExt;
use tracing::Level;

#[derive(Debug, thiserror::Error, derive_more::From)]
pub enum AuthDriverError {
    #[error(transparent)]
    #[from(database::DatabaseError)]
    Database(#[from] editoast_models::Error),
    #[error(transparent)]
    DatabaseUnavailable(#[from] database::db_connection_pool::DatabasePoolError),
    #[error("Subject with id {subject_id} not found")]
    SubjectNotFound { subject_id: i64 },
    #[error(transparent)]
    OpenFgaRequestFailure(#[from] fga::client::RequestFailure),
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
        let info = authn_user::table
            .select(authn_user::all_columns)
            .filter(authn_user::identity_id.eq(&user_identity))
            .first::<(i64, String, String)>(conn.write().await.deref_mut())
            .await
            .optional()?;
        let Some((id, identity, name)) = info else {
            return Ok(None);
        };

        Ok(Some(User {
            id,
            info: UserInfo { identity, name },
        }))
    }

    #[tracing::instrument(skip_all, fields(%user_identity), ret(level = Level::DEBUG), err)]
    async fn get_user_id(&self, user_identity: &UserIdentity) -> Result<Option<i64>, Self::Error> {
        let conn = self.pool.get().await?;
        let id = authn_user::table
            .select(authn_user::id)
            .filter(authn_user::identity_id.eq(&user_identity))
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
        let conn = self.pool.get().await?;
        let info = authn_user::table
            .select((authn_user::identity_id, authn_user::name))
            .filter(authn_user::id.eq(user_id))
            .first::<(String, String)>(conn.write().await.deref_mut())
            .await
            .optional()?
            .map(|(identity, name)| UserInfo { identity, name });
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

    #[tracing::instrument(skip_all, fields(%user), ret(level = Level::DEBUG), err)]
    async fn ensure_user(&self, user: &UserInfo) -> Result<User, Self::Error> {
        let conn = self.pool.get().await?;
        conn.transaction(|conn| {
            async move {
                let user_info = self.get_user_info_by_identity(&user.identity).await?;
                match user_info {
                    Some(user_info) => {
                        tracing::debug!(?user_info, "user already exists in db");
                        Ok(user_info)
                    }

                    None => {
                        tracing::info!("registering new user in db");

                        let id: i64 = dsl::insert_into(authn_subject::table)
                            .default_values()
                            .returning(authn_subject::id)
                            .get_result(&mut conn.clone().write().await)
                            .await?;

                        dsl::insert_into(authn_user::table)
                            .values((
                                authn_user::id.eq(id),
                                authn_user::identity_id.eq(&user.identity),
                                authn_user::name.eq(&user.name),
                            ))
                            .execute(conn.write().await.deref_mut())
                            .await?;

                        Ok(User {
                            id,
                            info: user.clone(),
                        })
                    }
                }
            }
            .scope_boxed()
        })
        .await
    }

    #[tracing::instrument(skip_all, fields(%group), ret(level = Level::DEBUG), err)]
    async fn ensure_group(&self, group: &GroupInfo) -> Result<i64, Self::Error> {
        let conn = self.pool.get().await?;
        conn.transaction(|conn| {
            async move {
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

                        let id: i64 = dsl::insert_into(authn_subject::table)
                            .default_values()
                            .returning(authn_subject::id)
                            .get_result(&mut conn.clone().write().await)
                            .await?;

                        dsl::insert_into(authn_group::table)
                            .values((authn_group::id.eq(id), authn_group::name.eq(&group.name)))
                            .execute(conn.write().await.deref_mut())
                            .await?;

                        Ok(id)
                    }
                }
            }
            .scope_boxed()
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
            .select((authn_user::id, authn_user::identity_id, authn_user::name))
            .load_stream::<(i64, String, String)>(&mut conn.write().await)
            .await?
            .map(|res| match res {
                Ok((id, identity, name)) => Ok((id, UserInfo { identity, name })),
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

    #[tracing::instrument(skip_all, fields(%group_id), ret(level = Level::DEBUG), err)]
    async fn delete_group(&self, group_id: i64) -> Result<bool, Self::Error> {
        let conn = self.pool.get().await?;

        conn.transaction(|conn| {
            async move {
                let s = dsl::delete(authn_group::table.filter(authn_group::id.eq(group_id)))
                    .execute(&mut conn.write().await)
                    .await?;

                dsl::delete(authn_subject::table.filter(authn_subject::id.eq(group_id)))
                    .execute(&mut conn.write().await)
                    .await?;

                Ok(s > 0)
            }
            .scope_boxed()
        })
        .await
    }

    async fn infra_exists(&self, infra_id: i64) -> Result<bool, Self::Error> {
        Ok(Infra::exists(&mut self.pool.get().await?, infra_id).await?)
    }
}

#[cfg(test)]
mod tests {
    use futures::TryStreamExt as _;
    use pretty_assertions::assert_eq;

    use super::*;
    use database::DbConnectionPoolV2;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_auth_driver() {
        let pool = DbConnectionPoolV2::for_tests();
        let driver = PgAuthDriver::new(pool.into());

        // Create some users

        let toto = UserInfo {
            identity: "toto".to_owned(),
            name: "Sir Toto, the One and Only".to_owned(),
        };
        let toto_id = driver
            .ensure_user(&toto)
            .await
            .expect("toto should be created successfully")
            .id;

        let tata = UserInfo {
            identity: "tata".to_owned(),
            name: "TATA".to_owned(),
        };
        let tata_id = driver
            .ensure_user(&tata)
            .await
            .expect("tata should be created successfully")
            .id;

        assert_ne!(toto_id, tata_id);

        assert_eq!(
            driver
                .get_user_id(&toto.identity)
                .await
                .expect("toto's ID should be queried successfully"),
            Some(toto_id)
        );

        assert_eq!(
            driver
                .get_user_id(&tata.identity)
                .await
                .expect("tata's ID should be queried successfully"),
            Some(tata_id)
        );

        // Retrieve some information about them

        let toto_db = driver
            .get_user_info(toto_id)
            .await
            .expect("toto should be queried successfully")
            .expect("toto should be found");

        assert_eq!(toto_db, toto);

        let tata_db = driver
            .get_user_info(tata_id)
            .await
            .expect("tata should be queried successfully")
            .expect("tata should be found");

        assert_eq!(tata_db, tata);

        // Create some groups

        let friends = GroupInfo {
            name: "Friends".to_owned(),
        };
        let foes = GroupInfo {
            name: "Foes".to_owned(),
        };

        let friends_id = driver
            .ensure_group(&friends)
            .await
            .expect("Group 'friends' should be created successfully");

        let foes_id = driver
            .ensure_group(&foes)
            .await
            .expect("Group 'foes' should be created successfully");

        assert_eq!(
            driver
                .get_group_info(friends_id)
                .await
                .expect("Group 'friends' should be queried successfully")
                .expect("Group 'friends' should be found"),
            friends
        );
        assert_eq!(
            driver
                .get_group_info(foes_id)
                .await
                .expect("Group 'foes' should be queried successfully")
                .expect("Group 'foes' should be found"),
            foes
        );

        // List groups
        let groups = driver
            .list_groups()
            .await
            .expect("Groups should be listed successfully")
            .try_collect::<Vec<_>>()
            .await
            .expect("Groups should be collected successfully");
        assert_eq!(groups, vec![(friends_id, friends), (foes_id, foes)]);

        match driver.delete_user(toto_id).await {
            Ok(deleted) => assert!(deleted, "user 'toto' should be deleted"),
            _ => unreachable!(),
        }

        match driver.delete_user(0xdeadbeef).await {
            Ok(deleted) => assert!(!deleted, "deleting an unknown user should return false"),
            _ => unreachable!(),
        }

        assert!(
            driver
                .delete_group(friends_id)
                .await
                .expect("Group 'friend' should be deleted")
        );
    }
}
