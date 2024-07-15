#[macro_use]
extern crate diesel;

mod client;
mod core;
mod error;
mod fixtures;
mod generated_data;
mod infra_cache;
mod map;
mod models;
mod modelsv2;
mod redis_utils;
mod tables;
mod views;

use crate::core::CoreClient;
use crate::error::InternalError;
use crate::modelsv2::Infra;
use crate::views::OpenApiRoot;
use actix_cors::Cors;
use actix_web::dev::{Service, ServiceRequest};
use actix_web::middleware::{Logger, NormalizePath};
use actix_web::web::{scope, Data, JsonConfig, PayloadConfig};
use actix_web::{App, HttpServer};
use chashmap::CHashMap;
use clap::Parser;
use client::PostgresConfig;
use client::{
    ClearArgs, Client, Color, Commands, DeleteProfileSetArgs, ElectricalProfilesCommands,
    ExportTimetableArgs, GenerateArgs, ImportProfileSetArgs, ImportRailjsonArgs,
    ImportRollingStockArgs, ImportTimetableArgs, InfraCloneArgs, InfraCommands, ListProfileSetArgs,
    MakeMigrationArgs, RedisConfig, RefreshArgs, RunserverArgs, SearchCommands, TimetablesCommands,
};
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::ElectricalProfileSetData;
use editoast_schemas::rolling_stock::RollingStock;
use editoast_schemas::train_schedule::TrainScheduleBase;
use modelsv2::{
    timetable::Timetable, timetable::TimetableWithTrains, train_schedule::TrainSchedule,
    train_schedule::TrainScheduleChangeset,
};
use modelsv2::{Changeset, RollingStockModel};
use opentelemetry_datadog::DatadogPropagator;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use views::v2::train_schedule::{TrainScheduleForm, TrainScheduleResult};

use colored::*;
use diesel::sql_query;
use diesel_async::RunQueryDsl;
use diesel_json::Json as DieselJson;
use editoast_models::DbConnection;
use editoast_schemas::infra::RailJson;
use editoast_search::{SearchConfig, SearchConfigStore};
use infra_cache::InfraCache;
use map::MapLayers;
use modelsv2::electrical_profiles::ElectricalProfileSet;
use modelsv2::prelude::*;
use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig as _;
use opentelemetry_sdk::Resource;
pub use redis_utils::{RedisClient, RedisConnection};
use std::error::Error;
use std::fs::File;
use std::io::{BufReader, IsTerminal};
use std::ops::DerefMut;
use std::process::exit;
use std::sync::Arc;
use std::{env, fs};
use thiserror::Error;
use tracing::{error, info};
use tracing_subscriber::{layer::SubscriberExt as _, util::SubscriberInitExt as _, Layer as _};
use validator::ValidationErrorsKind;
use views::infra::InfraApiError;
use views::search::SearchConfigFinder;

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
        .from_env_lossy();
    let fmt_layer = tracing_subscriber::fmt::layer()
        .pretty()
        .with_file(false)
        .with_line_number(false);
    let fmt_layer = if mode == EditoastMode::Cli {
        fmt_layer.with_writer(std::io::stderr).boxed()
    } else {
        fmt_layer.boxed()
    };
    // https://docs.rs/tracing-subscriber/latest/tracing_subscriber/layer/index.html#runtime-configuration-with-layers
    let telemetry_layer = match telemetry_config.telemetry_kind {
        client::TelemetryKind::None => None,
        client::TelemetryKind::Datadog => {
            let datadog_tracer = opentelemetry_datadog::new_pipeline()
                .with_service_name(telemetry_config.service_name.as_str())
                .with_agent_endpoint(telemetry_config.telemetry_endpoint.as_str())
                .install_batch(opentelemetry_sdk::runtime::Tokio)
                .expect("Failed to initialize datadog tracer");
            let layer = tracing_opentelemetry::layer()
                .with_tracer(datadog_tracer)
                .boxed();
            opentelemetry::global::set_text_map_propagator(DatadogPropagator::default());
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

    let redis_config = client.redis_config;

    match client.color {
        Color::Never => colored::control::set_override(false),
        Color::Always => colored::control::set_override(true),
        Color::Auto => colored::control::set_override(std::io::stderr().is_terminal()),
    }

    match client.command {
        Commands::Runserver(args) => runserver(args, pg_config, redis_config).await,
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
            InfraCommands::Clear(args) => clear_infra(args, db_pool.into(), redis_config).await,
            InfraCommands::Generate(args) => {
                generate_infra(args, db_pool.into(), redis_config).await
            }
            InfraCommands::ImportRailjson(args) => import_railjson(args, db_pool.into()).await,
        },
        Commands::Timetables(subcommand) => match subcommand {
            TimetablesCommands::Import(args) => trains_import(args, db_pool.into()).await,
            TimetablesCommands::Export(args) => trains_export(args, db_pool.into()).await,
        },
    }
}

