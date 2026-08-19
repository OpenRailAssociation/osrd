use database::Db;
use futures::StreamExt as _;
use futures::TryStreamExt as _;
use itertools::Itertools as _;
use sea_orm::ActiveModelTrait as _;
use sea_orm::ActiveValue::Set;
use sea_orm::ColumnTrait as _;
use sea_orm::DatabaseBackend;
use sea_orm::EntityTrait as _;
use sea_orm::FromQueryResult;
use sea_orm::QueryFilter as _;
use sea_orm::QuerySelect as _;
use sea_orm::Statement;
use sea_orm::StreamTrait as _;
use sea_orm::TransactionTrait as _;
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, DeriveEntityModel, Eq, PartialEq)]
#[sea_orm(table_name = "authn_user")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(column_type = "Text")]
    pub name: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "identity::Entity")]
    Identity,
}

impl Related<identity::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Identity.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}

mod identity {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, DeriveEntityModel, Eq, PartialEq)]
    #[sea_orm(table_name = "authn_user_identity")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: i64,
        pub user_id: i64,
        #[sea_orm(column_type = "Text", unique)]
        pub identity: String,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {
        #[sea_orm(
            belongs_to = "super::Entity",
            from = "Column::UserId",
            to = "super::Column::Id",
            on_delete = "Cascade"
        )]
        User,
    }

    impl Related<super::Entity> for Entity {
        fn to() -> RelationDef {
            Relation::User.def()
        }
    }

    impl ActiveModelBehavior for ActiveModel {}
}

#[derive(Debug, thiserror::Error, derive_more::From)]
pub enum AddIdentitiesError {
    #[error("duplicate identity \"{0}\"")]
    DuplicateIdentity(String),
    #[error(transparent)]
    #[from(forward)]
    Error(crate::Error),
}

impl Model {
    /// Inserts a new [Model], fails if the identity is already associated with another user
    #[tracing::instrument(skip(db), ret(level = "debug"), err)]
    pub async fn register(
        db: Db,
        identities: Vec<String>,
        name: String,
    ) -> Result<Self, AddIdentitiesError> {
        db.transaction::<_, _, AddIdentitiesError>(move |txn| {
            Box::pin(async move {
                let user = ActiveModel {
                    name: Set(name),
                    ..Default::default()
                }
                .insert(txn)
                .await?;
                let active_models =
                    identities
                        .into_iter()
                        .map(|identity_value| identity::ActiveModel {
                            user_id: Set(user.id),
                            identity: Set(identity_value),
                            ..Default::default()
                        });
                if let Err(error) = identity::Entity::insert_many(active_models).exec(txn).await {
                    let error = crate::Error::from(error);
                    return match error.unique_violation() {
                        Some(violation)
                            if violation.constraint == "authn_user_identity_identity_key" =>
                        {
                            Err(AddIdentitiesError::DuplicateIdentity(violation.value))
                        }
                        _ => Err(error.into()),
                    };
                }
                Ok(user)
            })
        })
        .await
        .map_err(|error| match error {
            sea_orm::TransactionError::Connection(error) => crate::Error::from(error).into(),
            sea_orm::TransactionError::Transaction(error) => error,
        })
    }

    /// Add one or more identity to this user
    ///
    /// Remember a model is valid in the scope of its transaction. So better run
    /// this method in a transaction to avoid races.
    #[tracing::instrument(skip_all, err)]
    pub async fn add_identities(
        &self,
        db: Db,
        identities: impl IntoIterator<Item = String>,
    ) -> Result<(), AddIdentitiesError> {
        let active_models = identities
            .into_iter()
            .map(|identity_value| identity::ActiveModel {
                user_id: Set(self.id),
                identity: Set(identity_value),
                ..Default::default()
            });
        match identity::Entity::insert_many(active_models).exec(&db).await {
            Ok(_) => Ok(()),
            Err(error) => {
                let error = crate::Error::from(error);
                match error.unique_violation() {
                    Some(violation)
                        if violation.constraint == "authn_user_identity_identity_key" =>
                    {
                        Err(AddIdentitiesError::DuplicateIdentity(violation.value))
                    }
                    _ => Err(error.into()),
                }
            }
        }
    }

