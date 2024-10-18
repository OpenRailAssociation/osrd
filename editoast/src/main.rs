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

use crate::core::CoreClient;
use crate::views::OpenApiRoot;
use axum::extract::DefaultBodyLimit;
use axum::extract::FromRef;
use axum::{Router, ServiceExt};
use axum_tracing_opentelemetry::middleware::OtelAxumLayer;
use clap::Parser;
use client::electrical_profiles_commands::*;
use client::import_rolling_stock::*;
use client::infra_commands::*;
use client::roles;
use client::roles::RolesCommand;
use client::search_commands::*;
use client::stdcm_search_env_commands::handle_stdcm_search_env_command;
use client::timetables_commands::*;
use client::CoreArgs;
use client::{Client, Color, Commands, RunserverArgs, ValkeyConfig};
use client::{MapLayersConfig, PostgresConfig};
use dashmap::DashMap;
use editoast_models::DbConnectionPool;
use editoast_models::DbConnectionPoolV2;
use editoast_osrdyne_client::OsrdyneClient;
use generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use infra_cache::InfraCache;
use models::RollingStockModel;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use tower::Layer as _;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::normalize_path::NormalizePathLayer;
use tower_http::trace::TraceLayer;
use views::check_health;

use core::mq_client;
use map::MapLayers;
use models::prelude::*;
use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig as _;
use opentelemetry_sdk::Resource;
use std::env;
use std::error::Error;
use std::io::IsTerminal;
use std::process::exit;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;
use tracing::{error, info, warn};
use tracing_subscriber::{layer::SubscriberExt as _, util::SubscriberInitExt as _, Layer as _};
pub use valkey_utils::{ValkeyClient, ValkeyConnection};
use views::authentication_middleware;

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

fn init_tracing(mode: EditoastMode, telemetry_config: &client::TelemetryConfig) {
    let env_filter_layer = tracing_subscriber::EnvFilter::builder()
        // Set the default log level to 'info'
        .with_default_directive(tracing_subscriber::filter::LevelFilter::INFO.into())
        .from_env_lossy()
        .add_directive(
            "tower_http=debug"
                .parse()
                .expect("valid 'RUST_LOG' directive"),
        );
    let fmt_layer = tracing_subscriber::fmt::layer()
        .pretty()
        .with_file(true)
        .with_line_number(false);
    let fmt_layer = if mode == EditoastMode::Cli {
        fmt_layer.with_writer(std::io::stderr).boxed()
    } else {
        fmt_layer.boxed()
    };
    // https://docs.rs/tracing-subscriber/latest/tracing_subscriber/layer/index.html#runtime-configuration-with-layers
    let telemetry_layer = match telemetry_config.telemetry_kind {
        client::TelemetryKind::None => None,
        #[cfg(feature = "datadog")]
        client::TelemetryKind::Datadog => {
            let datadog_tracer = opentelemetry_datadog::new_pipeline()
                .with_service_name(telemetry_config.service_name.as_str())
                .with_agent_endpoint(telemetry_config.telemetry_endpoint.as_str())
                .install_batch(opentelemetry_sdk::runtime::Tokio)
                .expect("Failed to initialize datadog tracer");
            let layer = tracing_opentelemetry::layer()
                .with_tracer(datadog_tracer)
                .boxed();
            opentelemetry::global::set_text_map_propagator(
                opentelemetry_datadog::DatadogPropagator::default(),
            );
            Some(layer)
        }
        client::TelemetryKind::Opentelemetry => {
            let exporter = opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(telemetry_config.telemetry_endpoint.as_str());
            let trace_config =
                opentelemetry_sdk::trace::config().with_resource(Resource::new(vec![
                    KeyValue::new(
                        opentelemetry_semantic_conventions::resource::SERVICE_NAME,
                        telemetry_config.service_name.clone(),
                    ),
                ]));
            let otlp_tracer = opentelemetry_otlp::new_pipeline()
                .tracing()
                .with_exporter(exporter)
                .with_trace_config(trace_config)
                .install_batch(opentelemetry_sdk::runtime::Tokio)
                .expect("Failed to initialize Opentelemetry tracer");
            let layer = tracing_opentelemetry::layer()
                .with_tracer(otlp_tracer)
                .boxed();
            opentelemetry::global::set_text_map_propagator(TraceContextPropagator::new());
            Some(layer)
        }
    };
    tracing_subscriber::registry()
        .with(telemetry_layer)
        .with(env_filter_layer)
        .with(fmt_layer)
        .init();
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
    init_tracing(EditoastMode::from_client(&client), &client.telemetry_config);

    let pg_config = client.postgres_config;
    let db_pool = DbConnectionPoolV2::try_initialize(pg_config.url()?, pg_config.pool_size).await?;

    let valkey_config = client.valkey_config;

    match client.color {
        Color::Never => colored::control::set_override(false),
        Color::Always => colored::control::set_override(true),
        Color::Auto => colored::control::set_override(std::io::stderr().is_terminal()),
    }

    match client.command {
        Commands::Runserver(args) => runserver(args, pg_config, valkey_config).await,
        Commands::ImportRollingStock(args) => import_rolling_stock(args, db_pool.into()).await,
        Commands::OsmToRailjson(args) => {
            osm_to_railjson::osm_to_railjson(args.osm_pbf_in, args.railjson_out)
        }
        Commands::Openapi => {
            generate_openapi();
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
                roles::list_subject_roles(list_args, Arc::new(db_pool))
                    .await
                    .map_err(Into::into)
            }
            RolesCommand::Add(add_args) => roles::add_roles(add_args, Arc::new(db_pool))
                .await
                .map_err(Into::into),
            RolesCommand::Remove(remove_args) => {
                roles::remove_roles(remove_args, Arc::new(db_pool))
                    .await
                    .map_err(Into::into)
            }
        },
        Commands::Healthcheck(core_config) => {
            healthcheck_cmd(db_pool.into(), valkey_config, core_config).await
        }
    }
}