async fn trains_export(
    args: ExportTimetableArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let train_ids =
        match TimetableWithTrains::retrieve(db_pool.get().await?.deref_mut(), args.id).await? {
            Some(timetable) => timetable.train_ids,
            None => {
                let error = CliError::new(1, format!("❌ Timetable not found, id: {0}", args.id));
                return Err(Box::new(error));
            }
        };

    let (train_schedules, missing): (Vec<_>, _) =
        TrainSchedule::retrieve_batch(db_pool.get().await?.deref_mut(), train_ids).await?;

    assert!(missing.is_empty());

    let train_schedules: Vec<TrainScheduleBase> = train_schedules
        .into_iter()
        .map(|ts| Into::<TrainScheduleResult>::into(ts).train_schedule)
        .collect();

    let file = File::create(args.path.clone())?;
    serde_json::to_writer_pretty(file, &train_schedules)?;

    println!(
        "✅ Train schedules exported to {0}",
        args.path.to_string_lossy()
    );

    Ok(())
}

async fn trains_import(
    args: ImportTimetableArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let train_file = match File::open(args.path.clone()) {
        Ok(file) => file,
        Err(e) => {
            let error = CliError::new(
                1,
                format!("❌ Could not open file {:?} ({:?})", args.path, e),
            );
            return Err(Box::new(error));
        }
    };

    let timetable = match args.id {
        Some(timetable) => match Timetable::retrieve(db_pool.get().await?.deref_mut(), timetable)
            .await?
        {
            Some(timetable) => timetable,
            None => {
                let error = CliError::new(1, format!("❌ Timetable not found, id: {0}", timetable));
                return Err(Box::new(error));
            }
        },
        None => {
            let changeset = Timetable::changeset();
            changeset.create(db_pool.get().await?.deref_mut()).await?
        }
    };

    let train_schedules: Vec<TrainScheduleBase> =
        serde_json::from_reader(BufReader::new(train_file))?;
    let changesets: Vec<TrainScheduleChangeset> = train_schedules
        .into_iter()
        .map(|train_schedule| {
            TrainScheduleForm {
                timetable_id: Some(timetable.id),
                train_schedule,
            }
            .into()
        })
        .collect();
    let inserted: Vec<_> =
        TrainSchedule::create_batch(db_pool.get().await?.deref_mut(), changesets).await?;

    println!(
        "✅ {} train schedules created for timetable with id {}",
        inserted.len(),
        timetable.id
    );

    Ok(())
}

fn log_received_request(req: &ServiceRequest) {
    let request_line = if req.query_string().is_empty() {
        format!("{} {} {:?}", req.method(), req.path(), req.version())
    } else {
        format!(
            "{} {}?{} {:?}",
            req.method(),
            req.path(),
            req.query_string(),
            req.version()
        )
    };
    info!(target: "actix_logger", "{} RECEIVED", request_line);
}

