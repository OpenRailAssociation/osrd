#[cfg(any(test, feature = "testing"))]
use std::fmt::Write as _;

use sea_orm::DatabaseConnection;
use sea_orm::DbErr;
use sea_orm::SqlxPostgresConnector;
use sea_orm::entity::prelude::async_trait::async_trait;
#[cfg(any(test, feature = "testing"))]
use sha1::Digest as _;
#[cfg(any(test, feature = "testing"))]
use sha1::Sha1;
use sqlx::ConnectOptions as _;
use sqlx::PgPool;
use sqlx::postgres::PgConnectOptions;
use sqlx::postgres::PgPoolOptions;
use tracing::trace;
use url::Url;

#[cfg(any(test, feature = "testing"))]
static TEMPLATE_CREATION_MUTEX: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[cfg(any(test, feature = "testing"))]
const TEST_DATABASE_NAME_PREFIX: &str = "osrd_test_";

#[cfg(any(test, feature = "testing"))]
static MIGRATIONS: sqlx::migrate::Migrator = sqlx::migrate!("../migrations");

#[cfg(any(test, feature = "testing"))]
const INIT_TEST_DB_SQL: &str = include_str!("../sql/init_test_db.sql");

#[cfg(any(test, feature = "testing"))]
fn migration_fingerprint() -> String {
    let mut hasher = Sha1::new();
    for migration in MIGRATIONS.iter() {
        hasher.update(migration.version.to_be_bytes());
        hasher.update([match migration.migration_type {
            sqlx::migrate::MigrationType::Simple => 0,
            sqlx::migrate::MigrationType::ReversibleUp => 1,
            sqlx::migrate::MigrationType::ReversibleDown => 2,
        }]);
        hasher.update(migration.sql.as_str().as_bytes());
    }
    hasher.update(INIT_TEST_DB_SQL.as_bytes());
    let digest = hasher.finalize();
    let mut fingerprint = String::with_capacity(digest.len() * 2);
    for byte in digest {
        write!(fingerprint, "{byte:02x}").expect("writing to a string cannot fail");
    }
    fingerprint
}

#[cfg(any(test, feature = "testing"))]
async fn db_exists(admin_pool: &PgPool, name: &str) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar("SELECT EXISTS (SELECT FROM pg_database WHERE datname = $1)")
        .bind(name)
        .fetch_one(admin_pool)
        .await
}

#[cfg(any(test, feature = "testing"))]
async fn template_creation(
    admin_pool: &PgPool,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    // Prevents other tests from interfering during template creation and avoids conflicts

    let _lock = TEMPLATE_CREATION_MUTEX.lock().await;
    let template_name = format!("osrd_template_{}", migration_fingerprint());
    let db_exists = db_exists(admin_pool, &template_name).await?;

    if !db_exists {
        let create = format!("CREATE DATABASE {template_name} WITH OWNER osrd");
        match sqlx::raw_sql(sqlx::AssertSqlSafe(create))
            .execute(admin_pool)
            .await
        {
            Ok(_) => {
                let template_url_postgres: Url =
                    format!("postgresql://postgres:password@127.0.0.1/{template_name}")
                        .parse()
                        .unwrap();
                let template_pool = create_connection_pool(template_url_postgres, 1).await?;
                sqlx::raw_sql(INIT_TEST_DB_SQL)
                    .execute(&template_pool)
                    .await?;
                template_pool.close().await;
            }
            Err(error) => {
                // If the database already exists, it means that a concurrent test run has already created it.
                // In this specific case, we can safely ignore the error.
                if !error
                    .as_database_error()
                    .is_some_and(|error| error.code().as_deref() == Some("42P04"))
                {
                    return Err(error.into());
                }
            }
        }
    }

    let template_url_osrd: Url = format!("postgresql://osrd:password@127.0.0.1/{template_name}")
        .parse()
        .unwrap();
    let template_pool = create_connection_pool(template_url_osrd, 1).await?;
    MIGRATIONS.run(&template_pool).await?;
    template_pool.close().await;

    Ok(template_name)
}

#[cfg(any(test, feature = "testing"))]
async fn create_test_database(
    admin_pool: &PgPool,
    db_name: String,
) -> Result<(String, String), Box<dyn std::error::Error + Send + Sync>> {
    let template_name = template_creation(admin_pool).await?;

    let create = format!("CREATE DATABASE {db_name} WITH TEMPLATE {template_name} OWNER osrd");
    sqlx::raw_sql(sqlx::AssertSqlSafe(create))
        .execute(admin_pool)
        .await?;
    let test_database_url = format!("postgresql://osrd:password@localhost/{db_name}");

    Ok((db_name, test_database_url))
}