async fn healthcheck_cmd(
    db_pool: Arc<DbConnectionPoolV2>,
    valkey_config: ValkeyConfig,
    core_config: CoreArgs,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let valkey = ValkeyClient::new(valkey_config).unwrap();
    let core_client = CoreClient::new_mq(mq_client::Options {
        uri: core_config.mq_url,
        worker_pool_identifier: String::from("core"),
        timeout: core_config.core_timeout,
        single_worker: core_config.core_single_worker,
        num_channels: core_config.core_client_channels_size,
    })
    .await?;
    check_health(db_pool, valkey.into(), core_client.into())
        .await
        .map_err(|e| CliError::new(1, format!("❌ healthcheck failed: {0}", e)))?;
    println!("✅ Healthcheck passed");
    Ok(())
}

/// The state of the whole Editoast service, available to all handlers
///
/// If only the database is needed, use `State<editoast_models::DbConnectionPoolV2>`.
#[derive(Clone)]
pub struct AppState {
    pub db_pool_v1: Arc<DbConnectionPool>,
    pub db_pool_v2: Arc<DbConnectionPoolV2>,
    pub valkey: Arc<ValkeyClient>,
    pub infra_caches: Arc<DashMap<i64, InfraCache>>,
    pub map_layers: Arc<MapLayers>,
    pub map_layers_config: Arc<MapLayersConfig>,
    pub speed_limit_tag_ids: Arc<SpeedLimitTagIds>,
    pub disable_authorization: bool,
    pub core_client: Arc<CoreClient>,
    pub osrdyne_client: Arc<OsrdyneClient>,
    pub health_check_timeout: Duration,
}

impl AppState {
    async fn init(
        args: &RunserverArgs,
        postgres_config: PostgresConfig,
        valkey_config: ValkeyConfig,
    ) -> Result<Self, Box<dyn Error + Send + Sync>> {
        info!("Building application state...");

        // Config database
        let valkey = ValkeyClient::new(valkey_config)?.into();

        // Create both database pools
        let db_pool_v2 =
            DbConnectionPoolV2::try_initialize(postgres_config.url()?, postgres_config.pool_size)
                .await?;
        let db_pool_v1 = db_pool_v2.pool_v1();
        let db_pool_v2 = Arc::new(db_pool_v2);

        // Setup infra cache map
        let infra_caches = DashMap::<i64, InfraCache>::default().into();

        // Static list of configured speed-limit tag ids
        let speed_limit_tag_ids = Arc::new(SpeedLimitTagIds::load());

        if args.disable_authorization {
            warn!("authorization disabled — all role and permission checks are bypassed");
        }

        // Build Core client
        let core_client = CoreClient::new_mq(mq_client::Options {
            uri: args.core.mq_url.clone(),
            worker_pool_identifier: "core".into(),
            timeout: args.core.core_timeout,
            single_worker: args.core.core_single_worker,
            num_channels: args.core.core_client_channels_size,
        })
        .await?
        .into();

        let osrdyne_client = Arc::new(OsrdyneClient::new(args.osrdyne_api_url.as_str())?);

        let health_check_timeout = Duration::from_millis(args.health_check_timeout_ms);

        Ok(Self {
            valkey,
            db_pool_v1,
            db_pool_v2,
            infra_caches,
            core_client,
            osrdyne_client,
            map_layers: Arc::new(MapLayers::parse()),
            map_layers_config: Arc::new(args.map_layers_config.clone()),
            speed_limit_tag_ids,
            disable_authorization: args.disable_authorization,
            health_check_timeout,
        })
    }
}

impl FromRef<AppState> for DbConnectionPoolV2 {
    fn from_ref(input: &AppState) -> Self {
        (*input.db_pool_v2).clone()
    }
}

/// Create and run the server
async fn runserver(
    args: RunserverArgs,
    postgres_config: PostgresConfig,
    valkey_config: ValkeyConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    info!("Building server...");
    // Custom Bytes and String extractor configuration
    let request_payload_limit = RequestBodyLimitLayer::new(250 * 1024 * 1024); // 250MiB

    // Build CORS layer
    let cors = {
        let allowed_origin = env::var("OSRD_ALLOWED_ORIGIN").ok();
        match allowed_origin {
            Some(origin) => CorsLayer::new()
                .allow_methods(Any)
                .allow_headers(Any)
                .allow_origin(
                    origin
                        .parse::<axum::http::header::HeaderValue>()
                        .expect("invalid allowed origin"),
                ),
            None => CorsLayer::new()
                .allow_methods(Any)
                .allow_headers(Any)
                .allow_origin(Any),
        }
    };

    let app_state = AppState::init(&args, postgres_config, valkey_config).await?;

    // Configure the axum router
    let router: Router<()> = axum::Router::<AppState>::new()
        .merge(views::router())
        .route_layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            authentication_middleware,
        ))
        .layer(OtelAxumLayer::default())
        .layer(DefaultBodyLimit::disable())
        .layer(request_payload_limit)
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);
    let normalizing_router = NormalizePathLayer::trim_trailing_slash().layer(router);

    // Run server
    info!("Running server...");
    let service = ServiceExt::<axum::extract::Request>::into_make_service(normalizing_router);
    let listener = tokio::net::TcpListener::bind((args.address.clone(), args.port)).await?;
    axum::serve(listener, service).await.expect("unreachable");
    Ok(())
}

/// Prints the OpenApi to stdout
fn generate_openapi() {
    let openapi = OpenApiRoot::build_openapi();
    print!("{}", serde_yaml::to_string(&openapi).unwrap());
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