/// Create and run the server
async fn runserver(
    args: RunserverArgs,
    postgres_config: PostgresConfig,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    info!("Building server...");
    // Config database
    let redis = RedisClient::new(redis_config)?;

    // Create both database pools
    // NOTE: Okay, this is a bit convoluted because we need both versions
    // but we don't want to duplicate the underlying connection pool.
    // 1. We defer the creation of the pool to DbConnectionPoolV2 to avoid code duplication.
    // 2. We extract a reference to the underlying pool == DbConnectionPoolV1
    // 3. We drop the DbConnectionPoolV2 so its Arc reference is dropped as well
    // 4. Since DbConnectionPoolV2 went out of scope, the refcount of the Arc is 1
    //    and we can extract its inner value.
    // 5. We wrap it again in an actix_web::web::Data.
    // 6. Since this new wrapper re-creates an Arc, we can use it to re-create a DbConnectionPoolV2.
    // 7. All this spaghetti will be removed once we fully migrate to pool v2 :D
    let db_pool_v1_arc = {
        let db_pool =
            DbConnectionPoolV2::try_initialize(postgres_config.url()?, postgres_config.pool_size)
                .await?;
        db_pool.pool_v1()
    };
    let db_pool_v1 = Arc::into_inner(db_pool_v1_arc).unwrap();
    let db_pool_v1 = Data::new(db_pool_v1);
    let db_pool_v2 = DbConnectionPoolV2::from_pool(db_pool_v1.clone().into_inner()).await;
    let db_pool_v2 = Data::new(db_pool_v2);

    // Custom Json extractor configuration
    let json_cfg = JsonConfig::default()
        .limit(250 * 1024 * 1024) // 250MiB
        .error_handler(|err, _| InternalError::from(err).into());

    // Custom Bytes and String extractor configuration
    let payload_config = PayloadConfig::new(64 * 1024 * 1024); // 64MiB

    // Setup shared states
    let infra_caches = Data::new(CHashMap::<i64, InfraCache>::default());

    let server = HttpServer::new(move || {
        // Build CORS
        let cors = {
            let allowed_origin = env::var("OSRD_ALLOWED_ORIGIN").ok();
            match allowed_origin {
                Some(origin) => Cors::default()
                    .allowed_origin(origin.as_str())
                    .allow_any_method()
                    .allow_any_header(),
                None => Cors::default()
                    .allow_any_origin()
                    .allow_any_method()
                    .allow_any_header(),
            }
        };

        // Build Core client
        let core_client = CoreClient::new_direct(
            args.backend_url.parse().expect("invalid backend_url value"),
            args.backend_token.clone(),
        );

        let actix_logger_format = r#"%r STATUS: %s in %T s ("%{Referer}i" "%{User-Agent}i")"#;

        App::new()
            .wrap(actix_web_opentelemetry::RequestTracing::new())
            .wrap(cors)
            .wrap(NormalizePath::trim())
            .wrap_fn(|req, srv| {
                log_received_request(&req);
                srv.call(req)
            })
            .wrap(Logger::new(actix_logger_format).log_target("actix_logger"))
            .app_data(json_cfg.clone())
            .app_data(payload_config.clone())
            .app_data(db_pool_v1.clone())
            .app_data(db_pool_v2.clone())
            .app_data(Data::new(redis.clone()))
            .app_data(infra_caches.clone())
            .app_data(Data::new(MapLayers::parse()))
            .app_data(Data::new(args.map_layers_config.clone()))
            .app_data(Data::new(core_client))
            .service(scope(&args.root_path).service(views::routes()))
    });

    let server = match args.workers {
        Some(workers) => server.workers(workers),
        None => server,
    };

    // Run server
    info!("Running server...");
    server
        .bind((args.address.clone(), args.port))?
        .run()
        .await?;
    Ok(())
}

async fn build_redis_pool_and_invalidate_all_cache(
    redis_config: RedisConfig,
    infra_id: i64,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let redis = RedisClient::new(redis_config).unwrap();
    let mut conn = redis.get_connection().await.unwrap();
    Ok(map::invalidate_all(
        &mut conn,
        &MapLayers::parse().layers.keys().cloned().collect(),
        infra_id,
    )
    .await
    .map_err(|e| {
        Box::new(CliError::new(
            1,
            format!("Couldn't refresh redis cache layers: {e}"),
        ))
    })?)
}

