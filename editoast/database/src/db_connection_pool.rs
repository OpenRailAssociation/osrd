mod tracing_instrumentation;

use std::ops::Deref;
use std::ops::DerefMut;
use std::sync::Arc;

use diesel::ConnectionError;
use diesel::ConnectionResult;
use diesel::sql_query;
use diesel_async::AsyncConnection;
use diesel_async::AsyncPgConnection;
use diesel_async::RunQueryDsl;
use diesel_async::pooled_connection::AsyncDieselConnectionManager;
use diesel_async::pooled_connection::ManagerConfig;
use diesel_async::pooled_connection::deadpool::Object;
use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::scoped_futures::ScopedBoxFuture;
use futures::Future;
use futures::future::BoxFuture;
use futures_util::FutureExt as _;
use openssl::ssl::SslConnector;
use openssl::ssl::SslMethod;
use openssl::ssl::SslVerifyMode;
use tokio::sync::OwnedRwLockWriteGuard;
use tokio::sync::RwLock;
use tracing::trace;
use url::Url;

use crate::DatabaseError;

pub type DbConnectionConfig = AsyncDieselConnectionManager<AsyncPgConnection>;

#[cfg(any(test, feature = "testing"))]
static TEMPLATE_CREATION_MUTEX: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[cfg(any(test, feature = "testing"))]
const MIGRATIONS: diesel_migrations::EmbeddedMigrations = diesel_migrations::embed_migrations!();

#[cfg(any(test, feature = "testing"))]
async fn db_exists(url: &str) -> bool {
    match AsyncPgConnection::establish(url).await {
        Ok(_) => true,
        Err(ConnectionError::CouldntSetupConfiguration(diesel::result::Error::DatabaseError(
            _,
            err,
        ))) if err.message().ends_with("does not exist") => false,
        Err(_) => panic!("Couldn't connect to database"),
    }
}

#[cfg(any(test, feature = "testing"))]
async fn template_creation(
    osrd_conn: DbConnection,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    // Prevents other tests from interfering during template creation and avoids conflicts

    use diesel::migration::MigrationSource;
    use diesel::pg::Pg;
    use diesel_async::AsyncMigrationHarness;
    use diesel_migrations::MigrationHarness as _;

    let _lock = TEMPLATE_CREATION_MUTEX.lock().await;
    let last_migration_name = MigrationSource::<Pg>::migrations(&MIGRATIONS)?
        .last()
        .map(|migration| migration.name())
        .map(ToString::to_string)
        .map(|name| name.replace('-', "_"))
        .unwrap_or_else(|| String::from("no_migration"));
    let template_name = format!("osrd_template_{last_migration_name}");

    let template_url_postgres: Url =
        format!("postgresql://postgres:password@localhost/{template_name}")
            .parse()
            .unwrap();
    let template_url_osrd: Url = format!("postgresql://osrd:password@localhost/{template_name}")
        .parse()
        .unwrap();

    let db_exists = db_exists(template_url_postgres.as_str()).await;

    if !db_exists {
        diesel::sql_query(format!("CREATE DATABASE {template_name} WITH OWNER osrd"))
            .execute(&mut osrd_conn.write().await)
            .await
            .or_else(|e| {
                // If the database already exists, it means that a concurrent test run has already created it.
                // In this specific case, we can safely ignore the error.
                if let diesel::result::Error::DatabaseError(_, ref err) = e
                    && err.message().ends_with("already exists")
                {
                    Ok(0)
                } else {
                    Err(e)
                }
            })?;

        let template_pool = create_connection_pool(template_url_postgres.clone(), 1)?;
        let mut conn = template_pool.get().await?;

        use diesel_async::SimpleAsyncConnection as _;
        let sql_content = include_str!("../sql/init_test_db.sql");
        conn.batch_execute(sql_content).await?;
    }

    let template_pool = create_connection_pool(template_url_osrd, 1)?;
    let mut migration_harness = AsyncMigrationHarness::new(template_pool.get().await?);
    migration_harness.run_pending_migrations(MIGRATIONS)?;

    Ok(template_name)
}

