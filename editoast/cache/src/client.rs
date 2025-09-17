use arcstr::ArcStr;
use deadpool_redis::Config;
use deadpool_redis::Pool;
use deadpool_redis::PoolError;
use deadpool_redis::Runtime;
use url::Url;

use crate::connection::ValkeyConnection;
use crate::connection::ValkeyConnectionInner;

pub struct ValkeyClient {
    inner: ValkeyClientInner,
    app_version: ArcStr,
}

pub enum ValkeyClientInner {
    Tokio(Pool),
    /// This doesn't cache anything. It has no backend.
    NoCache,
}

#[derive(Clone)]
pub struct ValkeyConfig {
    /// Disables caching. This should not be used in production.
    pub no_cache: bool,
    pub valkey_url: Url,
    pub app_version: String,
}

impl ValkeyClient {
    pub fn new(
        ValkeyConfig {
            no_cache,
            valkey_url,
            app_version,
        }: ValkeyConfig,
    ) -> Self {
        Self {
            app_version: ArcStr::from(app_version),
            inner: if no_cache {
                ValkeyClientInner::NoCache
            } else {
                ValkeyClientInner::Tokio(
                    Config::from_url(valkey_url)
                        .create_pool(Some(Runtime::Tokio1))
                        .unwrap(),
                )
            },
        }
    }

    pub async fn get_connection(&self) -> Result<ValkeyConnection, PoolError> {
        match &self.inner {
            ValkeyClientInner::Tokio(pool) => Ok(ValkeyConnection::new(
                ValkeyConnectionInner::Tokio(pool.get().await?),
                self.app_version.clone(),
            )),
            ValkeyClientInner::NoCache => Ok(ValkeyConnection::new(
                ValkeyConnectionInner::NoCache,
                self.app_version.clone(),
            )),
        }
    }
}
