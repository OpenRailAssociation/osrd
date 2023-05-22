mod postgres_config;
mod redis_config;

use clap::{Args, Parser, Subcommand};
use derivative::Derivative;
pub use postgres_config::PostgresConfig;
pub use redis_config::RedisConfig;
use std::{env, path::PathBuf};

#[derive(Parser, Debug)]
#[command(author, version)]
pub struct Client {
    #[command(flatten)]
    pub postgres_config: PostgresConfig,
    #[command(flatten)]
    pub redis_config: RedisConfig,
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    Runserver(RunserverArgs),
    Generate(GenerateArgs),
    Clear(ClearArgs),
    ImportRailjson(ImportRailjsonArgs),
    ImportProfileSet(ImportProfileSetArgs),
    OsmToRailjson(OsmToRailjsonArgs),
}

#[derive(Args, Debug, Derivative, Clone)]
#[derivative(Default)]
pub struct MapLayersConfig {
    #[derivative(Default(value = "18"))]
    #[arg(long, env, default_value_t = 18)]
    pub max_zoom: u64,
    /// Number maximum of tiles before we consider invalidating full Redis cache is required
    #[derivative(Default(value = "250_000"))]
    #[arg(long, env, default_value_t = 250_000)]
    pub max_tiles: u64,
}

#[derive(Args, Debug, Derivative)]
#[derivative(Default)]
#[command(about, long_about = "Launch the server")]
pub struct RunserverArgs {
    #[command(flatten)]
    pub map_layers_config: MapLayersConfig,
    #[derivative(Default(value = "8090"))]
    #[arg(long, env = "EDITOAST_PORT", default_value_t = 8090)]
    pub port: u16,
    #[derivative(Default(value = r#""0.0.0.0".into()"#))]
    #[arg(long, env = "EDITOAST_ADDRESS", default_value_t = String::from("0.0.0.0"))]
    pub address: String,
    #[derivative(Default(value = r#""http://localhost:8080".into()"#))]
    #[clap(long, env = "OSRD_BACKEND_URL", default_value_t = String::from("http://localhost:8080"))]
    pub backend_url: String,
    #[clap(long, env = "OSRD_BACKEND_TOKEN", default_value_t = String::from(""))]
    pub backend_token: String,
    #[arg(long, env = "SENTRY_DSN")]
    pub sentry_dsn: Option<String>,
    #[arg(long, env = "SENTRY_ENV")]
    pub sentry_env: Option<String>,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Refresh infra generated data")]
pub struct GenerateArgs {
    /// List of infra ids
    pub infra_ids: Vec<u64>,
    #[arg(short, long)]
    /// Force the refresh of an infra (even if the generated version is up to date)
    pub force: bool,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Clear infra generated data")]
pub struct ClearArgs {
    /// List of infra ids
    pub infra_ids: Vec<u64>,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Import an infra given a railjson file")]
pub struct ImportRailjsonArgs {
    /// Infra name
    pub infra_name: String,
    /// Railjson file path
    pub railjson_path: PathBuf,
    /// Whether the import should refresh generated data
    #[arg(short = 'g', long)]
    pub generate: bool,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Add a set of electrical profiles")]
pub struct ImportProfileSetArgs {
    /// Electrical profile set name
    pub name: String,
    /// Electrical profile set file path
    pub electrical_profile_set_path: PathBuf,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Extracts a railjson from OpenStreetMap data")]
pub struct OsmToRailjsonArgs {
    /// Input file in the OSM PBF format
    pub osm_pbf_in: PathBuf,
    /// Output file in Railjson format
    pub railjson_out: PathBuf,
}

/// Retrieve the ROOT_URL env var. If not found returns default local url.
pub fn get_root_url() -> String {
    env::var("ROOT_URL").unwrap_or(String::from("http://localhost:8090"))
}

/// Retrieve the app version (git describe)
pub fn get_app_version() -> Option<String> {
    env::var("OSRD_GIT_DESCRIBE").ok()
}