#[cfg(any(test, feature = "testing"))]
async fn create_test_database(
    osrd_conn: DbConnection,
    db_name: String,
) -> Result<(String, String), Box<dyn std::error::Error + Send + Sync>> {
    let template_name = template_creation(osrd_conn.clone()).await?;

    diesel::sql_query(format!(
        "CREATE DATABASE {db_name} WITH TEMPLATE {template_name} OWNER osrd"
    ))
    .execute(&mut osrd_conn.write().await)
    .await?;
    let test_database_url = format!("postgresql://osrd:password@localhost/{db_name}");

    Ok((db_name, test_database_url))
}

#[derive(Clone)]
pub struct DbConnection {
    inner: Arc<RwLock<Object<AsyncPgConnection>>>,
}

pub struct WriteHandle {
    guard: OwnedRwLockWriteGuard<Object<AsyncPgConnection>>,
}

impl DbConnection {
    pub fn new(inner: Arc<RwLock<Object<AsyncPgConnection>>>) -> Self {
        Self { inner }
    }

    pub async fn write(&self) -> WriteHandle {
        WriteHandle {
            guard: self.inner.clone().write_owned().await,
        }
    }

    // Implementation of this function is taking a strong inspiration from
    // https://docs.rs/diesel/2.1.6/src/diesel/connection/transaction_manager.rs.html#50-71
    // Sadly, this function is private so we can't use it.
    //
    // :WARNING: If you ever need to modify this function, please take a look at the
    // original `diesel` function, they probably do it right more than us.
    pub async fn transaction<'a, R, E, F>(&self, callback: F) -> std::result::Result<R, E>
    where
        F: FnOnce(Self) -> ScopedBoxFuture<'a, 'a, std::result::Result<R, E>> + Send + 'a,
        E: From<DatabaseError> + Send + 'a,
        R: Send + 'a,
    {
        use diesel_async::TransactionManager as _;

        type TxManager = <AsyncPgConnection as AsyncConnection>::TransactionManager;

        {
            let mut handle = self.write().await;
            TxManager::begin_transaction(handle.deref_mut())
                .await
                .map_err(DatabaseError)?;
        }

        match callback(self.clone()).await {
            Ok(result) => {
                let mut handle = self.write().await;
                TxManager::commit_transaction(handle.deref_mut())
                    .await
                    .map_err(DatabaseError)?;
                Ok(result)
            }
            Err(callback_error) => {
                let mut handle = self.write().await;
                match TxManager::rollback_transaction(handle.deref_mut()).await {
                    Ok(()) | Err(diesel::result::Error::BrokenTransactionManager) => {
                        Err(callback_error)
                    }
                    Err(rollback_error) => Err(E::from(DatabaseError(rollback_error))),
                }
            }
        }
    }

    pub async fn rollback_transaction(&self) -> Result<(), DatabaseError> {
        use diesel_async::TransactionManager as _;

        let mut handle = self.write().await;
        <AsyncPgConnection as AsyncConnection>::TransactionManager::rollback_transaction(
            handle.deref_mut(),
        )
        .await
        .map_err(DatabaseError)
    }
}

impl Deref for WriteHandle {
    type Target = AsyncPgConnection;

    fn deref(&self) -> &Self::Target {
        self.guard.deref()
    }
}

impl DerefMut for WriteHandle {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.guard.deref_mut()
    }
}

/// Wrapper for connection pooling with support for test database isolation on `cfg(test)`
///
/// # Testing pool
///
/// In test mode, each test gets its own dedicated database created from a pre-migrated template.
/// This ensures complete isolation between tests without requiring transaction rollbacks.
/// The test database is automatically created when the pool is initialized and cleaned up when dropped.
///
/// A new pool is expected to be initialized for each test, see `DbConnectionPoolV2::for_tests`.
#[derive(Clone)]
pub struct DbConnectionPoolV2 {
    pool: Arc<Pool<AsyncPgConnection>>,
    #[cfg(any(test, feature = "testing"))]
    osrd_pool: Arc<Pool<AsyncPgConnection>>,
    #[cfg(any(test, feature = "testing"))]
    test_db_name: String,
}

#[cfg(any(test, feature = "testing"))]
impl Default for DbConnectionPoolV2 {
    fn default() -> Self {
        Self::for_tests()
    }
}

