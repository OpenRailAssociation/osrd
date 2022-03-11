mod postgres_config;

use clap::{Args, Parser, Subcommand};
pub use postgres_config::PostgresConfig;

#[derive(Parser, Debug)]
#[clap(author, version)]
pub struct Client {
    #[clap(flatten)]
    pub postgres_config: PostgresConfig,
    #[clap(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    Runserver(RunserverArgs),
    Generate(GenerateArgs),
}

#[derive(Args, Debug)]
#[clap(about, long_about = "Launch the server")]
pub struct RunserverArgs {
    #[clap(long, env = "ROOT_URL", default_value = "/")]
    root_url: String,
    #[clap(long, env = "PORT", default_value_t = 8090)]
    pub port: u16,
}

impl RunserverArgs {
    /// Retrun the root url with an heading `/`
    pub fn get_root_url(&self) -> String {
        if self.root_url.starts_with('/') {
            self.root_url.clone()
        } else {
            format!("/{}", self.root_url)
        }
    }
}

#[derive(Args, Debug)]
#[clap(about, long_about = "Refresh infra generated data")]
pub struct GenerateArgs {
    pub infra_ids: Vec<u32>,
    #[clap(short, long, help = "Force refresh")]
    pub force: bool,
}
