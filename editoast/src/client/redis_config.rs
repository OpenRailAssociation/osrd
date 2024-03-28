use clap::Args;
use derivative::Derivative;
use editoast_derive::EditoastError;
use thiserror::Error;
use url::Url;

use crate::error::Result;

#[derive(Args, Debug, Derivative, Clone)]
#[derivative(Default)]
pub struct RedisConfig {
    #[derivative(Default(value = "false"))]
    #[clap(long, env, default_value_t = false)]
    pub is_cluster_client: bool,
    #[derivative(Default(value = r#""redis://localhost:6379".into()"#))]
    #[arg(long, env, default_value = "redis://localhost:6379")]
    /// Redis url like `redis://[:PASSWORD@]HOST[:PORT][/DATABASE]`
    redis_url: String,
}

impl RedisConfig {
    pub fn url(&self) -> Result<Url> {
        let url = Url::parse(&self.redis_url).map_err(|_| RedisConfigError::Url {
            url: self.redis_url.clone(),
        })?;

        Ok(url)
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "redis", default_status = 500)]
pub enum RedisConfigError {
    #[error("Invalid url '{url}'")]
    Url { url: String },
}