async fn batch_retrieve_infras(
    conn: &mut DbConnection,
    ids: &[u64],
) -> Result<Vec<Infra>, Box<dyn Error + Send + Sync>> {
    let (infras, missing) = Infra::retrieve_batch(conn, ids.iter().map(|id| *id as i64)).await?;
    if !missing.is_empty() {
        let error = CliError::new(
            1,
            format!(
                "❌ Infrastructures not found: {missing}",
                missing = missing
                    .iter()
                    .map(|id| id.to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
        );
        return Err(Box::new(error));
    }
    Ok(infras)
}

/// Run the generate sub command
/// This command refresh all infra given as input (if no infra given then refresh all of them)
async fn generate_infra(
    args: GenerateArgs,
    db_pool: Arc<DbConnectionPoolV2>,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::all(db_pool.get().await?.deref_mut()).await {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        infras = batch_retrieve_infras(db_pool.get().await?.deref_mut(), &args.infra_ids).await?;
    }
    for mut infra in infras {
        println!(
            "🍞 Infra {}[{}] is generating:",
            infra.name.clone().bold(),
            infra.id
        );
        let infra_cache = InfraCache::load(db_pool.get().await?.deref_mut(), &infra).await?;
        if infra
            .refresh(db_pool.clone(), args.force, &infra_cache)
            .await?
        {
            build_redis_pool_and_invalidate_all_cache(redis_config.clone(), infra.id).await?;
            println!("✅ Infra {}[{}] generated!", infra.name.bold(), infra.id);
        } else {
            println!(
                "✅ Infra {}[{}] already generated!",
                infra.name.bold(),
                infra.id
            );
        }
    }
    println!(
        "🚨 You may want to refresh the search caches. If so, use {}.",
        "editoast search refresh".bold()
    );
    Ok(())
}

async fn import_rolling_stock(
    args: ImportRollingStockArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    for rolling_stock_path in args.rolling_stock_path {
        let rolling_stock_file = File::open(rolling_stock_path)?;
        let rolling_stock_form: RollingStock =
            serde_json::from_reader(BufReader::new(rolling_stock_file))?;
        let rolling_stock: Changeset<RollingStockModel> = rolling_stock_form.into();
        match rolling_stock.validate_imported_rolling_stock() {
            Ok(()) => {
                println!(
                    "🍞 Importing rolling stock {}",
                    rolling_stock
                        .name
                        .as_ref()
                        .map(|n| n.bold())
                        .unwrap_or("rolling stock witout name".bold())
                );
                let rolling_stock = rolling_stock
                    .locked(false)
                    .version(0)
                    .create(db_pool.get().await?.deref_mut())
                    .await?;
                println!(
                    "✅ Rolling stock {}[{}] saved!",
                    &rolling_stock.name.bold(),
                    &rolling_stock.id
                );
            }
            Err(e) => {
                let mut error_message = "❌ Rolling stock was not created!".to_string();
                if let Some(ValidationErrorsKind::Field(field_errors)) = e.errors().get("__all__") {
                    for error in field_errors {
                        if &error.code == "electrical_power_startup_time" {
                            error_message.push_str(
                                "\nRolling stock is electrical, but electrical_power_startup_time is missing"
                            );
                        }
                        if &error.code == "raise_pantograph_time" {
                            error_message.push_str(
                                "\nRolling stock is electrical, but raise_pantograph_time is missing"
                            );
                        }
                    }
                }
                return Err(Box::new(CliError::new(2, error_message)));
            }
        };
    }
    Ok(())
}

async fn clone_infra(
    infra_args: InfraCloneArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let infra = Infra::retrieve(db_pool.get().await?.deref_mut(), infra_args.id as i64)
        .await?
        .ok_or_else(|| {
            // When EditoastError will be removed from the models crate,
            // this can become a retrieve_or_fail
            CliError::new(
                1,
                format!("❌ Infrastructure not found, ID: {}", infra_args.id),
            )
        })?;
    let new_name = infra_args
        .new_name
        .unwrap_or_else(|| format!("{} (clone)", infra.name));
    let cloned_infra = infra
        .clone(db_pool.get().await?.deref_mut(), new_name)
        .await?;
    println!(
        "✅ Infra {} (ID: {}) was successfully cloned",
        cloned_infra.name.bold(),
        cloned_infra.id
    );
    Ok(())
}

async fn import_railjson(
    args: ImportRailjsonArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let railjson_file = match File::open(args.railjson_path.clone()) {
        Ok(file) => file,
        Err(_) => {
            let error = CliError::new(
                1,
                format!(
                    "❌ Railjson file not found, Path: {}",
                    args.railjson_path.to_string_lossy()
                ),
            );
            return Err(Box::new(error));
        }
    };

    let infra_name = args.infra_name.clone().bold();

    let infra = Infra::changeset()
        .name(args.infra_name)
        .last_railjson_version();
    let railjson: RailJson = serde_json::from_reader(BufReader::new(railjson_file))?;

    println!("🍞 Importing infra {infra_name}");
    let mut infra = infra
        .persist(railjson, db_pool.get().await?.deref_mut())
        .await?;

    infra
        .bump_version(db_pool.get().await?.deref_mut())
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id: infra.id })?;

    println!("✅ Infra {infra_name}[{}] saved!", infra.id);
    // Generate only if the was set
    if args.generate {
        let infra_cache = InfraCache::load(db_pool.get().await?.deref_mut(), &infra).await?;
        infra.refresh(db_pool, true, &infra_cache).await?;
        println!(
            "✅ Infra {infra_name}[{}] generated data refreshed!",
            infra.id
        );
    };
    Ok(())
}

