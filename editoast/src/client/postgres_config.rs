use clap::Args;
use derivative::Derivative;

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
    pub pool_size: u32,
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
