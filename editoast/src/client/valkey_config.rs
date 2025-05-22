use clap::Args;
use educe::Educe;
use url::Url;

use crate::valkey_utils;

#[derive(Args, Debug, Educe, Clone)]
#[educe(Default)]
pub struct ValkeyConfig {
    /// Disable cache. This should not be used in production.
    #[clap(long, env, default_value_t = false)]
    pub no_cache: bool,
    #[educe(Default = Url::parse("redis://localhost:6379").unwrap())]
    #[arg(long, env, default_value_t = Url::parse("redis://localhost:6379").unwrap())]
    /// Valkey url like `redis://[:PASSWORD@]HOST[:PORT][/DATABASE]`
    pub valkey_url: Url,
}

impl From<ValkeyConfig> for valkey_utils::ValkeyConfig {
    fn from(
        ValkeyConfig {
            no_cache,
            valkey_url,
        }: ValkeyConfig,
    ) -> Self {
        valkey_utils::ValkeyConfig {
            no_cache,
            valkey_url,
        }
    }
}