async fn electrical_profile_set_import(
    args: ImportProfileSetArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let electrical_profile_set_file = File::open(args.electrical_profile_set_path)?;

    let electrical_profile_set_data: ElectricalProfileSetData =
        serde_json::from_reader(BufReader::new(electrical_profile_set_file))?;
    let ep_set = ElectricalProfileSet::changeset()
        .name(args.name)
        .data(electrical_profile_set_data);

    let created_ep_set = ep_set.create(db_pool.get().await?.deref_mut()).await?;
    println!("✅ Electrical profile set {} created", created_ep_set.id);
    Ok(())
}

async fn electrical_profile_set_list(
    args: ListProfileSetArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let electrical_profile_sets =
        ElectricalProfileSet::list_light(db_pool.get().await?.deref_mut())
            .await
            .unwrap();
    if !args.quiet {
        println!("Electrical profile sets:\nID - Name");
    }
    for electrical_profile_set in electrical_profile_sets {
        println!(
            "{:<2} - {}",
            electrical_profile_set.id, electrical_profile_set.name
        );
    }
    Ok(())
}

async fn electrical_profile_set_delete(
    args: DeleteProfileSetArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    for profile_set_id in args.profile_set_ids {
        let deleted =
            ElectricalProfileSet::delete_static(db_pool.get().await?.deref_mut(), profile_set_id)
                .await
                .unwrap();
        if !deleted {
            println!("❎ Electrical profile set {} not found", profile_set_id);
        } else {
            println!("✅ Electrical profile set {} deleted", profile_set_id);
        }
    }
    Ok(())
}

/// Run the clear subcommand
/// This command clear all generated data for the given infra
async fn clear_infra(
    args: ClearArgs,
    db_pool: Arc<DbConnectionPoolV2>,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::all(db_pool.get().await?.deref_mut()).await {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        infras = batch_retrieve_infras(db_pool.get().await?.deref_mut(), &args.infra_ids).await?;
    };

    for mut infra in infras {
        println!(
            "🍞 Infra {}[{}] is clearing:",
            infra.name.clone().bold(),
            infra.id
        );
        build_redis_pool_and_invalidate_all_cache(redis_config.clone(), infra.id).await?;
        infra.clear(db_pool.get().await?.deref_mut()).await?;
        println!("✅ Infra {}[{}] cleared!", infra.name.bold(), infra.id);
    }
    Ok(())
}

/// Prints the OpenApi to stdout
fn generate_openapi() {
    let openapi = OpenApiRoot::build_openapi();
    print!("{}", serde_yaml::to_string(&openapi).unwrap());
}