#[derive(Debug, thiserror::Error)]
#[error("an error occurred while building the database pool: '{0}'")]
pub struct DatabasePoolBuildError(#[from] diesel_async::pooled_connection::deadpool::BuildError);

#[derive(Debug, thiserror::Error)]
#[error("an error occurred while getting a connection from the database pool: '{0}'")]
pub struct DatabasePoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError);

impl DbConnectionPoolV2 {
    /// Get inner pool for retro compatibility
    pub fn pool_v1(&self) -> Arc<Pool<AsyncPgConnection>> {
        self.pool.clone()
    }

    /// Creates a connection pool with the given settings
    ///
    /// In a testing environment, you should use `DbConnectionPoolV2::for_tests` instead.
    pub async fn try_initialize(url: Url, max_size: usize) -> Result<Self, DatabasePoolBuildError> {
        let pool = create_connection_pool(url, max_size)?.into();
        #[cfg(any(test, feature = "testing"))]
        let pool = Self {
            pool,
            osrd_pool: create_connection_pool(
                "postgresql://postgres:password@localhost/osrd"
                    .parse()
                    .unwrap(),
                1,
            )?
            .into(),
            test_db_name: "default".to_string(),
        };
        #[cfg(not(any(test, feature = "testing")))]
        let pool = Self { pool };
        Ok(pool)
    }

    /// Get a connection from the pool
    ///
    /// This function behaves differently in test mode.
    ///
    /// # Production mode
    ///
    /// In production mode, this function will just return a connection from the pool, which may
    /// hold several opened. This function is intended to be a drop-in replacement for the
    /// `deadpool`'s `get` function.
    /// ```
    pub async fn get(&self) -> Result<DbConnection, DatabasePoolError> {
        use diesel_async::AsyncConnection as _;

        let mut connection = self.pool.get().await?;
        connection.set_instrumentation(tracing_instrumentation::TracingInstrumentation::default());
        Ok(DbConnection::new(Arc::new(RwLock::new(connection))))
    }

    /// Gets a test connection from the pool synchronously, failing if the connection is not available
    ///
    /// In unit tests, this is the preferred way to get a connection
    ///
    /// See [DbConnectionPoolV2::get] for more information on how connections should be used
    /// in tests.
    #[cfg(any(test, feature = "testing"))]
    pub fn get_ok(&self) -> DbConnection {
        futures::executor::block_on(self.get()).expect("Failed to get test connection")
    }

    /// Returns an infinite iterator of futures resolving to connections acquired from the pool
    ///
    /// Meant to be used in conjunction with `zip` in order to instantiate a bunch of tasks to spawn.
    ///
    /// # Example
    ///
    /// ```
    /// # trait DoSomething: Sized {
    /// #   async fn do_something(self, conn: &mut database::DbConnection) -> Result<(), database::db_connection_pool::DatabasePoolError> {
    /// #     // Do something with the connection
    /// #     Ok(())
    /// #   }
    /// # }
    /// # impl DoSomething for u8 {}
    /// # #[tokio::main]
    /// # async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync + 'static>> {
    /// #   let items = vec![0_u8; 2];
    ///    #[cfg(not(any(test, feature = "testing")))]
    ///    let pool = {
    ///        let url = "postgresql://postgres:password@localhost/osrd".parse().unwrap();
    ///        futures::executor::block_on(database::DbConnectionPoolV2::try_initialize(url, 1)).unwrap()
    ///    };
    ///    #[cfg(any(test, feature = "testing"))]
    ///    let pool = database::DbConnectionPoolV2::for_tests();
    ///    let operations =
    ///        items.into_iter()
    ///            .zip(pool.iter_conn())
    ///            .map(|(item, conn)| async move {
    ///                let mut conn = conn.await?; // note the await here
    ///                item.do_something(&mut conn).await
    ///            });
    ///    let results = futures::future::try_join_all(operations).await?;
    ///    // you may acquire a new connection afterwards
    /// #   Ok(())
    /// # }
    /// ```
    pub fn iter_conn(
        &self,
    ) -> impl Iterator<Item = impl Future<Output = Result<DbConnection, DatabasePoolError>> + '_>
    {
        std::iter::repeat_with(|| self.get())
    }

