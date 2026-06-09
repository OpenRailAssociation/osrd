use std::collections::HashMap;
use std::ops::DerefMut;

use authz::identity::UserIdentity;
use authz::identity::UserInfo;
use database::DbConnection;
use database::tables::authn_user;
use database::tables::authn_user_identity;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use editoast_derive::Model;
use itertools::Itertools as _;

#[derive(Debug, Clone, PartialEq, Eq, Model)]
#[model(table = database::tables::authn_user)]
#[model(gen(ops = rd, batch_ops = r, list))]
pub struct User {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, thiserror::Error, derive_more::From)]
pub enum AddIdentitiesError {
    #[error("duplicate identity \"{0}\"")]
    DuplicateIdentity(String),
    #[error(transparent)]
    #[from(forward)]
    Error(crate::Error),
}

impl User {
    /// Inserts a new [User], fails if the identity is already associated with another user
    #[tracing::instrument(skip(conn), ret(level = "debug"), err)]
    pub async fn register(
        conn: DbConnection,
        identities: Vec<String>,
        name: String,
    ) -> Result<User, AddIdentitiesError> {
        conn.transaction(async move |conn| {
            let id = diesel::dsl::insert_into(authn_user::table)
                .values(authn_user::name.eq(&name))
                .returning(authn_user::id)
                .get_result::<i64>(&mut conn.write().await)
                .await?;
            let user = Self { id, name };
            user.add_identities(conn, identities).await?;
            Ok(user)
        })
        .await
    }

    /// Add one or more identity to this user
    ///
    /// Remember a model is valid in the scope of its transaction. So better run
    /// this method in a transaction to avoid races.
    #[tracing::instrument(skip_all, err)]
    pub async fn add_identities(
        &self,
        conn: DbConnection,
        identities: impl IntoIterator<Item = String>,
    ) -> Result<(), AddIdentitiesError> {
        let mut conn = conn.write().await;
        match diesel::dsl::insert_into(authn_user_identity::table)
            .values(
                identities
                    .into_iter()
                    .map(|identity| {
                        (
                            authn_user_identity::user_id.eq(self.id),
                            authn_user_identity::identity.eq(identity),
                        )
                    })
                    .collect_vec(),
            )
            .execute(&mut conn)
            .await
            .map_err(crate::Error::from)
        {
            Ok(_) => Ok(()),
            Err(crate::Error::UniqueViolation {
                constraint,
                column: _,
                value,
            }) if &constraint == "authn_user_identity_identity_key" => {
                Err(AddIdentitiesError::DuplicateIdentity(value))
            }
            Err(err) => Err(AddIdentitiesError::from(err)),
        }
    }

    /// Return the identities for this user
    ///
    /// Remember a model is valid in the scope of its transaction. So better run
    /// this method in a transaction to avoid races.
    #[tracing::instrument(skip_all, err)]
    pub async fn get_identities(
        &self,
        conn: DbConnection,
    ) -> Result<Vec<UserIdentity>, database::DatabaseError> {
        Ok(authn_user_identity::table
            .select(authn_user_identity::identity)
            .filter(authn_user_identity::user_id.eq(self.id))
            .load::<String>(conn.write().await.deref_mut())
            .await?)
    }

