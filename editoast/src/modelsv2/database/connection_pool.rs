use diesel::ConnectionError;
use diesel::ConnectionResult;
use diesel_async::pooled_connection::deadpool::Object;
use diesel_async::pooled_connection::deadpool::Pool;

use diesel_async::pooled_connection::ManagerConfig;
use diesel_async::AsyncPgConnection;
use futures::future::BoxFuture;
use futures::Future;
use futures_util::FutureExt as _;
use openssl::ssl::SslConnector;
use openssl::ssl::SslMethod;
use openssl::ssl::SslVerifyMode;
use std::sync::Arc;
use url::Url;

#[cfg(test)]
use tokio::sync::OwnedRwLockWriteGuard;
#[cfg(test)]
use tokio::sync::RwLock;

use super::DbConnection;
use super::DbConnectionConfig;
use super::DbConnectionError;
use super::DbConnectionPool;

#[cfg(test)]
pub type DbConnectionV2 = OwnedRwLockWriteGuard<Object<AsyncPgConnection>>;

#[cfg(not(test))]
pub type DbConnectionV2 = Object<AsyncPgConnection>;

/// Wrapper for connection pooling with support for test connections on `cfg(test)`
///
/// # Testing pool
///
/// In test mode, the [DbConnectionPool::get] function will always return the same connection that has
/// been setup to drop all modification once the test ends.
/// Since this connection will not commit any changes to the database, we ensure the isolation of each test.
///
/// A new pool is expected to be initialized for each test, see `DbConnectionPoolV2::for_tests`.
#[derive(Clone)]
pub struct DbConnectionPoolV2 {
    pool: Arc<Pool<AsyncPgConnection>>,
    #[cfg(test)]
    test_connection: Option<Arc<RwLock<Object<AsyncPgConnection>>>>,
}

#[cfg(test)]
impl Default for DbConnectionPoolV2 {
    fn default() -> Self {
        Self::for_tests()
    }
}

impl DbConnectionPoolV2 {
    /// Get inner pool for retro compatibility
    pub fn pool_v1(&self) -> Arc<Pool<AsyncPgConnection>> {
        self.pool.clone()
    }

    /// Creates a connection pool with the given settings
    ///
    /// In a testing environment, you should use `DbConnectionPoolV2::for_tests` instead.
    pub async fn try_initialize(url: Url, max_size: usize) -> Result<Self, DbConnectionError> {
        let pool = create_connection_pool(url, max_size)?;
        Self::try_from_pool(Arc::new(pool)).await
    }

    #[cfg(test)]
    async fn get_connection(&self) -> Result<DbConnectionV2, DbConnectionError> {
        if let Some(test_connection) = &self.test_connection {
            let connection = test_connection.clone().write_owned().await;
            Ok(connection)
        } else {
            Err(DbConnectionError::TestConnection)
        }
    }