    #[cfg(any(test, feature = "testing"))]
    async fn new_test(test_name: String) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let osrd_pool = Arc::new(create_connection_pool(
            "postgresql://postgres:password@localhost/osrd"
                .parse()
                .unwrap(),
            1,
        )?);
        let osrd_conn = osrd_pool.get().await?;
        let osrd_conn = DbConnection::new(Arc::new(RwLock::new(osrd_conn)));
        let (test_db_name, test_db_url) = create_test_database(osrd_conn, test_name).await?;
        let url = Url::parse(&test_db_url).expect("Failed to parse postgresql url");
        tracing::info!(%url, "Using test database URL");
        let pool = create_connection_pool(url, 2)?.into();
        Ok(Self {
            pool,
            osrd_pool,
            test_db_name,
        })
    }

    /// Create a connection pool for testing purposes.
    #[cfg(any(test, feature = "testing"))]
    pub fn for_tests() -> Self {
        let uuid_str = uuid::Uuid::new_v4().to_string().replace('-', "_");
        let test_name = format!("test_{uuid_str}");
        futures::executor::block_on(Self::new_test(test_name))
            .expect("Failed to create test database")
    }
}

#[cfg(any(test, feature = "testing"))]
impl Drop for DbConnectionPoolV2 {
    fn drop(&mut self) {
        use tokio::sync::oneshot::error::TryRecvError;

        let name = self.test_db_name.clone();
        let osrd_pool = self.osrd_pool.clone();
        let (tx, mut rx) = tokio::sync::oneshot::channel::<Result<(), ()>>();
        tokio::spawn(async move {
            let mut conn = osrd_pool.get().await.expect("Failed to get connection");
            // close all opened connections to ensure we can drop the database
            diesel::sql_query(format!(
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{name}'"
            ))
            .execute(&mut conn)
            .await
            .expect("Failed to terminate connections");
            diesel::sql_query(format!("DROP DATABASE IF EXISTS {name}"))
                .execute(&mut conn)
                .await
                .expect("Failed to drop database");
            tx.send(Ok(())).unwrap();
        });
        // can't block the executor thread, must wait for tokio to run the task to completeness
        while let Err(TryRecvError::Empty) = rx.try_recv() {}
    }
}

#[derive(Debug, thiserror::Error)]
#[error("could not ping the database: '{0}'")]
pub struct PingError(#[from] diesel::result::Error);

pub async fn ping_database(conn: &mut DbConnection) -> Result<(), PingError> {
    sql_query("SELECT 1")
        .execute(conn.write().await.deref_mut())
        .await?;
    trace!("Database ping successful");
    Ok(())
}

fn create_connection_pool(
    url: Url,
    max_size: usize,
) -> Result<Pool<AsyncPgConnection>, DatabasePoolBuildError> {
    let mut manager_config = ManagerConfig::default();
    manager_config.custom_setup = Box::new(establish_connection);
    let manager = DbConnectionConfig::new_with_config(url, manager_config);
    Ok(Pool::builder(manager).max_size(max_size).build()?)
}

fn establish_connection(config: &str) -> BoxFuture<'_, ConnectionResult<AsyncPgConnection>> {
    let fut = async {
        let mut connector_builder = SslConnector::builder(SslMethod::tls()).unwrap();
        connector_builder.set_verify(SslVerifyMode::NONE);
        let tls = postgres_openssl::MakeTlsConnector::new(connector_builder.build());
        let (client, conn) = tokio_postgres::connect(config, tls)
            .await
            .map_err(|e| ConnectionError::BadConnection(e.to_string()))?;
        // The connection object performs the actual communication with the database,
        // so spawn it off to run on its own.
        tokio::spawn(async move {
            if let Err(e) = conn.await {
                tracing::error!("connection error: {}", e);
            }
        });
        AsyncPgConnection::try_from(client).await
    };
    fut.boxed()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn test_connection_pool() {
        let uuid_str = uuid::Uuid::new_v4().to_string().replace('-', "_");
        let test_name = format!("test_{uuid_str}");
        let db = DbConnectionPoolV2::new_test(test_name).await.unwrap();

        let osrd_conn = db.osrd_pool.get().await.expect("Failed to get connection");
        let osrd_conn = DbConnection::new(Arc::new(RwLock::new(osrd_conn)));

        diesel::sql_query("SELECT 1".to_string())
            .execute(&mut osrd_conn.write().await)
            .await
            .expect("Failed to execute query");
    }
}
