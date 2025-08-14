pub mod electrical_profiles_commands;
pub mod group;
pub mod healthcheck;
pub mod import_rolling_stock;
pub mod infra_commands;
mod openfga_config;
mod postgres_config;
pub mod roles;
pub mod runserver;
pub mod search_commands;
pub mod stdcm_search_env_commands;
mod telemetry_config;
pub mod timetables_commands;
pub mod user;
mod valkey_config;

use clap::Parser;
use clap::Subcommand;
use clap::ValueEnum;
use group::GroupCommand;
use import_rolling_stock::ImportRollingStockArgs;
use infra_commands::InfraCommands;
use openfga_config::OpenfgaConfig;
pub use postgres_config::PostgresConfig;
use roles::RolesCommand;
use runserver::CoreArgs;
use runserver::RunserverArgs;
use search_commands::SearchCommands;
use stdcm_search_env_commands::StdcmSearchEnvCommands;
pub use telemetry_config::TelemetryConfig;
pub use telemetry_config::TelemetryKind;
use timetables_commands::TimetablesCommands;
use user::UserCommand;
pub use valkey_config::ValkeyConfig;

use crate::views::OpenApiRoot;

#[derive(Parser, Debug)]
#[command(author, version)]
pub struct Client {
    #[command(flatten)]
    pub postgres_config: PostgresConfig,
    #[command(flatten)]
    pub valkey_config: ValkeyConfig,
    #[command(flatten)]
    pub telemetry_config: TelemetryConfig,
    #[command(flatten)]
    pub openfga_config: OpenfgaConfig,
    #[arg(long, env, value_enum, default_value_t = Color::Auto)]
    pub color: Color,
    /// OSRD version (used for cache keys, always provide in production)
    #[clap(long, env = "OSRD_GIT_DESCRIBE")]
    pub app_version: Option<String>,
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(ValueEnum, Debug, Default, Clone)]
pub enum Color {
    Never,
    Always,
    #[default]
    Auto,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    Runserver(Box<RunserverArgs>), // suppresses clippy lint about variant size
    #[command(
        subcommand,
        about,
        long_about = "Commands related to electrical profile sets"
    )]
    ElectricalProfiles(electrical_profiles_commands::ElectricalProfilesCommands),
    ImportRollingStock(ImportRollingStockArgs),
    ImportTowedRollingStock(ImportRollingStockArgs),
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
    #[command(subcommand, about, long_about = "Group related commands")]
    Group(GroupCommand),
    #[command(subcommand, about, long_about = "User related commands")]
    User(UserCommand),
    #[command(about, long_about = "Healthcheck")]
    Healthcheck(CoreArgs),
}

/// Prints the OpenApi to stdout
pub fn print_openapi() {
    let openapi = OpenApiRoot::build_openapi();
    print!("{}", serde_yaml::to_string(&openapi).unwrap());
}

#[cfg(test)]
pub fn generate_temp_file<T: serde::Serialize>(object: &T) -> tempfile::NamedTempFile {
    use std::io::Write as _;
    let mut tmp_file = tempfile::NamedTempFile::new().unwrap();
    write!(tmp_file, "{}", serde_json::to_string(object).unwrap()).unwrap();
    tmp_file
}