    /// Return the [User] with the provided identity, if any
    #[tracing::instrument(skip_all, fields(identity), ret(level = "debug"), err)]
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
        identities: &[UserIdentity],
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserWithIdentities {
    pub user: User,
    pub identities: Vec<String>,
}

#[derive(diesel::QueryableByName)]
struct UserWithIdentitiesRow {
    #[diesel(sql_type = diesel::sql_types::BigInt)]
    id: i64,
    #[diesel(sql_type = diesel::sql_types::Text)]
    name: String,
    // authn_user_identities has a non-null constraint on identities so array items cannot be null
    // and a trigger ensures a user has at least one identity, so the array itself cannot be null
    // or empty
    #[diesel(sql_type = diesel::sql_types::Array<diesel::sql_types::Text>)]
    identities: Vec<String>,
}

impl From<UserWithIdentitiesRow> for UserWithIdentities {
    fn from(row: UserWithIdentitiesRow) -> Self {
        Self {
            user: User {
                id: row.id,
                name: row.name,
            },
            identities: row.identities,
        }
    }
}

impl UserWithIdentities {
    pub async fn stream(
        conn: database::DbConnection,
    ) -> Result<
        impl futures::stream::TryStream<Ok = Self, Error = database::DatabaseError>,
        database::DatabaseError,
    > {
        use futures::TryStreamExt as _;

        let query = diesel::sql_query(
            r#"
            SELECT u.id, u.name, ARRAY_AGG(i.identity) as identities
            FROM authn_user u
            LEFT JOIN authn_user_identity i ON i.user_id = u.id
            GROUP BY u.id
            "#,
        );

        Ok(query
            .load_stream::<UserWithIdentitiesRow>(&mut conn.write().await)
            .await?
            .map_ok(Self::from)
            .map_err(database::DatabaseError::from))
    }

    /// Streams users whose identifiers match the provided list
    pub async fn stream_by_id(
        conn: database::DbConnection,
        ids: &[i64],
    ) -> Result<
        impl futures::stream::TryStream<Ok = Self, Error = database::DatabaseError>,
        database::DatabaseError,
    > {
        use futures::TryStreamExt as _;

        let query = diesel::sql_query(
            r#"
            SELECT u.id, u.name, ARRAY_AGG(i.identity) as identities
            FROM authn_user u
            LEFT JOIN authn_user_identity i ON i.user_id = u.id
            WHERE u.id = ANY($1)
            GROUP BY u.id
            "#,
        )
        .bind::<diesel::sql_types::Array<diesel::sql_types::BigInt>, _>(ids);

        Ok(query
            .load_stream::<UserWithIdentitiesRow>(&mut conn.write().await)
            .await?
            .map_ok(Self::from)
            .map_err(database::DatabaseError::from))
    }

    /// Streams users whose one of their identities match the provided list
    pub async fn stream_by_identity(
        conn: database::DbConnection,
        identities: &[impl AsRef<str> + Send],
    ) -> Result<
        impl futures::stream::TryStream<Ok = Self, Error = database::DatabaseError>,
        database::DatabaseError,
    > {
        use futures::TryStreamExt as _;

        let query = diesel::sql_query(
            r#"
            SELECT u.id, u.name, ARRAY_AGG(i.identity) as identities
            FROM authn_user u
            LEFT JOIN authn_user_identity i ON i.user_id = u.id
            WHERE u.id IN (
              SELECT ui.user_id
              FROM authn_user_identity ui
              WHERE ui.identity = ANY($1)
            )
            GROUP BY u.id
            "#,
        )
        .bind::<diesel::sql_types::Array<diesel::sql_types::Text>, _>(
            identities.iter().map(AsRef::as_ref).collect_vec(),
        );

        Ok(query
            .load_stream::<UserWithIdentitiesRow>(&mut conn.write().await)
            .await?
            .map_ok(Self::from)
            .map_err(database::DatabaseError::from))
    }

