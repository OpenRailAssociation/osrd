#[macro_use]
extern crate diesel;
#[macro_use]
extern crate cfg_if;

mod client;
mod converters;
mod core;
mod error;
mod fixtures;
mod generated_data;
mod infra_cache;
mod map;
mod models;
mod modelsv2;
mod schema;
mod tables;
mod views;

use crate::core::CoreClient;
use crate::error::InternalError;
use crate::map::redis_utils::RedisClient;
use crate::models::{Create, Delete, Infra};
use crate::schema::electrical_profiles::ElectricalProfileSetData;
use crate::schema::RailJson;
use crate::views::infra::InfraForm;
use crate::views::OpenApiRoot;
use actix_cors::Cors;
use actix_web::dev::{Service, ServiceRequest};
use actix_web::middleware::{Condition, Logger, NormalizePath};
use actix_web::web::{scope, Data, JsonConfig, PayloadConfig};
use actix_web::{App, HttpServer};
use chashmap::CHashMap;
use clap::Parser;
use client::{
    ClearArgs, Client, Color, Commands, DeleteProfileSetArgs, ElectricalProfilesCommands,
    GenerateArgs, ImportProfileSetArgs, ImportRailjsonArgs, ImportRollingStockArgs, InfraCloneArgs,
    InfraCommands, ListProfileSetArgs, MakeMigrationArgs, RedisConfig, RefreshArgs, RunserverArgs,
    SearchCommands,
};
use colored::*;
use diesel::{sql_query, ConnectionError, ConnectionResult};
use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::pooled_connection::{
    AsyncDieselConnectionManager as ConnectionManager, ManagerConfig,
};
use diesel_async::AsyncPgConnection as PgConnection;
use diesel_async::{AsyncPgConnection, RunQueryDsl};
use diesel_json::Json as DieselJson;
use futures_util::future::BoxFuture;
use futures_util::FutureExt;
use infra_cache::InfraCache;
use log::{error, info, warn};
use map::MapLayers;
use models::electrical_profiles::ElectricalProfileSet;
use models::infra::InfraError;
use models::{Retrieve, RollingStockModel};
use openssl::ssl::{SslConnector, SslMethod, SslVerifyMode};
use sentry::ClientInitGuard;
use std::error::Error;
use std::fs::File;
use std::io::{BufReader, IsTerminal};
use std::process::exit;
use std::{env, fs};
use thiserror::Error;
use url::Url;
use validator::{Validate, ValidationErrorsKind};
use views::infra::InfraApiError;
use views::search::{SearchConfig, SearchConfigFinder, SearchConfigStore};

type DbPool = Pool<PgConnection>;

#[actix_web::main]
async fn main() {
    // Set the default log level to 'info'
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

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
    let pg_config = client.postgres_config;
    let create_db_pool = || {
        Ok::<_, Box<dyn Error + Send + Sync>>(Data::new(get_pool(
            pg_config.url()?,
            pg_config.pool_size,
        )))
    };

    let redis_config = client.redis_config;

    match client.color {
        Color::Never => colored::control::set_override(false),
        Color::Always => colored::control::set_override(true),
        Color::Auto => colored::control::set_override(std::io::stderr().is_terminal()),
    }

    match client.command {
        Commands::Runserver(args) => runserver(args, create_db_pool()?, redis_config).await,
        Commands::ImportRollingStock(args) => import_rolling_stock(args, create_db_pool()?).await,
        Commands::OsmToRailjson(args) => {
            converters::osm_to_railjson(args.osm_pbf_in, args.railjson_out)
        }
        Commands::Openapi => {
            generate_openapi();
            Ok(())
        }
        Commands::ElectricalProfiles(subcommand) => match subcommand {
            ElectricalProfilesCommands::Import(args) => {
                electrical_profile_set_import(args, create_db_pool()?).await
            }
            ElectricalProfilesCommands::List(args) => {
                electrical_profile_set_list(args, create_db_pool()?).await
            }
            ElectricalProfilesCommands::Delete(args) => {
                electrical_profile_set_delete(args, create_db_pool()?).await
            }
        },
        Commands::Search(subcommand) => match subcommand {
            SearchCommands::List => {
                list_search_objects();
                Ok(())
            }
            SearchCommands::MakeMigration(args) => make_search_migration(args),
            SearchCommands::Refresh(args) => refresh_search_tables(args, create_db_pool()?).await,
        },
        Commands::Infra(subcommand) => match subcommand {
            InfraCommands::Clone(args) => clone_infra(args, create_db_pool()?).await,
            InfraCommands::Clear(args) => clear_infra(args, create_db_pool()?, redis_config).await,
            InfraCommands::Generate(args) => {
                generate_infra(args, create_db_pool()?, redis_config).await
            }
            InfraCommands::ImportRailjson(args) => import_railjson(args, create_db_pool()?).await,
        },
    }
}

