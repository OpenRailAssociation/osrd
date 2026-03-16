use std::collections::HashMap;
use std::ops::DerefMut;

use authz::identity::UserIdentity;
use authz::identity::UserInfo;
use database::DbConnection;
use database::tables::authn_user;
use database::tables::authn_user_identity;
use diesel::ExpressionMethods;
use diesel::QueryDsl;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use itertools::Itertools as _;

use crate as editoast_models; // HACK: remove after all models are in this crate

#[derive(Debug, Clone, PartialEq, Eq, Model)]
#[model(table = database::tables::authn_user)]
#[model(gen(ops = r, batch_ops = r, list))]
pub struct User {
    pub id: i64,
    pub name: String,
}

impl User {
    /// Inserts a new [User], fails if the identity is already associated with another user
    #[tracing::instrument(skip(conn), ret(level = "debug"), err)]
    pub async fn register(
        conn: DbConnection,
        identities: Vec<String>,
        name: String,
    ) -> Result<User, database::DatabaseError> {
        conn.transaction(async move |conn| {
            let id = diesel::dsl::insert_into(authn_user::table)
                .values(authn_user::name.eq(&name))
                .returning(authn_user::id)
                .get_result::<i64>(&mut conn.write().await)
                .await?;
            diesel::dsl::insert_into(authn_user_identity::table)
                .values(
                    identities
                        .iter()
                        .map(|identity| {
                            (
                                authn_user_identity::identity.eq(identity),
                                authn_user_identity::user_id.eq(id),
                            )
                        })
                        .collect_vec(),
                )
                .execute(&mut conn.write().await)
                .await?;
            Ok(Self { id, name })
        })
        .await
    }

    /// Return the [User] with the provided identity, if any
    pub async fn retrieve_by_identity(
        identity: &UserIdentity,
        conn: DbConnection,
    ) -> Result<Option<User>, database::DatabaseError> {
        Ok(authn_user::table
            .inner_join(authn_user_identity::table)
            .select(authn_user::all_columns)
            .filter(authn_user_identity::identity.eq(identity))
            .first::<(i64, String)>(conn.write().await.deref_mut())
            .await
            .optional()?
            .map(|(id, name)| User { id, name }))
    }

    /// Return the list of [User] associated with the input list of identities.
    pub async fn get_batch_users_by_identity(
        identities: &[&UserIdentity],
        conn: &mut DbConnection,
    ) -> Result<Vec<User>, diesel::result::Error> {
        Ok(authn_user::table
            .inner_join(authn_user_identity::table)
            .select(authn_user::all_columns)
            .filter(authn_user_identity::identity.eq_any(identities))
            .load::<(i64, String)>(conn.write().await.deref_mut())
            .await?
            .into_iter()
            .map(|(id, name)| User { id, name })
            .collect::<Vec<_>>())
    }

    /// Return a mapping between user identifiers and their associated name / identities.
    pub async fn get_batch_user_identities(
        user_ids: &[i64],
        conn: &mut DbConnection,
    ) -> Result<HashMap<i64, UserInfo>, diesel::result::Error> {
        #[derive(QueryableByName)]
        struct UserIdentities {
            #[diesel(sql_type = diesel::sql_types::BigInt)]
            id: i64,
            #[diesel(sql_type = diesel::sql_types::Text)]
            name: String,
            #[diesel(sql_type = diesel::sql_types::Nullable<diesel::sql_types::Array<diesel::sql_types::Varchar>>)]
            identities: Option<Vec<String>>,
        }
        let raw_query = r"
                SELECT u.id, u.name, ARRAY_AGG(i.identity) AS identities
                FROM authn_user AS u
                LEFT JOIN authn_user_identity AS i
                ON u.id = i.user_id
                WHERE u.id = ANY($1)
                GROUP BY u.id;
            ";
        let user_identities: Vec<UserIdentities> = diesel::sql_query(raw_query)
            .bind::<diesel::sql_types::Array<diesel::sql_types::BigInt>, _>(user_ids)
            .load::<UserIdentities>(conn.write().await.deref_mut())
            .await?;
        let user_to_identities: HashMap<_, _> = user_identities
            .into_iter()
            .map(|user_identities| {
                (
                    user_identities.id,
                    UserInfo {
                        name: user_identities.name,
                        identities: user_identities
                            .identities
                            .into_iter()
                            .flatten()
                            .collect::<Vec<_>>(),
                    },
                )
            })
            .collect();
        Ok(user_to_identities)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn register_twice_fails() {
        let pool = database::DbConnectionPoolV2::for_tests();
        let conn = pool.get_ok();

        let identity = "toto".to_string();
        let name = "Toto".to_string();

        // First registration should succeed
        let user1 = User::register(conn.clone(), vec![identity.clone()], name.clone())
            .await
            .expect("First registration should succeed");

        // Verify the user can be retrieved
        let retrieved = User::retrieve_by_identity(&identity, conn.clone())
            .await
            .expect("Query should succeed")
            .expect("User should exist");

        assert_eq!(user1, retrieved);

        // Second registration with the same identity should fail
        let result = User::register(
            conn.clone(),
            vec![identity.clone()],
            "Toto Imposter".to_string(),
        )
        .await;

        assert!(
            result.is_err(),
            "Second registration with same identity should fail"
        );
    }
}
