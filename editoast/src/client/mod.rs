pub mod electrical_profiles_commands;
pub mod import_rolling_stock;
pub mod infra_commands;
mod postgres_config;
pub mod roles;
pub mod search_commands;
pub mod stdcm_search_env_commands;
mod telemetry_config;
pub mod timetables_commands;
mod valkey_config;

use std::env;
use std::path::PathBuf;

use clap::Args;
use clap::Parser;
use clap::Subcommand;
use clap::ValueEnum;
use derivative::Derivative;
use editoast_derive::EditoastError;
use import_rolling_stock::ImportRollingStockArgs;
use infra_commands::InfraCommands;
pub use postgres_config::PostgresConfig;
use roles::RolesCommand;
use search_commands::SearchCommands;
use stdcm_search_env_commands::StdcmSearchEnvCommands;
pub use telemetry_config::TelemetryConfig;
pub use telemetry_config::TelemetryKind;
use thiserror::Error;
use timetables_commands::TimetablesCommands;
use url::Url;
pub use valkey_config::ValkeyConfig;

use crate::error::Result;

#[derive(Parser, Debug)]
#[command(author, version)]
pub struct Client {
    #[command(flatten)]
    pub postgres_config: PostgresConfig,
    #[command(flatten)]
    pub valkey_config: ValkeyConfig,
    #[command(flatten)]
    pub telemetry_config: TelemetryConfig,
    #[arg(long, env, value_enum, default_value_t = Color::Auto)]
    pub color: Color,
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(ValueEnum, Debug, Derivative, Clone)]
#[derivative(Default)]
pub enum Color {
    Never,
    Always,
    #[derivative(Default)]
    Auto,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    Runserver(RunserverArgs),
    #[command(
        subcommand,
        about,
        long_about = "Commands related to electrical profile sets"
    )]
    ElectricalProfiles(electrical_profiles_commands::ElectricalProfilesCommands),
    ImportRollingStock(ImportRollingStockArgs),
    OsmToRailjson(OsmToRailjsonArgs),
    #[command(about, long_about = "Prints the OpenApi of the service")]
    Openapi,
    #[command(subcommand, about, long_about = "Search engine related commands")]
    Search(SearchCommands),
    #[command(subcommand, about, long_about = "Infrastructure related commands")]
    Infra(InfraCommands),
    #[command(subcommand, about, long_about = "Timetables related commands")]
    Timetables(TimetablesCommands),
    #[command(
        subcommand,
        about,
        long_about = "STDCM search environment management commands"
    )]
    STDCMSearchEnv(StdcmSearchEnvCommands),
    #[command(subcommand, about, long_about = "Roles related commands")]
    Roles(RolesCommand),
    #[command(about, long_about = "Healthcheck")]
    Healthcheck,
}

#[derive(Args, Debug, Derivative, Clone)]
#[derivative(Default)]
pub struct MapLayersConfig {
    #[derivative(Default(value = "18"))]
    #[arg(long, env, default_value_t = 18)]
    pub max_zoom: u64,
    /// Number maximum of tiles before we consider invalidating full Valkey cache is required
    #[derivative(Default(value = "250_000"))]
    #[arg(long, env, default_value_t = 250_000)]
    pub max_tiles: u64,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Launch the server")]
pub struct RunserverArgs {
    #[command(flatten)]
    pub map_layers_config: MapLayersConfig,
    #[arg(long, env = "EDITOAST_PORT", default_value_t = 8090)]
    pub port: u16,
    #[arg(long, env = "EDITOAST_ADDRESS", default_value_t = String::from("0.0.0.0"))]
    pub address: String,
    #[clap(long, env = "OSRD_MQ_URL", default_value_t = String::from("amqp://osrd:password@127.0.0.1:5672/%2f"))]
    pub mq_url: String,
    #[clap(long, env = "EDITOAST_CORE_TIMEOUT", default_value_t = 180)]
    pub core_timeout: u64,
    #[clap(long, env = "EDITOAST_CORE_SINGLE_WORKER", default_value_t = false)]
    pub core_single_worker: bool,
    #[clap(long, env = "ROOT_PATH", default_value_t = String::new())]
    pub root_path: String,
    #[clap(long)]
    pub workers: Option<usize>,
    /// If this option is set, any role and permission check will be bypassed. Even if no user is
    /// provided by the request headers of if the provided user doesn't have the required privileges.
    // TODO: once the whole role system will be deployed, the default value of this option should
    // be set to false. It's currently set to true in order to pass integration tests, which otherwise
    // only recieve 401 responses.
    #[clap(long, env = "EDITOAST_DISABLE_AUTHORIZATION", default_value_t = true)]
    pub disable_authorization: bool,
    #[clap(long, env = "OSRDYNE_API_URL", default_value_t = String::from("http://127.0.0.1:4242/"))]
    pub osrdyne_api_url: String,
    /// The timeout to use when performing the healthcheck, in milliseconds
    #[clap(long, env = "EDITOAST_HEALTH_CHECK_TIMEOUT_MS", default_value_t = 500)]
    pub health_check_timeout_ms: u64,
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
pub fn get_root_url() -> Result<Url> {
    let url = env::var("ROOT_URL").unwrap_or(String::from("http://localhost:8090"));
    let parsed_url = Url::parse(&url).map_err(|_| EditoastUrlError::InvalidUrl { url })?;
    Ok(parsed_url)
}

/// Retrieve the app version (git describe)
pub fn get_app_version() -> Option<String> {
    env::var("OSRD_GIT_DESCRIBE").ok()
}

/// Retrieve the assets path
pub fn get_dynamic_assets_path() -> PathBuf {
    env::var("DYNAMIC_ASSETS_PATH")
        .unwrap_or(String::from("./assets"))
        .into()
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "url")]
pub enum EditoastUrlError {
    #[error("Invalid url '{url}'")]
    #[editoast_error(status = 500)]
    InvalidUrl { url: String },
}

#[cfg(test)]
pub fn generate_temp_file<T: serde::Serialize>(object: &T) -> tempfile::NamedTempFile {
    use std::io::Write as _;
    let mut tmp_file = tempfile::NamedTempFile::new().unwrap();
    write!(tmp_file, "{}", serde_json::to_string(object).unwrap()).unwrap();
    tmp_file
}