fn list_search_objects() {
    SearchConfigFinder::all()
        .into_iter()
        .for_each(|SearchConfig { name, .. }| {
            println!("{name}");
        });
}

fn make_search_migration(args: MakeMigrationArgs) -> Result<(), Box<dyn Error + Send + Sync>> {
    let MakeMigrationArgs {
        object,
        migration,
        force,
        skip_down,
    } = args;
    let Some(search_config) = SearchConfigFinder::find(&object) else {
        let error = format!("❌ No search object found for {object}");
        return Err(Box::new(CliError::new(2, error)));
    };
    if !search_config.has_migration() {
        let error = format!("❌ No migration defined for {object}");
        return Err(Box::new(CliError::new(2, error)));
    }
    if !migration.is_dir() {
        let error = format!(
            "❌ {} is not a directory",
            migration.to_str().unwrap_or("<unprintable path>")
        );
        return Err(Box::new(CliError::new(2, error)));
    }
    let up_path = migration.join("up.sql");
    let down_path = migration.join("down.sql");
    let up_path_str = up_path.to_str().unwrap_or("<unprintable path>").to_owned();
    let down_path_str = down_path
        .to_str()
        .unwrap_or("<unprintable path>")
        .to_owned();
    if !force
        && (up_path.exists() && fs::read(up_path.clone()).is_ok_and(|v| !v.is_empty())
            || down_path.exists() && fs::read(down_path.clone()).is_ok_and(|v| !v.is_empty()))
    {
        let error = format!("❌ Migration {} already has content\nCowardly refusing to overwrite it\nUse {} at your own risk",
        migration.to_str().unwrap_or("<unprintable path>"),
        "--force".bold());
        return Err(Box::new(CliError::new(2, error)));
    }
    println!(
        "🤖 Generating migration {}",
        migration.to_str().unwrap_or("<unprintable path>")
    );
    let (up, down) = search_config.make_up_down();
    if let Err(err) = fs::write(up_path, up) {
        let error = format!("❌ Failed to write to {up_path_str}: {err}");
        return Err(Box::new(CliError::new(2, error)));
    }
    println!("➡️  Wrote to {up_path_str}");
    if !skip_down {
        if let Err(err) = fs::write(down_path, down) {
            let error = format!("❌ Failed to write to {down_path_str}: {err}");
            return Err(Box::new(CliError::new(2, error)));
        }
        println!("➡️  Wrote to {down_path_str}");
    }
    println!(
        "✅ Migration {} generated!\n🚨 Don't forget to run {} or {} to apply it",
        migration.to_str().unwrap_or("<unprintable path>"),
        "diesel migration run".bold(),
        "diesel migration redo".bold(),
    );
    Ok(())
}