/// Wrapper for connection pooling with support for test database isolation on `cfg(test)`
///
/// # Testing pool
///
/// In test mode, each test gets its own dedicated database created from a pre-migrated template.
/// This ensures complete isolation between tests without requiring transaction rollbacks.
/// The test database is automatically created when the pool is initialized and cleaned up when dropped.
///
/// A new pool is expected to be initialized for each test, see [`Db::for_tests`].
pub struct Db(
    DatabaseConnection,
    #[cfg(any(test, feature = "testing"))] bool,
);

impl Clone for Db {
    fn clone(&self) -> Self {
        #[cfg(any(test, feature = "testing"))]
        {
            Self(self.0.clone(), false)
        }
        #[cfg(not(any(test, feature = "testing")))]
        {
            Self(self.0.clone())
        }
    }
}

impl Db {
    /// Creates a connection pool with the given settings
    ///
    /// In a testing environment, you should use [`Db::for_tests`] instead.
    pub async fn try_initialize(url: Url, max_size: usize) -> Result<Self, sqlx::Error> {
        let pool = create_connection_pool(url, max_size).await?;
        let connection = SqlxPostgresConnector::from_sqlx_postgres_pool(pool);
        #[cfg(any(test, feature = "testing"))]
        {
            Ok(Self(connection, false))
        }
        #[cfg(not(any(test, feature = "testing")))]
        {
            Ok(Self(connection))
        }
    }

    /// Returns the SQLx interface to the shared pool.
    pub fn sqlx(&self) -> &PgPool {
        self.0.get_postgres_connection_pool()
    }

    pub async fn ping(&self) -> Result<(), DbErr> {
        self.0.ping().await?;
        trace!("Database ping successful");
        Ok(())
    }

    #[cfg(any(test, feature = "testing"))]
    async fn new_test(test_name: String) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let osrd_url: Url = "postgresql://postgres:password@localhost/osrd"
            .parse()
            .unwrap();
        let admin_url = create_connection_pool(osrd_url, 1).await?;
        let (_, test_db_url) = create_test_database(&admin_url, test_name).await?;
        admin_url.close().await;

        let url = Url::parse(&test_db_url).expect("Failed to parse postgresql url");
        tracing::info!(%url, "Using test database URL");
        let pool = create_connection_pool(url, 2).await?;
        Ok(Self(
            SqlxPostgresConnector::from_sqlx_postgres_pool(pool),
            true,
        ))
    }

    /// Create a connection pool for testing purposes.
    ///
    /// This API requires a multi-thread Tokio runtime as current-thread is not supported for cleanup reasons.
    #[cfg(any(test, feature = "testing"))]
    pub async fn for_tests() -> Self {
        let uuid_str = uuid::Uuid::new_v4().to_string().replace('-', "_");
        let test_name = format!("{TEST_DATABASE_NAME_PREFIX}{uuid_str}");
        Self::new_test(test_name)
            .await
            .expect("Failed to create test database")
    }
}

// Allows Db to be used where a regular sea_orm::DatabaseConnection is expected.
#[async_trait]
impl sea_orm::ConnectionTrait for Db {
    fn get_database_backend(&self) -> sea_orm::DatabaseBackend {
        self.0.get_database_backend()
    }

    async fn execute_raw(&self, stmt: sea_orm::Statement) -> Result<sea_orm::ExecResult, DbErr> {
        self.0.execute_raw(stmt).await
    }

    async fn execute_unprepared(&self, sql: &str) -> Result<sea_orm::ExecResult, DbErr> {
        self.0.execute_unprepared(sql).await
    }

    async fn query_one_raw(
        &self,
        stmt: sea_orm::Statement,
    ) -> Result<Option<sea_orm::QueryResult>, DbErr> {
        self.0.query_one_raw(stmt).await
    }

    async fn query_all_raw(
        &self,
        stmt: sea_orm::Statement,
    ) -> Result<Vec<sea_orm::QueryResult>, DbErr> {
        self.0.query_all_raw(stmt).await
    }
}

impl sea_orm::StreamTrait for Db {
    type Stream<'a> = sea_orm::QueryStream;

    fn get_database_backend(&self) -> sea_orm::DatabaseBackend {
        sea_orm::StreamTrait::get_database_backend(&self.0)
    }

    fn stream_raw<'a>(
        &'a self,
        stmt: sea_orm::Statement,
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<Self::Stream<'a>, sea_orm::DbErr>> + Send + 'a>,
    > {
        sea_orm::StreamTrait::stream_raw(&self.0, stmt)
    }
}

#[async_trait]
impl sea_orm::TransactionTrait for Db {
    type Transaction = sea_orm::DatabaseTransaction;

    async fn begin(&self) -> Result<Self::Transaction, sea_orm::DbErr> {
        sea_orm::TransactionTrait::begin(&self.0).await
    }

