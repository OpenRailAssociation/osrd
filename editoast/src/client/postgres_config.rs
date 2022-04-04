use clap::Args;

#[derive(Args, Debug)]
pub struct PostgresConfig {
    #[clap(long, env, default_value = "osrd")]
    pub psql_database: String,
    #[clap(long, env, default_value = "osrd")]
    pub psql_username: String,
    #[clap(long, env, default_value = "password")]
    pub psql_password: String,
    #[clap(long, env, default_value = "localhost")]
    pub psql_host: String,
    #[clap(long, env, default_value_t = 5432)]
    pub psql_port: u16,
}

impl Default for PostgresConfig {
    fn default() -> Self {
        Self {
            psql_database: "osrd".to_string(),
            psql_username: "osrd".to_string(),
            psql_password: "password".to_string(),
            psql_host: "localhost".to_string(),
            psql_port: 5432,
        }
    }
}

impl PostgresConfig {
    pub fn url(&self) -> String {
        format!(
            "postgresql://{}:{}@{}:{}/{}",
            self.psql_username,
            self.psql_password,
            self.psql_host,
            self.psql_port,
            self.psql_database
        )
    }
}
