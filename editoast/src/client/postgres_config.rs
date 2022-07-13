use clap::Args;
use derivative::Derivative;

#[derive(Args, Debug, Derivative)]
#[derivative(Default)]
pub struct PostgresConfig {
    #[derivative(Default(value = r#""osrd".into()"#))]
    #[clap(long, env, default_value = "osrd")]
    pub psql_database: String,
    #[derivative(Default(value = r#""osrd".into()"#))]
    #[clap(long, env, default_value = "osrd")]
    pub psql_username: String,
    #[derivative(Default(value = r#""password".into()"#))]
    #[clap(long, env, default_value = "password")]
    pub psql_password: String,
    #[derivative(Default(value = r#""localhost".into()"#))]
    #[clap(long, env, default_value = "localhost")]
    pub psql_host: String,
    #[derivative(Default(value = "5432"))]
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