    async fn begin_with_config(
        &self,
        isolation_level: Option<sea_orm::IsolationLevel>,
        access_mode: Option<sea_orm::AccessMode>,
    ) -> Result<Self::Transaction, sea_orm::DbErr> {
        sea_orm::TransactionTrait::begin_with_config(&self.0, isolation_level, access_mode).await
    }

    async fn begin_with_options(
        &self,
        options: sea_orm::TransactionOptions,
    ) -> Result<Self::Transaction, sea_orm::DbErr> {
        sea_orm::TransactionTrait::begin_with_options(&self.0, options).await
    }

    async fn transaction<F, T, E>(&self, callback: F) -> Result<T, sea_orm::TransactionError<E>>
    where
        F: for<'c> FnOnce(
                &'c Self::Transaction,
            ) -> std::pin::Pin<
                Box<dyn std::future::Future<Output = Result<T, E>> + Send + 'c>,
            > + Send,
        T: Send,
        E: std::fmt::Display + std::fmt::Debug + Send,
    {
        sea_orm::TransactionTrait::transaction(&self.0, callback).await
    }

    async fn transaction_with_config<F, T, E>(
        &self,
        callback: F,
        isolation_level: Option<sea_orm::IsolationLevel>,
        access_mode: Option<sea_orm::AccessMode>,
    ) -> Result<T, sea_orm::TransactionError<E>>
    where
        F: for<'c> FnOnce(
                &'c Self::Transaction,
            ) -> std::pin::Pin<
                Box<dyn std::future::Future<Output = Result<T, E>> + Send + 'c>,
            > + Send,
        T: Send,
        E: std::fmt::Display + std::fmt::Debug + Send,
    {
        sea_orm::TransactionTrait::transaction_with_config(
            &self.0,
            callback,
            isolation_level,
            access_mode,
        )
        .await
    }
}

#[cfg(any(test, feature = "testing"))]
impl Drop for Db {
    fn drop(&mut self) {
        use tokio::sync::oneshot::error::TryRecvError;

        if !self.1 {
            return;
        }

        let name = self
            .sqlx()
            .connect_options()
            .get_database()
            .expect("Database URL should have a database name")
            .to_owned();

        // The `testing` feature also applies this destructor to databases created with
        // `try_initialize`; only names generated by `for_tests` are safe to delete.
        if !name.starts_with(TEST_DATABASE_NAME_PREFIX) {
            return;
        }

        let pool = self.0.get_postgres_connection_pool().clone();
        let (tx, mut rx) = tokio::sync::oneshot::channel::<Result<(), ()>>();
        tokio::spawn(async move {
            pool.close().await;
            let osrd_url: Url = "postgresql://postgres:password@localhost/osrd"
                .parse()
                .unwrap();
            let osrd_pool = create_connection_pool(osrd_url, 1)
                .await
                .expect("Failed to create admin connection pool");
            // close all opened connections to ensure we can drop the database
            sqlx::query(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
            )
            .bind(&name)
            .execute(&osrd_pool)
            .await
            .expect("Failed to terminate connections");
            let drop_database = format!("DROP DATABASE IF EXISTS {name}");
            sqlx::raw_sql(sqlx::AssertSqlSafe(drop_database))
                .execute(&osrd_pool)
                .await
                .expect("Failed to drop database");
            tx.send(Ok(())).unwrap();
        });
        // can't block the executor thread, must wait for tokio to run the task to completeness
        // (incompatible with current-thread runtime)
        while let Err(TryRecvError::Empty) = rx.try_recv() {}
    }
}

async fn create_connection_pool(url: Url, max_size: usize) -> Result<PgPool, sqlx::Error> {
    let max_connections = u32::try_from(max_size).expect("database pool size exceeds u32::MAX");
    let options = url
        .as_str()
        .parse::<PgConnectOptions>()?
        .disable_statement_logging();
    PgPoolOptions::new()
        .max_connections(max_connections)
        .connect_with(options)
        .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn test_connection_pool() {
        let db = Db::for_tests().await;
        db.ping().await.unwrap();

        let database_name = db
            .sqlx()
            .connect_options()
            .get_database()
            .unwrap()
            .to_owned();
        assert!(database_name.starts_with(TEST_DATABASE_NAME_PREFIX));

        let osrd_url: Url = "postgresql://postgres:password@localhost/osrd"
            .parse()
            .unwrap();
        let osrd_pool = create_connection_pool(osrd_url, 1).await.unwrap();
        let template_name = format!("osrd_template_{}", migration_fingerprint());
        let template_exists: bool =
            sqlx::query_scalar("SELECT EXISTS (SELECT FROM pg_database WHERE datname = $1)")
                .bind(template_name)
                .fetch_one(&osrd_pool)
                .await
                .unwrap();
        assert!(template_exists);
    }
}
