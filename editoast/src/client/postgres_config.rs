use clap::Args;
use derivative::Derivative;
use editoast_derive::EditoastError;
use thiserror::Error;
use url::Url;

use crate::error::Result;

#[derive(Args, Debug, Derivative, Clone)]
#[derivative(Default)]
pub struct PostgresConfig {
    #[derivative(Default(value = "postgres://osrd:password@localhost:5432/osrd"))]
    #[arg(long, env, default_value_t = "postgres://osrd:password@localhost:5432/osrd")]
    pub database_url,
    #[derivative(Default(value = "32"))]
    #[arg(long, env, default_value_t = 32)]
    pub pool_size: usize,
}

impl PostgresConfig {
    pub fn url(&self) -> Result<Url> {
        Ok(database_url)
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "postgres", default_status = 500)]
pub enum PostgresConfigError {
    #[error("Invalid host '{hostname}'")]
    Host { hostname: String },
    #[error("Invalid port '{port}'")]
    Port { port: u16 },
    #[error("Invalid username")]
    Username,
    #[error("Invalid password")]
    Password,
}
