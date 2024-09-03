use std::collections::HashSet;
use std::ops::DerefMut;
use std::sync::Arc;

use diesel::{dsl, prelude::*};
use diesel_async::{scoped_futures::ScopedFutureExt, RunQueryDsl};
use editoast_authz::{
    authorizer::{StorageDriver, UserInfo},
    roles::{BuiltinRoleSet, RoleConfig},
};
use editoast_models::DbConnectionPoolV2;
use itertools::Itertools;

use editoast_models::tables::*;

pub struct PgAuthDriver<B: BuiltinRoleSet + Send + Sync> {
    pool: Arc<DbConnectionPoolV2>,
    _role_set: std::marker::PhantomData<B>,
}

impl<B: BuiltinRoleSet + Send + Sync> PgAuthDriver<B> {
    pub fn new(pool: Arc<DbConnectionPoolV2>) -> Self {
        Self {
            pool,
            _role_set: Default::default(),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AuthDriverError {
    #[error(transparent)]
    DieselError(#[from] diesel::result::Error),
    #[error(transparent)]
    PoolError(#[from] editoast_models::db_connection_pool::DatabasePoolError),
}

impl<B: BuiltinRoleSet + Send + Sync> StorageDriver for PgAuthDriver<B> {
    type BuiltinRole = B;
    type Error = AuthDriverError;

    #[tracing::instrument(skip_all, fields(%user), ret, err)]
    async fn ensure_user(&self, user: &UserInfo) -> Result<i64, Self::Error> {
        self.pool
            .get()
            .await?
            .clone()
            .transaction(|conn| {
                async move {
                    let user_id = authn_user::table
                        .select(authn_user::id)
                        .filter(authn_user::identity_id.eq(&user.identity))
                        .first::<i64>(conn.write().await.deref_mut())
                        .await
                        .optional()?;

                    match user_id {
                        Some(user_id) => {
                            tracing::debug!("user already exists in db");
                            Ok(user_id)
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

                            Ok(id)
                        }
                    }
                }
                .scope_boxed()
            })
            .await
    }

    #[tracing::instrument(skip_all, fields(%subject_id, %roles_config), ret, err)]
    async fn fetch_subject_roles(
        &self,
        subject_id: i64,
        roles_config: &RoleConfig<Self::BuiltinRole>,
    ) -> Result<HashSet<Self::BuiltinRole>, Self::Error> {
        let conn = self.pool.get().await?;

        let roles = authz_role::table
            .select(authz_role::role)
            .left_join(
                authn_group_membership::table.on(authn_group_membership::user.eq(subject_id)),
            )
            .filter(authz_role::subject.eq(subject_id))
            .or_filter(authz_role::subject.eq(authn_group_membership::group))
            .load::<String>(conn.write().await.deref_mut())
            .await?
            .into_iter()
            .map(|role| {
                Self::BuiltinRole::from_str(role.as_str())
                    .ok()
                    .expect("invalid builtin role tag")
            })
            .collect::<HashSet<_>>();

        Ok(roles)
    }

    #[tracing::instrument(skip_all, fields(%subject_id, %roles_config, ?roles), err)]
    async fn ensure_subject_roles(
        &self,
        subject_id: i64,
        roles_config: &RoleConfig<Self::BuiltinRole>,
        roles: HashSet<Self::BuiltinRole>,
    ) -> Result<(), Self::Error> {
        let conn = self.pool.get().await?;

        dsl::insert_into(authz_role::table)
            .values(
                roles
                    .iter()
                    .map(|role| {
                        (
                            authz_role::subject.eq(subject_id),
                            authz_role::role.eq(role.as_str()),
                        )
                    })
                    .collect_vec(),
            )
            .on_conflict((authz_role::subject, authz_role::role))
            .do_nothing()
            .execute(conn.write().await.deref_mut())
            .await?;

        Ok(())
    }

    #[tracing::instrument(skip_all, fields(%subject_id, %roles_config, ?roles), ret, err)]
    async fn remove_subject_roles(
        &self,
        subject_id: i64,
        roles_config: &RoleConfig<Self::BuiltinRole>,
        roles: HashSet<Self::BuiltinRole>,
    ) -> Result<HashSet<Self::BuiltinRole>, Self::Error> {
        let conn = self.pool.get().await?;

        let deleted_roles = dsl::delete(
            authz_role::table
                .filter(authz_role::subject.eq(subject_id))
                .filter(
                    authz_role::role.eq_any(roles.iter().map(|r| r.as_str()).collect::<Vec<_>>()),
                ),
        )
        .returning(authz_role::role)
        .load::<String>(conn.write().await.deref_mut())
        .await?
        .into_iter()
        .map(|role| {
            Self::BuiltinRole::from_str(role.as_str())
                .ok()
                .expect("invalid builtin role tag")
        })
        .collect();

        Ok(deleted_roles)
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;
    use editoast_authz::fixtures::*;
    use editoast_models::DbConnectionPoolV2;

    use TestBuiltinRole::*;

    async fn assert_roles(
        driver: &mut PgAuthDriver<TestBuiltinRole>,
        uid: i64,
        config: &RoleConfig<TestBuiltinRole>,
        roles: &[TestBuiltinRole],
    ) {
        let fetched_roles = driver
            .fetch_subject_roles(uid, config)
            .await
            .expect("roles should be fetched successfully");
        let expected_roles = roles.iter().cloned().collect();
        assert_eq!(fetched_roles, expected_roles);
    }

    #[rstest::rstest]
    async fn test_auth_driver() {
        let pool = DbConnectionPoolV2::for_tests();
        let mut driver = PgAuthDriver::<TestBuiltinRole>::new(pool.into());
        let config = default_test_config();

        let uid = driver
            .ensure_user(&UserInfo {
                identity: "toto".to_owned(),
                name: "Sir Toto, the One and Only".to_owned(),
            })
            .await
            .expect("toto should be created successfully");
        assert_roles(&mut driver, uid, &config, Default::default()).await;

        driver
            .ensure_subject_roles(uid, &config, HashSet::from([DocRead, DocEdit]))
            .await
            .expect("roles should be updated successfully");
        assert_roles(&mut driver, uid, &config, &[DocRead, DocEdit]).await;

        let deleted = driver
            .remove_subject_roles(uid, &config, HashSet::from([DocEdit, UserBan]))
            .await
            .expect("roles should be deleted successfully");
        assert_eq!(deleted, HashSet::from([DocEdit]));
        assert_roles(&mut driver, uid, &config, &[DocRead]).await;
    }
}
