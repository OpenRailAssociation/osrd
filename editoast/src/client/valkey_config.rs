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
}

impl ValkeyConfig {
    pub fn into_cache_config(self) -> cache::Config {
        if self.no_cache {
            cache::Config::NoCache
        } else {
            cache::Config::Valkey {
                url: self.valkey_url,
            }
        }
    }
}
