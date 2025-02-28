#[macro_use]
extern crate diesel;

mod client;
mod core;
mod error;
mod generated_data;
mod infra_cache;
mod map;
mod models;
mod valkey_utils;
mod views;

use clap::Parser;
use client::electrical_profiles_commands::*;
use client::group;
use client::group::GroupCommand;
use client::healthcheck::healthcheck_cmd;
use client::import_rolling_stock::*;
use client::infra_commands::*;
use client::print_openapi;
use client::roles;
use client::roles::RolesCommand;
use client::runserver::runserver;
use client::search_commands::*;
use client::stdcm_search_env_commands::handle_stdcm_search_env_command;
use client::timetables_commands::*;
use client::user;
use client::user::UserCommand;
use client::Client;
use client::Color;
use client::Commands;
use editoast_common::tracing::create_tracing_subscriber;
use editoast_common::tracing::TracingConfig;
use editoast_models::DbConnectionPoolV2;
use models::RollingStockModel;
use tracing_subscriber::util::SubscriberInitExt;
pub use views::AppState;

use models::prelude::*;
use opentelemetry_otlp::WithExportConfig as _;
use std::error::Error;
use std::io::IsTerminal;
use std::process::exit;
use std::sync::Arc;
use thiserror::Error;
use tracing::error;
pub use valkey_utils::ValkeyClient;
pub use valkey_utils::ValkeyConnection;

/// The mode editoast is running in
///
/// This is used to determine the logging output. For a CLI command, it's better to
/// log to stderr in order to redirect/pipe stdout. However, for a webservice,
/// the logs should be written to stdout for several reasons:
/// - stdout is bufferized, stderr is not
/// - some tools might parse the service logs and expect them to be on stdout
/// - we *expect* a webserver to output logging information, so since it's an expected
///   output (and not extra information), it should be on stdout
#[derive(Debug, PartialEq)]
enum EditoastMode {
    Webservice,
    Cli,
}

impl From<EditoastMode> for editoast_common::tracing::Stream {
    fn from(mode: EditoastMode) -> Self {
        match mode {
            EditoastMode::Webservice => Self::Stdout,
            EditoastMode::Cli => Self::Stderr,
        }
    }
}

impl EditoastMode {
    fn from_client(client: &Client) -> Self {
        if matches!(client.command, Commands::Runserver(_)) {
            EditoastMode::Webservice
        } else {
            EditoastMode::Cli
        }
    }
}

#[tokio::main]
async fn main() {
    match run().await {
        Ok(_) => (),
        Err(e) => {
            if let Some(e) = e.downcast_ref::<CliError>() {
                eprintln!("{e}");
                exit(e.exit_code);
            } else {
                error!("{e}");
                exit(2);
            }
        }
    }
}