    /// Return the identities for this user
    ///
    /// Remember a model is valid in the scope of its transaction. So better run
    /// this method in a transaction to avoid races.
    #[tracing::instrument(skip_all, err)]
    pub async fn get_identities(&self, db: Db) -> Result<Vec<String>, crate::Error> {
        identity::Entity::find()
            .select_only()
            .column(identity::Column::Identity)
            .filter(identity::Column::UserId.eq(self.id))
            .into_tuple()
            .all(&db)
            .await
            .map_err(crate::Error::from)
    }

    /// Return the [Model] with the provided identity, if any
    #[tracing::instrument(skip_all, fields(identity), ret(level = "debug"), err)]
    pub async fn retrieve_by_identity(
        identity: &str,
        db: Db,
    ) -> Result<Option<Self>, crate::Error> {
        Entity::find()
            .inner_join(identity::Entity)
            .filter(identity::Column::Identity.eq(identity))
            .one(&db)
            .await
            .map_err(crate::Error::from)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UserWithIdentities {
    pub user: Model,
    pub identities: Vec<String>,
}

#[derive(FromQueryResult)]
struct UserWithIdentitiesRow {
    id: i64,
    name: String,
    // authn_user_identities has a non-null constraint on identities so array items cannot be null
    // and a trigger ensures a user has at least one identity, so the array itself cannot be null
    // or empty
    identities: Vec<String>,
}

impl From<UserWithIdentitiesRow> for UserWithIdentities {
    fn from(row: UserWithIdentitiesRow) -> Self {
        Self {
            user: Model {
                id: row.id,
                name: row.name,
            },
            identities: row.identities,
        }
    }
}

impl UserWithIdentities {
    pub async fn stream(
        db: Db,
    ) -> Result<impl futures::TryStream<Ok = Self, Error = crate::Error>, crate::Error> {
        let statement = Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT u.id, u.name, ARRAY_AGG(i.identity) as identities
            FROM authn_user u
            LEFT JOIN authn_user_identity i ON i.user_id = u.id
            GROUP BY u.id
            "#,
        );
        let rows = db.stream_raw(statement).await?;
        Ok(rows.map(move |row| {
            let _ = &db;
            row.map_err(crate::Error::from).and_then(|row| {
                UserWithIdentitiesRow::from_query_result(&row, "")
                    .map(Into::into)
                    .map_err(crate::Error::from)
            })
        }))
    }

    /// Streams users whose identifiers match the provided list
    pub async fn stream_by_id(
        db: Db,
        ids: &[i64],
    ) -> Result<impl futures::TryStream<Ok = Self, Error = crate::Error>, crate::Error> {
        let statement = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT u.id, u.name, ARRAY_AGG(i.identity) as identities
            FROM authn_user u
            LEFT JOIN authn_user_identity i ON i.user_id = u.id
            WHERE u.id = ANY($1)
            GROUP BY u.id
            "#,
            [ids.to_vec().into()],
        );
        let rows = db.stream_raw(statement).await?;
        Ok(rows.map(move |row| {
            let _ = &db;
            row.map_err(crate::Error::from).and_then(|row| {
                UserWithIdentitiesRow::from_query_result(&row, "")
                    .map(Into::into)
                    .map_err(crate::Error::from)
            })
        }))
    }