    #[cfg(not(test))]
    async fn get_connection(&self) -> Result<DbConnectionV2, DbConnectionError> {
        let connection = self.pool.get().await?;
        Ok(connection)
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
    ///
    /// # Test mode
    ///
    /// In test mode, this function will return the same connection that has been setup to drop all
    /// modifications once the test ends. This connection is intended to be used in unit tests to
    /// ensure the isolation of each test.
    ///
    /// ## Pitfalls
    ///
    /// However, this comes with several limitations on how connections are used globally.
    ///
    /// 1. Once a connection is used, it should be dropped **AS SOON AS POSSIBLE**. Failing to do so
    ///    may lead to deadlocks. Example:
    ///
    /// ```rust
    /// let conn = pool.get_ok();
    /// // Do something with conn
    ///
    /// // This will deadlock because `conn` hasn't been droped yet. Since this function is
    /// // not async, this is equivalent to an infinite loop.
    /// let conn2 = pool.get_ok();
    /// ```
    ///
    /// 2. If several futures are spawned and each use their own connection, you should make sure
    ///    that the connection usage follows its acquisition. Failing to do so is equivalent to
    ///    the following example:
    ///
    /// ```rust
    /// let conn_futures = (0..10).map(|_| async { pool.get() });
    /// let deadlock = futures::future::join_all(conn_futures).await;
    /// ```
    ///
    /// ## Guidelines
    ///
    /// To prevent these issues, prefer the following patterns:
    ///
    /// - Don't declare a variable for a single-use connection:
    ///
    /// ```rust
    /// // do
    /// my_function_using_conn(pool.get().await?.deref_mut()).await;
    /// // instead of
    /// let conn = &mut pool.get().await?;
    /// my_function_using_conn(conn).await;
    /// ```
    ///
    /// - If a connection is used repeatedly, prefer using explicit scoping:
    ///
    /// ```rust
    /// let my_results = {
    ///     let conn = &mut pool.get().await?;
    ///     foo(conn).await + bar(conn).await
    /// };
    /// // you may acquire a new connection afterwards
    /// ```
    ///
    /// - If you need to open several connections, then the connection must be
    ///   acquired just before its usage, and dropped just after, **all in the same future**.
    ///   And these futures must all be awaited before attempting to acquire a new connection.
    ///
    /// ```rust
    /// let operations =
    ///     items.into_iter()
    ///         .zip(pool.iter_conn())
    ///         .map(|(item, conn)| async {
    ///             let conn = conn.await?; // note the await here
    ///             item.do_something(conn).await
    ///         });
    /// let results = futures::future::try_join_all(operations).await?;
    /// // you may acquire a new connection afterwards
    /// ```
    pub async fn get(&self) -> Result<DbConnectionV2, DbConnectionError> {
        self.get_connection().await
    }

    /// Gets a test connection from the pool synchronously, failing if the connection is not available
    ///
    /// In unit tests, this is the preferred way to get a connection
    ///
    /// See [DbConnectionPoolV2::get] for more information on how connections should be used
    /// in tests.
    #[cfg(test)]
    pub fn get_ok(&self) -> DbConnectionV2 {
        futures::executor::block_on(self.get()).expect("Failed to get test connection")
    }

    /// Returns an infinite iterator of futures resolving to connections acquired from the pool
    ///
    /// Meant to be used in conjunction with `zip` in order to instantiate a bunch of tasks to spawn.
    ///
    /// # Example
    ///
    /// ```rust
    /// let operations =
    ///     items.into_iter()
    ///         .zip(pool.iter_conn())
    ///         .map(|(item, conn)| async {
    ///             let conn = conn.await?; // note the await here
    ///             item.do_something(conn).await
    ///         });
    /// let results = futures::future::try_join_all(operations).await?;
    /// // you may acquire a new connection afterwards
    /// ```
    #[allow(unused)] // TEMPORARY
    pub fn iter_conn(
        &self,
    ) -> impl Iterator<Item = impl Future<Output = Result<DbConnectionV2, DbConnectionError>> + '_>
    {
        std::iter::repeat(self).map(|p| p.get())
    }

    #[cfg(not(test))]
    pub async fn try_from_pool(
        pool: Arc<Pool<AsyncPgConnection>>,
    ) -> Result<Self, DbConnectionError> {
        Ok(Self { pool })
    }

    #[cfg(test)]
    pub async fn try_from_pool(
        pool: Arc<Pool<AsyncPgConnection>>,
    ) -> Result<Self, DbConnectionError> {
        use diesel_async::AsyncConnection;
        let mut conn = pool.get().await?;
        conn.begin_test_transaction().await?;
        let test_connection = Arc::new(RwLock::new(conn));

        Ok(Self {
            pool,
            test_connection: Some(test_connection),
        })
    }

    /// Create a connection pool for testing purposes
    ///
    /// You can set the `OSRD_TEST_PG_URL` environment variable to use a custom database url.
    #[cfg(test)]
    pub fn for_tests() -> Self {
        let url = std::env::var("OSRD_TEST_PG_URL")
            .unwrap_or_else(|_| String::from("postgresql://osrd:password@localhost/osrd"));
        let url = Url::parse(&url).expect("Failed to parse postgresql url");
        futures::executor::block_on(Self::try_initialize(url, 1))
            .expect("Failed to initialize test connection pool")
    }
}

pub fn create_connection_pool(
    url: Url,
    max_size: usize,
) -> Result<DbConnectionPool, DbConnectionError> {
    let mut manager_config = ManagerConfig::default();
    manager_config.custom_setup = Box::new(establish_connection);
    let manager = DbConnectionConfig::new_with_config(url, manager_config);
    Ok(Pool::builder(manager).max_size(max_size).build()?)
}

fn establish_connection(config: &str) -> BoxFuture<ConnectionResult<DbConnection>> {
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
        DbConnection::try_from(client).await
    };
    fut.boxed()
}
