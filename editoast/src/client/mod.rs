mod postgres_config;
mod redis_config;
mod telemetry_config;

use std::env;
use std::path::PathBuf;

use clap::Args;
use clap::Parser;
use clap::Subcommand;
use clap::ValueEnum;
use derivative::Derivative;
use editoast_derive::EditoastError;
pub use postgres_config::PostgresConfig;
pub use redis_config::RedisConfig;
pub use telemetry_config::TelemetryConfig;
pub use telemetry_config::TelemetryKind;
use thiserror::Error;
use url::Url;

use crate::error::Result;

#[derive(Parser, Debug)]
#[command(author, version)]
pub struct Client {
    #[command(flatten)]
    pub postgres_config: PostgresConfig,
    #[command(flatten)]
    pub redis_config: RedisConfig,
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
    ElectricalProfiles(ElectricalProfilesCommands),
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
}

#[derive(Subcommand, Debug)]
pub enum TimetablesCommands {
    Import(ImportTimetableArgs),
    Export(ExportTimetableArgs),
}

#[derive(Args, Debug, Derivative)]
#[derivative(Default)]
#[command(about, long_about = "Import a train schedule given a JSON file")]
pub struct ImportTimetableArgs {
    /// The timetable id on which attach the trains to
    #[arg(long)]
    pub id: Option<i64>,
    /// The input file path
    pub path: PathBuf,
}

#[derive(Args, Debug, Derivative)]
#[derivative(Default)]
#[command(about, long_about = "Export the train schedules of a given timetable")]
pub struct ExportTimetableArgs {
    /// The timetable id on which get the train schedules from
    pub id: i64,
    /// The output file path
    pub path: PathBuf,
}

#[derive(Subcommand, Debug)]
pub enum ElectricalProfilesCommands {
    Import(ImportProfileSetArgs),
    Delete(DeleteProfileSetArgs),
    List(ListProfileSetArgs),
}

#[derive(Subcommand, Debug)]
pub enum SearchCommands {
    List,
    MakeMigration(MakeMigrationArgs),
    Refresh(RefreshArgs),
}

#[derive(Subcommand, Debug)]
pub enum InfraCommands {
    Clone(InfraCloneArgs),
    Clear(ClearArgs),
    Generate(GenerateArgs),
    ImportRailjson(ImportRailjsonArgs),
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
    #[derivative(Default(value = r#""amqp://osrd-rabbitmq:5672/%2f".into()"#))]
    #[clap(long, env = "OSRD_MQ_URL", default_value_t = String::from("amqp://osrd-rabbitmq:5672/%2f"))]
    pub mq_url: String,
    #[derivative(Default(value = "60"))] // TODO: find the currently used timeout
    #[clap(long, env = "EDITOAST_CORE_TIMEOUT", default_value_t = 60)]
    pub core_timeout: u64,
    #[derivative(Default(value = r#""".into()"#))]
    #[clap(long, env = "ROOT_PATH", default_value_t = String::new())]
    pub root_path: String,
    #[clap(long)]
    pub workers: Option<usize>,
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

#[derive(Args, Debug, Clone)]
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

#[derive(Args, Debug, Clone)]
#[command(about, long_about = "Clone an infrastructure")]
pub struct InfraCloneArgs {
    /// Infrastructure ID
    pub id: u64,
    /// Infrastructure new name
    pub new_name: Option<String>,
}

#[derive(Args, Debug)]
#[command(
    about,
    long_about = "Delete electrical profile sets corresponding to the given ids"
)]
pub struct DeleteProfileSetArgs {
    /// List of infra ids
    pub profile_set_ids: Vec<i64>,
}

#[derive(Args, Debug)]
#[command(
    about,
    long_about = "List electrical profile sets in the database, <id> - <name>"
)]
pub struct ListProfileSetArgs {
    // Wether to display the list in a ready to parse format
    #[arg(long, default_value_t = false)]
    pub quiet: bool,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Import a rolling stock given a json file")]
pub struct ImportRollingStockArgs {
    /// Rolling stock file path
    pub rolling_stock_path: Vec<PathBuf>,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Extracts a railjson from OpenStreetMap data")]
pub struct OsmToRailjsonArgs {
    /// Input file in the OSM PBF format
    pub osm_pbf_in: PathBuf,
    /// Output file in Railjson format
    pub railjson_out: PathBuf,
}

#[derive(Args, Debug)]
#[command(
    about,
    long_about = "Generate a migration's up.sql and down.sql content for a search object"
)]
pub struct MakeMigrationArgs {
    /// The search object to generate a migration for
    pub object: String,
    /// The directory of the migration
    pub migration: PathBuf,
    #[arg(short, long)]
    /// Overwrites the existing up.sql and down.sql files' content
    pub force: bool,
    #[arg(long)]
    /// Skips the default generation of down.sql to have smarter rollbacks
    pub skip_down: bool,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Updates the content of the search cache tables")]
pub struct RefreshArgs {
    /// The search objects to refresh. If none, all search objects are refreshed
    pub objects: Vec<String>,
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