fn init_sentry(args: &RunserverArgs) -> Option<ClientInitGuard> {
    match (args.sentry_dsn.clone(), args.sentry_env.clone()) {
        (Some(sentry_dsn), Some(sentry_env)) => Some(sentry::init((
            sentry_dsn,
            sentry::ClientOptions {
                release: match env::var("OSRD_GIT_DESCRIBE").ok() {
                    Some(release) => Some(release.into()),
                    None => sentry::release_name!(),
                },
                environment: Some(sentry_env.into()),
                ..Default::default()
            },
        ))),
        (None, Some(_)) => {
            warn!("SENTRY_DSN must be set to send events to Sentry.");
            None
        }
        (Some(_), None) => {
            warn!("SENTRY_ENV must be set to send events to Sentry.");
            None
        }
        _ => None,
    }
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

fn establish_connection(config: &str) -> BoxFuture<ConnectionResult<AsyncPgConnection>> {
    let fut = async {
        let mut connector_builder = SslConnector::builder(SslMethod::tls()).unwrap();
        connector_builder.set_verify(SslVerifyMode::NONE);
        let tls = postgres_openssl::MakeTlsConnector::new(connector_builder.build());
        let (client, conn) = tokio_postgres::connect(config, tls)
            .await
            .map_err(|e| ConnectionError::BadConnection(e.to_string()))?;
        // The connection object performs the actual communication with the database,
        // so spawn it off to run on its own.
        tokio::spawn(async move {
            if let Err(e) = conn.await {
                error!("connection error: {}", e);
            }
        });
        AsyncPgConnection::try_from(client).await
    };
    fut.boxed()
}

fn get_pool(url: Url, max_size: usize) -> DbPool {
    let mut manager_config = ManagerConfig::default();
    manager_config.custom_setup = Box::new(establish_connection);
    let manager = ConnectionManager::new_with_config(url, manager_config);
    Pool::builder(manager)
        .max_size(max_size)
        .build()
        .expect("Failed to create pool.")
}

/// Create and run the server
async fn runserver(
    args: RunserverArgs,
    db_pool: Data<DbPool>,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    info!("Building server...");
    // Config database
    let redis = RedisClient::new(redis_config)?;

    // Custom Json extractor configuration
    let json_cfg = JsonConfig::default()
        .limit(250 * 1024 * 1024) // 250MiB
        .error_handler(|err, _| InternalError::from(err).into());

    // Custom Bytes and String extractor configuration
    let payload_config = PayloadConfig::new(64 * 1024 * 1024); // 64MiB

    // Setup shared states
    let infra_caches = Data::new(CHashMap::<i64, InfraCache>::default());

    // Setup sentry
    let _guard = init_sentry(&args);
    let is_sentry_initialized = _guard.is_some();

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
            .wrap(Condition::new(
                is_sentry_initialized,
                sentry_actix::Sentry::new(),
            ))
            .wrap(cors)
            .wrap(NormalizePath::trim())
            .wrap_fn(|req, srv| {
                log_received_request(&req);
                srv.call(req)
            })
            .wrap(Logger::new(actix_logger_format).log_target("actix_logger"))
            .app_data(json_cfg.clone())
            .app_data(payload_config.clone())
            .app_data(db_pool.clone())
            .app_data(Data::new(redis.clone()))
            .app_data(infra_caches.clone())
            .app_data(Data::new(MapLayers::parse()))
            .app_data(Data::new(args.map_layers_config.clone()))
            .app_data(Data::new(core_client))
            .service(scope(&args.root_path).service(views::routes()))
    });

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