    /// Retrieves a user along with their identities using one of their identities
    pub async fn retrieve_by_identity(
        conn: database::DbConnection,
        identity: impl AsRef<str> + Send,
    ) -> Result<Option<Self>, database::DatabaseError> {
        use futures::stream::TryStreamExt as _;
        let identities = [identity];
        let mut stream = Self::stream_by_identity(conn, &identities).await?;
        stream.try_next().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures::stream::TryStreamExt as _;
    use pretty_assertions::assert_eq;

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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stream() {
        let pool = database::DbConnectionPoolV2::for_tests();
        let conn = pool.get_ok();

        let alice = User::register(
            conn.clone(),
            vec!["alice".to_owned(), "alice.alt".to_owned()],
            "Alice".to_owned(),
        )
        .await
        .unwrap();
        let bob = User::register(conn.clone(), vec!["bob".to_owned()], "Bob".to_string())
            .await
            .unwrap();

        let users = UserWithIdentities::stream(conn)
            .await
            .unwrap()
            .try_collect::<Vec<_>>()
            .await
            .unwrap();

        assert_eq!(
            users,
            vec![
                UserWithIdentities {
                    user: alice,
                    identities: vec!["alice".to_owned(), "alice.alt".to_owned()],
                },
                UserWithIdentities {
                    user: bob,
                    identities: vec!["bob".to_owned()],
                },
            ]
        );
    }
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn add_duplicate_identity_fails() {
        let pool = database::DbConnectionPoolV2::for_tests();
        let conn = pool.get_ok();

        let user = User::register(conn.clone(), vec!["toto".to_owned()], "Toto".to_owned())
            .await
            .unwrap();

        user.add_identities(
            conn.clone(),
            vec!["titi".to_owned(), "grosminet".to_owned()],
        )
        .await
        .expect("adding new identities should succeed");

        user.add_identities(conn.clone(), vec!["toto".to_owned()])
            .await
            .expect_err("adding duplicate identity should fail");

        assert_eq!(
            user.get_identities(conn)
                .await
                .unwrap()
                .iter()
                .sorted()
                .collect_vec(),
            vec!["grosminet", "titi", "toto"]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stream_by_id() {
        let pool = database::DbConnectionPoolV2::for_tests();
        let conn = pool.get_ok();

        let alice = User::register(
            conn.clone(),
            vec!["alice".to_owned(), "alice.alt".to_owned()],
            "Alice".to_owned(),
        )
        .await
        .expect("Alice should be created");
        let bob = User::register(conn.clone(), vec!["bob".to_owned()], "Bob".to_string())
            .await
            .expect("Bob should be created");

        let users = UserWithIdentities::stream_by_id(conn.clone(), &[alice.id, bob.id, -1])
            .await
            .expect("stream should be created")
            .try_collect::<Vec<_>>()
            .await
            .expect("stream should succeed");
        assert_eq!(
            users,
            vec![
                UserWithIdentities {
                    user: alice,
                    identities: vec!["alice".to_owned(), "alice.alt".to_owned()],
                },
                UserWithIdentities {
                    user: bob,
                    identities: vec!["bob".to_owned()],
                }
            ]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn stream_by_identity() {
        let pool = database::DbConnectionPoolV2::for_tests();
        let conn = pool.get_ok();

        let alice = User::register(
            conn.clone(),
            vec!["alice".to_owned(), "alice.alt".to_owned()],
            "Alice".to_owned(),
        )
        .await
        .expect("Alice should be created");
        let bob = User::register(conn.clone(), vec!["bob".to_owned()], "Bob".to_string())
            .await
            .expect("Bob should be created");

        let users = UserWithIdentities::stream_by_identity(conn.clone(), &["alice", "bob"])
            .await
            .expect("stream should be created")
            .try_collect::<Vec<_>>()
            .await
            .expect("stream should succeed");

        assert_eq!(
            users,
            vec![
                UserWithIdentities {
                    user: alice.clone(),
                    identities: vec!["alice".to_owned(), "alice.alt".to_owned()],
                },
                UserWithIdentities {
                    user: bob,
                    identities: vec!["bob".to_owned()],
                }
            ]
        );

        assert_eq!(
            UserWithIdentities::retrieve_by_identity(conn.clone(), "alice.alt")
                .await
                .unwrap(),
            Some(UserWithIdentities {
                user: alice,
                identities: vec!["alice".to_owned(), "alice.alt".to_owned()],
            })
        );
        assert_eq!(
            UserWithIdentities::retrieve_by_identity(conn.clone(), "charlie")
                .await
                .unwrap(),
            None
        );
    }
}
