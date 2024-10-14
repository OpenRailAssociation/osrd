use clap::Args;
use derivative::Derivative;
use editoast_derive::EditoastError;
use thiserror::Error;
use url::Url;

use crate::error::Result;

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
    #[derivative(Default(value = r#""redis://localhost:6379".into()"#))]
    #[arg(long, env, default_value = "redis://localhost:6379")]
    /// Valkey url like `redis://[:PASSWORD@]HOST[:PORT][/DATABASE]`
    valkey_url: String,
}

impl ValkeyConfig {
    pub fn url(&self) -> Result<Url> {
        let url = Url::parse(&self.valkey_url).map_err(|_| ValkeyConfigError::Url {
            url: self.valkey_url.clone(),
        })?;

        Ok(url)
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "valkey", default_status = 500)]
pub enum ValkeyConfigError {
    #[error("Invalid url '{url}'")]
    Url { url: String },
}
