use std::time::Duration;

use clap::Args;
use educe::Educe;
use url::Url;

#[derive(Args, Debug, Educe, Clone)]
#[educe(Default)]
pub struct ValkeyConfig {
    /// Disable cache. This should not be used in production.
    #[clap(long, env = "EDITOAST_NO_CACHE", default_value_t = false)]
    pub no_cache: bool,
    #[educe(Default = Url::parse("redis://localhost:6379").unwrap())]
    #[arg(long, env, default_value_t = Url::parse("redis://localhost:6379").unwrap())]
    /// Valkey url like `redis://[:PASSWORD@]HOST[:PORT][/DATABASE]`
    pub valkey_url: Url,
    #[educe(Default = 1000)]
    #[arg(long, env, default_value_t = 1000)]
    /// Response timeout for Valkey requests in ms
    pub valkey_timeout: u64,
    #[educe(Default = 32)]
    #[arg(long, default_value_t = 32)]
    pub valkey_pool_size: usize,
}

impl ValkeyConfig {
    pub fn into_cache_config(self) -> cache::Config {
        if self.no_cache {
            cache::Config::NoCache
        } else {
            cache::Config::Valkey {
                url: self.valkey_url,
                response_timeout: Duration::from_millis(self.valkey_timeout),
                pool_size: self.valkey_pool_size,
            }
        }
    }
}