async fn refresh_search_tables(
    args: RefreshArgs,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let objects = if args.objects.is_empty() {
        SearchConfigFinder::all()
            .into_iter()
            .filter(|config| config.has_migration())
            .map(|SearchConfig { name, .. }| name)
            .collect()
    } else {
        args.objects
    };

    for object in objects {
        let Some(search_config) = SearchConfigFinder::find(&object) else {
            eprintln!("❌ No search object found for {object}");
            continue;
        };
        if !search_config.has_migration() {
            eprintln!("❌ No migration defined for {object}");
            continue;
        }
        println!("🤖 Refreshing search table for {}", object);
        println!("🚮 Dropping {} content", search_config.table);
        sql_query(search_config.clear_sql())
            .execute(db_pool.get().await?.deref_mut())
            .await?;
        println!("♻️  Regenerating {}", search_config.table);
        sql_query(search_config.refresh_table_sql())
            .execute(db_pool.get().await?.deref_mut())
            .await?;
        println!("✅ Search table for {} refreshed!", object);
    }
    Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

    use crate::fixtures::tests::get_fast_rolling_stock_schema;
    use crate::fixtures::tests::get_trainschedule_json_array;
    use crate::modelsv2::fixtures::create_electrical_profile_set;
    use crate::modelsv2::RollingStockModel;

    use editoast_models::DbConnectionPoolV2;
    use modelsv2::DeleteStatic;
    use rand::distributions::Alphanumeric;
    use rand::{thread_rng, Rng};
    use rstest::rstest;
    use serde::Serialize;
    use std::io::Write;
    use std::ops::DerefMut;
    use tempfile::NamedTempFile;

    #[rstest]
    async fn import_export_timetable_schedule_v2() {
        let db_pool = DbConnectionPoolV2::for_tests();

        let changeset = Timetable::changeset();
        let timetable = changeset
            .create(db_pool.get_ok().deref_mut())
            .await
            .unwrap();

        let mut file = NamedTempFile::new().unwrap();
        file.write_all(get_trainschedule_json_array().as_bytes())
            .unwrap();

        // Test import
        let args = ImportTimetableArgs {
            path: file.path().into(),
            id: Some(timetable.id),
        };
        let result = trains_import(args, db_pool.clone().into()).await;
        assert!(result.is_ok(), "{:?}", result);

        // Test to export the import
        let export_file = NamedTempFile::new().unwrap();
        let args = ExportTimetableArgs {
            path: export_file.path().into(),
            id: timetable.id,
        };
        let export_result = trains_export(args, db_pool.clone().into()).await;
        assert!(export_result.is_ok(), "{:?}", export_result);

        // Test to reimport the exported import
        let reimport_args = ImportTimetableArgs {
            path: export_file.path().into(),
            id: Some(timetable.id),
        };
        let reimport_result = trains_import(reimport_args, db_pool.clone().into()).await;
        assert!(reimport_result.is_ok(), "{:?}", reimport_result);

        Timetable::delete_static(db_pool.get_ok().deref_mut(), timetable.id)
            .await
            .unwrap();
    }

    #[rstest]
    async fn import_rolling_stock_ko_file_not_found() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec!["non/existing/railjson/file/location".into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.into()).await;

        // THEN
        assert!(result.is_err())
    }

    #[rstest]
    async fn import_non_electric_rs_without_startup_and_panto_values() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_name =
            "fast_rolling_stock_import_non_electric_rs_without_startup_and_panto_values";
        let mut non_electric_rs = get_fast_rolling_stock_schema(rolling_stock_name);
        non_electric_rs.effort_curves.modes.remove("25000V");

        let file = generate_temp_file(&non_electric_rs);
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone().into()).await;

        // THEN
        assert!(
            result.is_ok(),
            "import should succeed, as raise_panto and startup are not required for non electric",
        );
        use crate::modelsv2::Retrieve;
        let created_rs = RollingStockModel::retrieve(
            db_pool.get_ok().deref_mut(),
            rolling_stock_name.to_string(),
        )
        .await
        .unwrap();
        assert!(created_rs.is_some());
    }

    #[rstest]
    async fn import_non_electric_rs_with_startup_and_panto_values() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_name =
            "fast_rolling_stock_import_non_electric_rs_with_startup_and_panto_values";
        let mut non_electric_rs = get_fast_rolling_stock_schema(rolling_stock_name);
        non_electric_rs.effort_curves.modes.remove("25000V");

        let file = generate_temp_file(&non_electric_rs);
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone().into()).await;

        // THEN
        assert!(result.is_ok(), "import should succeed");
        use crate::modelsv2::Retrieve;
        let created_rs = RollingStockModel::retrieve(
            db_pool.get_ok().deref_mut(),
            rolling_stock_name.to_string(),
        )
        .await
        .expect("failed to retrieve rolling stock")
        .unwrap();
        let RollingStockModel {
            electrical_power_startup_time,
            raise_pantograph_time,
            ..
        } = created_rs;
        assert!(electrical_power_startup_time.is_some());
        assert!(raise_pantograph_time.is_some());
    }

    #[rstest]
    async fn import_electric_rs_without_startup_and_panto_values() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_name =
            "fast_rolling_stock_import_electric_rs_without_startup_and_panto_values";
        let mut electric_rs = get_fast_rolling_stock_schema(rolling_stock_name);
        electric_rs.raise_pantograph_time = None;
        electric_rs.electrical_power_startup_time = None;
        let file = generate_temp_file(&electric_rs);
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone().into()).await;

        // THEN
        assert!(
            result.is_err(),
            "import should fail, as raise_panto and startup are required for electric"
        );
        use crate::modelsv2::Retrieve;
        let created_rs = RollingStockModel::retrieve(
            db_pool.get_ok().deref_mut(),
            rolling_stock_name.to_string(),
        )
        .await
        .unwrap();
        assert!(created_rs.is_none());
    }

    #[rstest]
    async fn import_electric_rs_with_startup_and_panto_values() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let rolling_stock_name =
            "fast_rolling_stock_import_electric_rs_with_startup_and_panto_values";
        let electric_rolling_stock = get_fast_rolling_stock_schema(rolling_stock_name);
        let file = generate_temp_file(&electric_rolling_stock);
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone().into()).await;

        // THEN
        assert!(result.is_ok(), "import should succeed");
        use crate::modelsv2::Retrieve;
        let created_rs = RollingStockModel::retrieve(
            db_pool.get_ok().deref_mut(),
            rolling_stock_name.to_string(),
        )
        .await
        .expect("Failed to retrieve rolling stock")
        .unwrap();
        let RollingStockModel {
            electrical_power_startup_time,
            raise_pantograph_time,
            ..
        } = created_rs;
        assert!(electrical_power_startup_time.is_some());
        assert!(raise_pantograph_time.is_some());
    }

    #[rstest]
    async fn import_railjson_ko_file_not_found() {
        // GIVEN
        let railjson_path = "non/existing/railjson/file/location";
        let args: ImportRailjsonArgs = ImportRailjsonArgs {
            infra_name: "test".into(),
            railjson_path: railjson_path.into(),
            generate: false,
        };

        // WHEN
        let result = import_railjson(args.clone(), DbConnectionPoolV2::for_tests().into()).await;

        // THEN
        assert!(result.is_err());
        assert_eq!(
            result
                .unwrap_err()
                .downcast_ref::<CliError>()
                .unwrap()
                .exit_code,
            1
        );
    }

    #[rstest]
    async fn import_railjson_ok() {
        // GIVEN
        let railjson = Default::default();
        let file = generate_temp_file::<RailJson>(&railjson);
        let infra_name = format!(
            "{}_{}",
            "infra",
            (0..10)
                .map(|_| thread_rng().sample(Alphanumeric) as char)
                .collect::<String>(),
        );
        let args: ImportRailjsonArgs = ImportRailjsonArgs {
            infra_name: infra_name.clone(),
            railjson_path: file.path().into(),
            generate: false,
        };

        // WHEN
        let result = import_railjson(args, DbConnectionPoolV2::for_tests().into()).await;

        // THEN
        assert!(result.is_ok());
    }

    fn generate_temp_file<T: Serialize>(object: &T) -> NamedTempFile {
        let mut tmp_file = NamedTempFile::new().unwrap();
        write!(tmp_file, "{}", serde_json::to_string(object).unwrap()).unwrap();
        tmp_file
    }

    #[rstest]
    async fn test_electrical_profile_set_delete() {
        // GIVEN
        let db_pool = DbConnectionPoolV2::for_tests();
        let electrical_profile_set =
            create_electrical_profile_set(db_pool.get_ok().deref_mut()).await;

        let args = DeleteProfileSetArgs {
            profile_set_ids: vec![electrical_profile_set.id],
        };

        // WHEN
        electrical_profile_set_delete(args, db_pool.clone().into())
            .await
            .unwrap();

        // THEN
        let empty = !ElectricalProfileSet::list_light(db_pool.get_ok().deref_mut())
            .await
            .unwrap()
            .iter()
            .any(|eps| eps.id == electrical_profile_set.id);
        assert!(empty);
    }

    #[rstest]
    async fn test_electrical_profile_set_list_doesnt_fail() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let _ = create_electrical_profile_set(db_pool.get_ok().deref_mut()).await;
        for quiet in [true, false] {
            let args = ListProfileSetArgs { quiet };
            electrical_profile_set_list(args, db_pool.clone().into())
                .await
                .unwrap();
        }
    }
}
