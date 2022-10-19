mod chartos_config;
mod postgres_config;

pub use chartos_config::ChartosConfig;
use clap::{Args, Parser, Subcommand};
pub use postgres_config::PostgresConfig;

#[derive(Parser, Debug)]
#[clap(author, version)]
pub struct Client {
    #[clap(flatten)]
    pub postgres_config: PostgresConfig,
    #[clap(flatten)]
    pub chartos_config: ChartosConfig,
    #[clap(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    Runserver(RunserverArgs),
    Generate(GenerateArgs),
    Clear(ClearArgs),
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

#[derive(Args, Debug)]
#[clap(about, long_about = "Clear generated data")]

// Definition of the clear sub command, which can take an infra_id as argument
// If no argument is mentionned, it clears all the infras
pub struct ClearArgs {
    pub infra_ids: Vec<u32>,
}

/// Retrieve the secret key from the environment variable `SECRET_KEY`.
/// Return `None` if the environment variable is not set.
pub fn get_secret_key() -> Option<String> {
    std::env::var("SECRET_KEY").ok()
}
