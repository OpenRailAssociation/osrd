use clap::Args;
use derivative::Derivative;
use url::Url;

use crate::valkey_utils;

#[derive(Args, Debug, Derivative, Clone)]
#[derivative(Default)]
pub struct ValkeyConfig {
    /// Disable cache. This should not be used in production.
    #[derivative(Default(value = "false"))]
    #[clap(long, env, default_value_t = false)]
    pub no_cache: bool,
    #[derivative(Default(value = "false"))]
    #[clap(long, env, default_value_t = false)]
    pub is_cluster_client: bool,
    #[derivative(Default(value = r#"Url::parse("redis://localhost:6379").unwrap()"#))]
    #[arg(long, env, default_value_t = Url::parse("redis://localhost:6379").unwrap())]
    /// Valkey url like `redis://[:PASSWORD@]HOST[:PORT][/DATABASE]`
    pub valkey_url: Url,
}

impl From<ValkeyConfig> for valkey_utils::ValkeyConfig {
    fn from(
        ValkeyConfig {
            no_cache,
            is_cluster_client,
            valkey_url,
        }: ValkeyConfig,
    ) -> Self {
        valkey_utils::ValkeyConfig {
            no_cache,
            is_cluster_client,
            valkey_url,
        }
    }
}
