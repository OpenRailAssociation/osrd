use diesel_async::pooled_connection::deadpool::Object;
use diesel_async::pooled_connection::deadpool::Pool;

use diesel_async::AsyncPgConnection;
use std::sync::Arc;
#[cfg(test)]
use tokio::sync::OwnedRwLockWriteGuard;
#[cfg(test)]
use tokio::sync::RwLock;
#[cfg(test)]
use url::Url;

use super::DbConnectionError;

/// - Wrapper for connection pooling with support for test connections.
/// - In test mode, the connection pool will always provide the same test connection for testing purposes.
/// - This connection will not commit any changes to the database, ensuring the isolation of each test.
/// The connection pool in test mode will not commit any changes to the database, all data will be deleted after the test
#[derive(Clone)]
pub struct DbConnectionPoolV2 {
    pool: Arc<Pool<AsyncPgConnection>>,
    #[cfg(test)]
    test_connection: Option<Arc<RwLock<Object<AsyncPgConnection>>>>,
}

#[cfg(test)]
impl DbConnectionPoolV2 {
    /// Get inner pool for retro compatibility
    pub fn pool_v1(&self) -> Arc<Pool<AsyncPgConnection>> {
        self.pool.clone()
    }

    pub async fn try_from_pool(pool: Pool<AsyncPgConnection>) -> Result<Self, DbConnectionError> {
        use diesel_async::AsyncConnection;
        let mut conn = pool.get().await?;
        conn.begin_test_transaction().await?;
        let test_connection = Arc::new(RwLock::new(conn));

        Ok(Self {
            pool: Arc::new(pool),
            test_connection: Some(test_connection),
        })
    }

    pub async fn try_initialize(url: Url) -> Result<Self, DbConnectionError> {
        use diesel_async::pooled_connection::AsyncDieselConnectionManager;
        let manager = AsyncDieselConnectionManager::<AsyncPgConnection>::new(url.as_str());
        let pool = Pool::builder(manager).max_size(1).build()?;
        Self::try_from_pool(pool).await
    }

    /// # Test creation steps exemple
    ///
    /// - Create the connection pool in test mode:
    /// ```
    /// let pool = create_shared_test_pool().await;
    /// ```
    /// - Create the service with the connection pool:
    /// ```
    /// let service = create_test_app(pool.clone()).await;
    /// ```
    /// - Insert the required data before testing the API service:
    /// ```
    /// let document = create_document(&pool).await;
    /// ```
    /// - Call the API service
    /// - Test the API service response
    pub async fn get(
        &self,
    ) -> Result<OwnedRwLockWriteGuard<Object<AsyncPgConnection>>, DbConnectionError> {
        if let Some(test_connection) = &self.test_connection {
            let connection = test_connection.clone().write_owned().await;
            Ok(connection)
        } else {
            Err(DbConnectionError::TestConnection)
        }
    }

    pub fn get_ok(&self) -> OwnedRwLockWriteGuard<Object<AsyncPgConnection>> {
        futures::executor::block_on(self.get()).expect("Failed to get test connection")
    }
}

#[cfg(not(test))]
impl DbConnectionPoolV2 {
    pub async fn try_from_pool(pool: Pool<AsyncPgConnection>) -> Result<Self, DbConnectionError> {
        Ok(Self {
            pool: Arc::new(pool),
        })
    }

    /// - The connection will be the same for all call to this function, it will not commit any changes to the database
    /// - For each test case, the pool need to be created again
    /// - This connection is behind a RwLock to allow multiple tests to use it at the same time,
    /// - The lock need to be released as soon as possible, you can create a function, use block expressions, `pool.get_ok().deref_mut()``
    /// ```rust
    /// let document = {
    ///     Document::changeset()
    ///        .data(b"Document post test data".to_vec())
    ///        .content_type(String::from("text/plain"))
    ///        .create(pool.get_ok().deref_mut())
    ///        .await
    ///        .expect("Failed to create document")
    /// };
    /// ```
    pub async fn get(&self) -> Result<Object<AsyncPgConnection>, DbConnectionError> {
        let connection = self.pool.get().await?;
        Ok(connection)
    }
}

#[cfg(test)]
impl Default for DbConnectionPoolV2 {
    fn default() -> Self {
        let default_url = Url::parse("postgresql://osrd:password@localhost/osrd")
            .expect("Failed to parse default postgresql url");
        futures::executor::block_on(Self::try_initialize(default_url))
            .expect("Failed to initialize default connection pool")
    }
}
