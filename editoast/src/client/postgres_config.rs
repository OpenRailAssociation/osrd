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
