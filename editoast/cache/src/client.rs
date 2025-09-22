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
}

#[derive(Clone)]
pub struct Config {
    /// Disables caching. This should not be used in production.
    pub no_cache: bool,
    pub valkey_url: Url,
    pub app_version: String,
}

impl Client {
    pub fn new(
        Config {
            no_cache,
            valkey_url,
            app_version,
        }: Config,
    ) -> Self {
        Self {
            app_version: ArcStr::from(app_version),
            inner: if no_cache {
                ClientInner::NoCache
            } else {
                ClientInner::Tokio(
                    deadpool_redis::Config::from_url(valkey_url)
                        .create_pool(Some(Runtime::Tokio1))
                        .unwrap(),
                )
            },
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
        }
    }
}
