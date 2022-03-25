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
    #[clap(long, env = "EDITOAST_PORT", default_value_t = 8090)]
    pub port: u16,
}

#[derive(Args, Debug)]
#[clap(about, long_about = "Refresh infra generated data")]
pub struct GenerateArgs {
    pub infra_ids: Vec<u32>,
    #[clap(short, long, help = "Force refresh")]
    pub force: bool,
}
