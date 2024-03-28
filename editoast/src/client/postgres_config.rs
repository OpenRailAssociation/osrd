use clap::Args;
use derivative::Derivative;
use editoast_derive::EditoastError;
use thiserror::Error;
use url::Url;

use crate::error::Result;

#[derive(Args, Debug, Derivative, Clone)]
#[derivative(Default)]
pub struct PostgresConfig {
    #[derivative(Default(value = r#""osrd".into()"#))]
    #[arg(long, env, default_value = "osrd")]
    pub psql_database: String,
    #[derivative(Default(value = r#""osrd".into()"#))]
    #[arg(long, env, default_value = "osrd")]
    pub psql_username: String,
    #[derivative(Default(value = r#""password".into()"#))]
    #[arg(long, env, default_value = "password")]
    pub psql_password: String,
    #[derivative(Default(value = r#""localhost".into()"#))]
    #[arg(long, env, default_value = "localhost")]
    pub psql_host: String,
    #[derivative(Default(value = "5432"))]
    #[arg(long, env, default_value_t = 5432)]
    pub psql_port: u16,
    #[derivative(Default(value = "32"))]
    #[arg(long, env, default_value_t = 32)]
    pub pool_size: usize,
}

impl PostgresConfig {
    pub fn url(&self) -> Result<Url> {
        let base_url = format!("postgresql://{}", self.psql_host);
        let mut url = Url::parse(&base_url).map_err(|_| PostgresConfigError::Host {
            hostname: self.psql_host.clone(),
        })?;
        url.set_port(Some(self.psql_port))
            .map_err(|_| PostgresConfigError::Port {
                port: self.psql_port,
            })?;
        url.set_path(&self.psql_database);
        url.set_username(&self.psql_username)
            .map_err(|_| PostgresConfigError::Username)?;
        url.set_password(Some(&self.psql_password))
            .map_err(|_| PostgresConfigError::Password)?;

        Ok(url)
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