    /// Streams users whose one of their identities match the provided list
    pub async fn stream_by_identity(
        db: Db,
        identities: &[impl AsRef<str> + Send],
    ) -> Result<impl futures::TryStream<Ok = Self, Error = crate::Error>, crate::Error> {
        let identities = identities
            .iter()
            .map(|identity| identity.as_ref().to_owned())
            .collect_vec();
        let statement = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
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
            [identities.into()],
        );
        let rows = db.stream_raw(statement).await?;
        Ok(rows.map(move |row| {
            let _ = &db;
            row.map_err(crate::Error::from).and_then(|row| {
                UserWithIdentitiesRow::from_query_result(&row, "")
                    .map(Into::into)
                    .map_err(crate::Error::from)
            })
        }))
    }

    /// Retrieves a user along with their identities using one of their identities
    pub async fn retrieve_by_identity(
        db: Db,
        identity: impl AsRef<str> + Send,
    ) -> Result<Option<Self>, crate::Error> {
        let identities = [identity];
        Self::stream_by_identity(db, &identities)
            .await?
            .try_next()
            .await
    }
}

#[cfg(test)]
mod tests {
    use pretty_assertions::assert_eq;

    use super::*;
    use crate::authn::user;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn register_twice_fails() {
        let db = Db::for_tests().await;

        let identity = "toto".to_string();
        let name = "Toto".to_string();

        // First registration should succeed
        let user1 = user::Model::register(db.clone(), vec![identity.clone()], name.clone())
            .await
            .expect("First registration should succeed");

        // Verify the user can be retrieved
        let retrieved = user::Model::retrieve_by_identity(&identity, db.clone())
            .await
            .expect("Query should succeed")
            .expect("User should exist");

        assert_eq!(user1, retrieved);

        // Second registration with the same identity should fail
        let result = user::Model::register(
            db.clone(),
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
        let db = Db::for_tests().await;

        let alice = user::Model::register(
            db.clone(),
            vec!["alice".to_owned(), "alice.alt".to_owned()],
            "Alice".to_owned(),
        )
        .await
        .unwrap();
        let bob = user::Model::register(db.clone(), vec!["bob".to_owned()], "Bob".to_string())
            .await
            .unwrap();

        let users = UserWithIdentities::stream(db)
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
        let db = Db::for_tests().await;

        let user = user::Model::register(db.clone(), vec!["toto".to_owned()], "Toto".to_owned())
            .await
            .unwrap();

        user.add_identities(db.clone(), vec!["titi".to_owned(), "grosminet".to_owned()])
            .await
            .expect("adding new identities should succeed");

        user.add_identities(db.clone(), vec!["toto".to_owned()])
            .await
            .expect_err("adding duplicate identity should fail");

        assert_eq!(
            user.get_identities(db)
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
        let db = Db::for_tests().await;

        let alice = user::Model::register(
            db.clone(),
            vec!["alice".to_owned(), "alice.alt".to_owned()],
            "Alice".to_owned(),
        )
        .await
        .expect("Alice should be created");
        let bob = user::Model::register(db.clone(), vec!["bob".to_owned()], "Bob".to_string())
            .await
            .expect("Bob should be created");

        let users = UserWithIdentities::stream_by_id(db, &[alice.id, bob.id, -1])
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
        let db = Db::for_tests().await;

        let alice = user::Model::register(
            db.clone(),
            vec!["alice".to_owned(), "alice.alt".to_owned()],
            "Alice".to_owned(),
        )
        .await
        .expect("Alice should be created");
        let bob = user::Model::register(db.clone(), vec!["bob".to_owned()], "Bob".to_string())
            .await
            .expect("Bob should be created");

        let users = UserWithIdentities::stream_by_identity(db.clone(), &["alice", "bob"])
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
            UserWithIdentities::retrieve_by_identity(db.clone(), "alice.alt")
                .await
                .unwrap(),
            Some(UserWithIdentities {
                user: alice,
                identities: vec!["alice".to_owned(), "alice.alt".to_owned()],
            })
        );
        assert_eq!(
            UserWithIdentities::retrieve_by_identity(db.clone(), "charlie")
                .await
                .unwrap(),
            None
        );
    }
}
