use arcstr::ArcStr;
use deadpool_redis::Pool;
use deadpool_redis::PoolError;
use deadpool_redis::Runtime;
use url::Url;

use crate::connection::Connection;
use crate::connection::ConnectionInner;

pub struct Client {
    inner: ClientInner,
    app_version: ArcStr,
}

pub enum ClientInner {
    Tokio(Pool),
    /// This doesn't cache anything. It has no backend.
    NoCache,
    #[cfg(feature = "mock")]
    Mock(redis_test::MockRedisConnection),
}

#[derive(Clone)]
pub enum Config {
    /// Disables caching. This should not be used in production.
    NoCache,
    Valkey {
        url: Url,
    },
}

impl Client {
    pub fn new(config: Config, app_version: &str) -> Self {
        Self {
            app_version: ArcStr::from(app_version),
            inner: match config {
                Config::NoCache => ClientInner::NoCache,
                Config::Valkey { url } => ClientInner::Tokio(
                    deadpool_redis::Config::from_url(url)
                        .create_pool(Some(Runtime::Tokio1))
                        .unwrap(),
                ),
            },
        }
    }

    #[cfg(feature = "mock")]
    pub fn new_mock(commands: Vec<crate::MockCmd>, app_version: &str) -> Self {
        Self {
            app_version: ArcStr::from(app_version),
            inner: ClientInner::Mock(redis_test::MockRedisConnection::new(commands)),
        }
    }

    pub async fn get_connection(&self) -> Result<Connection, PoolError> {
        match &self.inner {
            ClientInner::Tokio(pool) => Ok(Connection::new(
                ConnectionInner::Tokio(pool.get().await?),
                self.app_version.clone(),
            )),
            ClientInner::NoCache => Ok(Connection::new(
                ConnectionInner::NoCache,
                self.app_version.clone(),
            )),
            #[cfg(feature = "mock")]
            ClientInner::Mock(mock_conn) => Ok(Connection::new(
                ConnectionInner::Mock(mock_conn.clone()),
                self.app_version.clone(),
            )),
        }
    }
}