/// Run the generate sub command
/// This command refresh all infra given as input (if no infra given then refresh all of them)
async fn generate_infra(
    args: GenerateArgs,
    db_pool: Data<DbPool>,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut conn = db_pool.get().await?;
    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::all(&mut conn).await {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        for id in args.infra_ids {
            match Infra::retrieve(db_pool.clone(), id as i64).await? {
                Some(infra) => infras.push(infra),
                None => {
                    let error = CliError::new(1, format!("❌ Infrastructure not found, ID: {id}"));
                    return Err(Box::new(error));
                }
            };
        }
    };

    // Refresh each infras
    for infra in infras {
        println!(
            "🍞 Infra {}[{}] is generating:",
            infra.name.clone().unwrap().bold(),
            infra.id.unwrap()
        );
        let infra_cache = InfraCache::load(&mut conn, &infra).await?;
        if infra
            .refresh(db_pool.clone(), args.force, &infra_cache)
            .await?
        {
            build_redis_pool_and_invalidate_all_cache(redis_config.clone(), infra.id.unwrap())
                .await?;
            println!(
                "✅ Infra {}[{}] generated!",
                infra.name.unwrap().bold(),
                infra.id.unwrap()
            );
        } else {
            println!(
                "✅ Infra {}[{}] already generated!",
                infra.name.unwrap().bold(),
                infra.id.unwrap()
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
    db_pool: Data<DbPool>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    for rolling_stock_path in args.rolling_stock_path {
        let rolling_stock_file = File::open(rolling_stock_path)?;
        let mut rolling_stock: RollingStockModel =
            serde_json::from_reader(BufReader::new(rolling_stock_file))?;
        match rolling_stock.validate() {
            Ok(()) => {
                println!(
                    "🍞 Importing rolling stock {}",
                    rolling_stock.name.clone().unwrap().bold()
                );
                rolling_stock.locked = Some(false);
                rolling_stock.version = Some(0);
                let rolling_stock = rolling_stock.create(db_pool.clone()).await?;
                println!(
                    "✅ Rolling stock {}[{}] saved!",
                    rolling_stock.name.clone().unwrap().bold(),
                    rolling_stock.id.unwrap()
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
    db_pool: Data<DbPool>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    match Infra::clone(infra_args.id as i64, db_pool, infra_args.new_name).await {
        Ok(cloned_infra) => println!(
            "✅ Infra {} (ID: {}) was successfully cloned",
            cloned_infra.name.unwrap(),
            cloned_infra.id.unwrap()
        ),
        Err(e) => {
            if e == InfraError::NotFound(infra_args.id as i64).into() {
                let error = CliError::new(
                    1,
                    format!("❌ Infrastructure not found, ID: {}", infra_args.id),
                );
                return Err(Box::new(error));
            }
            return Err(e.message.into());
        }
    }
    Ok(())
}

async fn import_railjson(
    args: ImportRailjsonArgs,
    db_pool: Data<DbPool>,
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

    let infra: Infra = InfraForm {
        name: args.infra_name,
    }
    .into();
    let railjson: RailJson = serde_json::from_reader(BufReader::new(railjson_file))?;

    println!("🍞 Importing infra {}", infra.name.clone().unwrap().bold());
    let infra = infra.persist(railjson, db_pool.clone()).await?;
    let infra_id = infra.id.unwrap();

    let mut conn = db_pool.get().await?;
    let infra = infra
        .bump_version(&mut conn)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;

    println!(
        "✅ Infra {}[{}] saved!",
        infra.name.clone().unwrap().bold(),
        infra.id.unwrap()
    );
    // Generate only if the was set
    if args.generate {
        let infra_cache = InfraCache::load(&mut conn, &infra).await?;
        infra.refresh(db_pool, true, &infra_cache).await?;
        println!(
            "✅ Infra {}[{}] generated data refreshed!",
            infra.name.unwrap().bold(),
            infra.id.unwrap()
        );
    };
    Ok(())
}

async fn electrical_profile_set_import(
    args: ImportProfileSetArgs,
    db_pool: Data<DbPool>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let electrical_profile_set_file = File::open(args.electrical_profile_set_path)?;

    let electrical_profile_set_data: ElectricalProfileSetData =
        serde_json::from_reader(BufReader::new(electrical_profile_set_file))?;
    let ep_set = ElectricalProfileSet {
        id: None,
        name: Some(args.name),
        data: Some(DieselJson(electrical_profile_set_data)),
    };

    let mut conn = db_pool.get().await?;
    let created_ep_set = ep_set.create_conn(&mut conn).await.unwrap();
    let ep_set_id = created_ep_set.id.unwrap();
    println!("✅ Electrical profile set {ep_set_id} created");
    Ok(())
}

async fn electrical_profile_set_list(
    args: ListProfileSetArgs,
    db_pool: Data<DbPool>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut conn = db_pool.get().await?;
    let electrical_profile_sets = ElectricalProfileSet::list_light(&mut conn).await.unwrap();
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
    db_pool: Data<DbPool>,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    for profile_set_id in args.profile_set_ids {
        let deleted = ElectricalProfileSet::delete(db_pool.clone(), profile_set_id)
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
    db_pool: Data<DbPool>,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut conn = db_pool.get().await?;
    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::all(&mut conn).await {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        for id in args.infra_ids {
            match Infra::retrieve(db_pool.clone(), id as i64).await? {
                Some(infra) => infras.push(infra),
                None => {
                    let error = CliError::new(1, format!("❌ Infrastructure not found, ID: {id}"));
                    return Err(Box::new(error));
                }
            };
        }
    };

    for infra in infras {
        println!(
            "🍞 Infra {}[{}] is clearing:",
            infra.name.clone().unwrap().bold(),
            infra.id.unwrap()
        );
        build_redis_pool_and_invalidate_all_cache(redis_config.clone(), infra.id.unwrap()).await?;
        infra.clear(&mut conn).await?;
        println!(
            "✅ Infra {}[{}] cleared!",
            infra.name.unwrap().bold(),
            infra.id.unwrap()
        );
    }
    Ok(())
}

/// Prints the OpenApi to stdout
fn generate_openapi() {
    let openapi = OpenApiRoot::build_openapi();
    println!("{}", serde_yaml::to_string(&openapi).unwrap());
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
    if let Err(err) = fs::write(down_path, down) {
        let error = format!("❌ Failed to write to {down_path_str}: {err}");
        return Err(Box::new(CliError::new(2, error)));
    }
    println!("➡️  Wrote to {down_path_str}");
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
    db_pool: Data<DbPool>,
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

    let mut conn = db_pool.get().await?;
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
            .execute(&mut conn)
            .await?;
        println!("♻️  Regenerating {}", search_config.table);
        sql_query(search_config.refresh_table_sql())
            .execute(&mut conn)
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

    use crate::fixtures::tests::{
        db_pool, electrical_profile_set, get_fast_rolling_stock, TestFixture,
    };
    use diesel::sql_query;
    use diesel::sql_types::Text;
    use diesel_async::RunQueryDsl;
    use rand::distributions::Alphanumeric;
    use rand::{thread_rng, Rng};
    use rstest::rstest;
    use serde::Serialize;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[rstest]
    async fn import_rolling_stock_ko_file_not_found(db_pool: Data<DbPool>) {
        // GIVEN
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec!["non/existing/railjson/file/location".into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool).await;

        // THEN
        assert!(result.is_err())
    }

    #[rstest]
    async fn import_non_electric_rs_without_startup_and_panto_values(db_pool: Data<DbPool>) {
        // GIVEN
        let rolling_stock_name =
            "fast_rolling_stock_import_non_electric_rs_without_startup_and_panto_values";
        let mut non_electric_rolling_stock = get_fast_rolling_stock(rolling_stock_name);
        if let Some(ref mut effort_curves) = non_electric_rolling_stock.effort_curves {
            effort_curves.modes.remove("25000V");
            non_electric_rolling_stock.electrical_power_startup_time = Some(None);
            non_electric_rolling_stock.raise_pantograph_time = Some(None);
        }
        let file = generate_temp_file(&non_electric_rolling_stock);
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone()).await;

        // THEN
        // import should not fail, as raise_panto and startup are not required for non electric
        assert!(result.is_ok());
        let mut conn = db_pool.get().await.unwrap();
        let created_rs =
            RollingStockModel::retrieve_by_name(&mut conn, rolling_stock_name.to_string())
                .await
                .unwrap();
        assert!(created_rs.is_some());
        TestFixture::new(created_rs.unwrap(), db_pool.clone());
    }

    #[rstest]
    async fn import_non_electric_rs_with_startup_and_panto_values(db_pool: Data<DbPool>) {
        // GIVEN
        let rolling_stock_name =
            "fast_rolling_stock_import_non_electric_rs_with_startup_and_panto_values";
        let mut non_electric_rolling_stock = get_fast_rolling_stock(rolling_stock_name);
        if let Some(ref mut effort_curves) = non_electric_rolling_stock.effort_curves {
            effort_curves.modes.remove("25000V");
        }
        let file = generate_temp_file(&non_electric_rolling_stock);
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone()).await;

        // THEN
        assert!(result.is_ok());
        let mut conn = db_pool.get().await.unwrap();
        let created_rs =
            RollingStockModel::retrieve_by_name(&mut conn, rolling_stock_name.to_string())
                .await
                .unwrap();
        assert!(created_rs.is_some());
        let rs_fixture = TestFixture::new(created_rs.unwrap(), db_pool.clone());
        let RollingStockModel {
            electrical_power_startup_time,
            raise_pantograph_time,
            ..
        } = rs_fixture.model;
        assert!(electrical_power_startup_time.unwrap().is_some());
        assert!(raise_pantograph_time.unwrap().is_some());
    }

    #[rstest]
    async fn import_electric_rs_without_startup_and_panto_values(db_pool: Data<DbPool>) {
        // GIVEN
        let rolling_stock_name =
            "fast_rolling_stock_import_electric_rs_without_startup_and_panto_values";
        let mut electric_rolling_stock = get_fast_rolling_stock(rolling_stock_name);
        electric_rolling_stock.electrical_power_startup_time = Some(None);
        electric_rolling_stock.raise_pantograph_time = Some(None);
        let file = generate_temp_file(&electric_rolling_stock.clone());
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone()).await;

        // THEN
        // it should just fail to import
        assert!(result.is_err());
        let mut conn = db_pool.get().await.unwrap();
        let created_rs =
            RollingStockModel::retrieve_by_name(&mut conn, rolling_stock_name.to_string())
                .await
                .unwrap();
        assert!(created_rs.is_none());
    }

    #[rstest]
    async fn import_electric_rs_with_startup_and_panto_values(db_pool: Data<DbPool>) {
        // GIVEN
        let rolling_stock_name =
            "fast_rolling_stock_import_electric_rs_with_startup_and_panto_values";
        let electric_rolling_stock = get_fast_rolling_stock(rolling_stock_name);
        let file = generate_temp_file(&electric_rolling_stock);
        let args = ImportRollingStockArgs {
            rolling_stock_path: vec![file.path().into()],
        };

        // WHEN
        let result = import_rolling_stock(args, db_pool.clone()).await;

        // THEN
        // import should succeed, and rolling stock should have the correct values in DB
        assert!(result.is_ok());
        let mut conn = db_pool.get().await.unwrap();
        let created_rs =
            RollingStockModel::retrieve_by_name(&mut conn, rolling_stock_name.to_string())
                .await
                .unwrap();
        assert!(created_rs.is_some());
        let rs_fixture = TestFixture::new(created_rs.unwrap(), db_pool.clone());
        let RollingStockModel {
            electrical_power_startup_time,
            raise_pantograph_time,
            ..
        } = rs_fixture.model;
        assert_eq!(
            electrical_power_startup_time,
            rs_fixture.model.electrical_power_startup_time
        );
        assert_eq!(
            raise_pantograph_time,
            rs_fixture.model.raise_pantograph_time
        );
    }

    #[rstest]
    async fn import_railjson_ko_file_not_found(db_pool: Data<DbPool>) {
        // GIVEN
        let railjson_path = "non/existing/railjson/file/location";
        let args: ImportRailjsonArgs = ImportRailjsonArgs {
            infra_name: "test".into(),
            railjson_path: railjson_path.into(),
            generate: false,
        };

        // WHEN
        let result = import_railjson(args.clone(), db_pool).await;

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
    async fn import_railjson_ok(db_pool: Data<DbPool>) {
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
        let result = import_railjson(args, db_pool.clone()).await;

        // THEN
        assert!(result.is_ok());

        // CLEANUP
        let mut conn = db_pool.get().await.unwrap();
        sql_query("DELETE FROM infra WHERE name = $1")
            .bind::<Text, _>(infra_name)
            .execute(&mut conn)
            .await
            .unwrap();
    }

    fn generate_temp_file<T: Serialize>(object: &T) -> NamedTempFile {
        let mut tmp_file = NamedTempFile::new().unwrap();
        write!(tmp_file, "{}", serde_json::to_string(object).unwrap()).unwrap();
        tmp_file
    }

    #[rstest]
    async fn test_electrical_profile_set_delete(
        #[future] electrical_profile_set: TestFixture<ElectricalProfileSet>,
        db_pool: Data<DbPool>,
    ) {
        // GIVEN
        let electrical_profile_set = electrical_profile_set.await;

        let args = DeleteProfileSetArgs {
            profile_set_ids: vec![electrical_profile_set.id()],
        };

        // WHEN
        electrical_profile_set_delete(args, db_pool.clone())
            .await
            .unwrap();

        // THEN
        let mut conn = db_pool.get().await.unwrap();
        let empty = !ElectricalProfileSet::list_light(&mut conn)
            .await
            .unwrap()
            .iter()
            .any(|eps| eps.id == electrical_profile_set.id());
        assert!(empty);
    }

    #[rstest]
    async fn test_electrical_profile_set_list_doesnt_fail(
        #[future] electrical_profile_set: TestFixture<ElectricalProfileSet>,
        db_pool: Data<DbPool>,
    ) {
        let _electrical_profile_set = electrical_profile_set.await;
        for quiet in [true, false] {
            let args = ListProfileSetArgs { quiet };
            electrical_profile_set_list(args, db_pool.clone())
                .await
                .unwrap();
        }
    }
}