async fn run() -> Result<(), Box<dyn Error + Send + Sync>> {
    let client = Client::parse();
    let exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint(client.telemetry_config.telemetry_endpoint.as_str())
        .build()
        .expect("failed to build a span exporter");

    let telemetry = match client.telemetry_config.telemetry_kind {
        client::TelemetryKind::None => None,
        client::TelemetryKind::Opentelemetry => Some(client.telemetry_config.clone().into()),
    };

    let tracing_config = TracingConfig {
        stream: EditoastMode::from_client(&client).into(),
        telemetry,
        directives: vec![],
    };
    create_tracing_subscriber(
        tracing_config,
        tracing_subscriber::filter::LevelFilter::INFO,
        exporter,
    )
    .init();

    let pg_config = client.postgres_config;
    let db_pool =
        DbConnectionPoolV2::try_initialize(pg_config.database_url.clone(), pg_config.pool_size)
            .await?;

    let valkey_config = client.valkey_config;

    let openfga_config = client.openfga_config;

    match client.color {
        Color::Never => colored::control::set_override(false),
        Color::Always => colored::control::set_override(true),
        Color::Auto => colored::control::set_override(std::io::stderr().is_terminal()),
    }

    match client.command {
        Commands::Runserver(args) => runserver(args, pg_config, valkey_config, openfga_config)
            .await
            .map_err(Into::into),
        Commands::ImportRollingStock(args) => import_rolling_stock(args, db_pool.into()).await,
        Commands::ImportTowedRollingStock(args) => {
            import_towed_rolling_stock(args, db_pool.into()).await
        }
        Commands::Openapi => {
            print_openapi();
            Ok(())
        }
        Commands::ElectricalProfiles(subcommand) => match subcommand {
            ElectricalProfilesCommands::Import(args) => {
                electrical_profile_set_import(args, db_pool.into()).await
            }
            ElectricalProfilesCommands::List(args) => {
                electrical_profile_set_list(args, db_pool.into()).await
            }
            ElectricalProfilesCommands::Delete(args) => {
                electrical_profile_set_delete(args, db_pool.into()).await
            }
        },
        Commands::Search(subcommand) => match subcommand {
            SearchCommands::List => {
                list_search_objects();
                Ok(())
            }
            SearchCommands::MakeMigration(args) => make_search_migration(args),
            SearchCommands::Refresh(args) => refresh_search_tables(args, db_pool.into()).await,
        },
        Commands::Infra(subcommand) => match subcommand {
            InfraCommands::Clone(args) => clone_infra(args, db_pool.into()).await,
            InfraCommands::Clear(args) => clear_infra(args, db_pool.into(), valkey_config).await,
            InfraCommands::Generate(args) => {
                generate_infra(args, db_pool.into(), valkey_config).await
            }
            InfraCommands::ImportRailjson(args) => import_railjson(args, db_pool.into()).await,
        },
        Commands::Timetables(subcommand) => match subcommand {
            TimetablesCommands::Import(args) => trains_import(args, db_pool.into()).await,
            TimetablesCommands::Export(args) => trains_export(args, db_pool.into()).await,
        },
        Commands::STDCMSearchEnv(subcommand) => {
            handle_stdcm_search_env_command(subcommand, db_pool).await
        }
        Commands::Roles(roles_command) => match roles_command {
            RolesCommand::ListRoles => {
                roles::list_roles();
                Ok(())
            }
            RolesCommand::List(list_args) => {
                roles::list_subject_roles(list_args, Arc::new(db_pool), openfga_config)
                    .await
                    .map_err(Into::into)
            }
            RolesCommand::Add(add_args) => {
                roles::add_roles(add_args, Arc::new(db_pool), openfga_config)
                    .await
                    .map_err(Into::into)
            }
            RolesCommand::Remove(remove_args) => {
                roles::remove_roles(remove_args, Arc::new(db_pool), openfga_config)
                    .await
                    .map_err(Into::into)
            }
        },
        Commands::Group(group_command) => match group_command {
            GroupCommand::Create(create_args) => {
                group::create_group(create_args, Arc::new(db_pool))
                    .await
                    .map_err(Into::into)
            }
            GroupCommand::List => group::list_group(Arc::new(db_pool))
                .await
                .map_err(Into::into),
            GroupCommand::Include(include_args) => {
                group::include_group(include_args, openfga_config, Arc::new(db_pool))
                    .await
                    .map_err(Into::into)
            }
            GroupCommand::Exclude(exclude_args) => {
                group::exclude_group(exclude_args, openfga_config, Arc::new(db_pool))
                    .await
                    .map_err(Into::into)
            }
        },
        Commands::User(user_command) => match user_command {
            UserCommand::List(list_args) => {
                user::list_user(list_args, openfga_config, Arc::new(db_pool))
                    .await
                    .map_err(Into::into)
            }
            UserCommand::Add(add_args) => user::add_user(add_args, Arc::new(db_pool))
                .await
                .map_err(Into::into),
        },
        Commands::Healthcheck(core_config) => {
            healthcheck_cmd(db_pool.into(), valkey_config, core_config, openfga_config)
                .await
                .map_err(Into::into)
        }
    }
}

#[derive(Debug, Error, PartialEq)]
pub struct CliError {
    exit_code: i32,
    message: String,
}

impl std::fmt::Display for CliError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl CliError {
    pub fn new<T: AsRef<str>>(exit_code: i32, message: T) -> Self {
        CliError {
            exit_code,
            message: message.as_ref().to_string(),
        }
    }
}

impl From<anyhow::Error> for CliError {
    fn from(err: anyhow::Error) -> Self {
        CliError {
            exit_code: 1,
            message: format!("❌ {err}"),
        }
    }
}
