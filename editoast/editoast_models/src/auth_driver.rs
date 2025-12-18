use std::ops::DerefMut;
use std::sync::Arc;

use authz::StorageDriver;
use authz::identity::GroupInfo;
use authz::identity::GroupName;
use authz::identity::User;
use authz::identity::UserIdentity;
use authz::identity::UserInfo;
use authz::identity::UserName;
use database::DatabaseError;
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
        #[derive(QueryableByName)]
        struct UserIdentityFull {
            #[diesel(sql_type = diesel::sql_types::Varchar)]
            name: String,
            #[diesel(sql_type = diesel::sql_types::Array<diesel::sql_types::Nullable<diesel::sql_types::Varchar>>)]
            identities: Vec<Option<String>>,
        }
        let conn = self.pool.get().await?;
        let raw_query = r"
                SELECT u.name, ARRAY_AGG(i.identity) AS identities
                FROM authn_user AS u
                LEFT JOIN authn_user_identity AS i
                ON u.id = i.user_id
                WHERE u.id = $1
                GROUP BY u.id;
            ";
        let info = diesel::sql_query(raw_query)
            .bind::<diesel::sql_types::Bigint, _>(user_id)
            .get_result::<UserIdentityFull>(conn.write().await.deref_mut())
            .await
            .optional()?
            .map(|user_info| UserInfo {
                identities: user_info.identities.into_iter().flatten().collect_vec(),
                name: user_info.name,
            });
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
                conn.transaction(async move |conn| {
                    for new_identity in new_identities {
                        let values = &vec![(
                            authn_user_identity::identity.eq(&new_identity),
                            authn_user_identity::user_id.eq(user_id),)];
                        let res = conn
                            .transaction(async move |conn| {
                                dsl::insert_into(authn_user_identity::table)
                                    .values(values)
                                    .execute(&mut conn.write().await)
                                    .await
                                    .map_err(database::DatabaseError::from)
                            })
                        .await;
                        match res {
                            Err(database_error @ DatabaseError::UniqueViolation(_)) => {
                                let identity_owner = authn_user_identity::table
                                    .select(authn_user_identity::user_id)
                                    .filter(authn_user_identity::identity.eq(&new_identity))
                                    .first::<i64>(conn.write().await.deref_mut())
                                .await?;
                                if identity_owner != user_id {
                                    tracing::warn!(
                                        "Could not add to user `{}` the identity `{}` as it is already associated with another user (`{}`)",
                                        user_id,
                                        new_identity,
                                        identity_owner
                                    );
                                    return Err(AuthDriverError::from(database_error));
                                }
                                tracing::warn!("identity `{}` was already associated to the target user", new_identity);
                            },
                            Err(database_error) => return Err(AuthDriverError::from(database_error)),
                            Ok(_) => (),

                        }
                    }
                    Ok(true)
                })
                .await
            }
        }
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
        let user_id = dsl::insert_into(authn_subject::table)
            .default_values()
            .returning(authn_subject::id)
            .get_result::<i64>(&mut conn.clone().write().await)
            .await?;
        diesel::dsl::insert_into(authn_user::table)
            .values((authn_user::name.eq(&user.name), authn_user::id.eq(user_id)))
            .execute(&mut conn.write().await.deref_mut())
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
            identities: vec!["toto".to_owned()],
            name: "Sir Toto, the One and Only".to_owned(),
        };
        let toto_id = driver
            .ensure_user(&toto.name, &toto.identities[0])
            .await
            .expect("toto should be created successfully")
            .id;

        let tata = UserInfo {
            identities: vec!["tata".to_owned()],
            name: "TATA".to_owned(),
        };
        let tata_id = driver
            .ensure_user(&tata.name, &tata.identities[0])
            .await
            .expect("tata should be created successfully")
            .id;

        assert_ne!(toto_id, tata_id);

        assert_eq!(
            driver
                .get_user_id(&toto.identities[0])
                .await
                .expect("toto's ID should be queried successfully"),
            Some(toto_id)
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

        assert_eq!(
            driver
                .get_user_id(&tata.identities[0])
                .await
                .expect("tata's ID should be queried successfully"),
            Some(tata_id)
        );

        assert_eq!(tata_db, tata);

        // Add new identities to users

        driver
            .add_user_identities(Either::Left(toto_id), &["Riina".to_string()])
            .await
            .expect("toto new identity should be added successfully");

        driver
            .add_user_identities(
                Either::Right(tata.identities[0].clone()),
                &["Pinochet".to_string()],
            )
            .await
            .expect("tata new identity should be added successfully");

        let toto_db = driver
            .get_user_info(toto_id)
            .await
            .expect("toto should be queried successfully")
            .expect("toto should be found");

        let tata_db = driver
            .get_user_info(tata_id)
            .await
            .expect("tata should be queried successfully")
            .expect("tata should be found");

        assert_eq!(
            toto_db.identities,
            vec!["toto".to_owned(), "Riina".to_owned()]
        );
        assert_eq!(
            tata_db.identities,
            vec!["tata".to_owned(), "Pinochet".to_owned()]
        );

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
