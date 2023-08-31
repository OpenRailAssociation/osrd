#![feature(concat_idents)]

#[macro_use]
extern crate diesel;

mod client;
mod converters;
mod core;
mod error;
mod fixtures;
mod generated_data;
mod infra_cache;
mod map;
mod models;
mod schema;
mod tables;
mod views;

use crate::core::CoreClient;
use crate::error::InternalError;
use crate::map::redis_utils::RedisClient;
use crate::models::{Create, Infra};
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
    ClearArgs, Client, Color, Commands, GenerateArgs, ImportProfileSetArgs, ImportRailjsonArgs,
    ImportRollingStockArgs, PostgresConfig, RedisConfig, RunserverArgs,
};
use colored::*;
use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::pooled_connection::AsyncDieselConnectionManager as ConnectionManager;
use diesel_async::{AsyncConnection, AsyncPgConnection as PgConnection};
use diesel_json::Json as DieselJson;
use infra_cache::InfraCache;
use log::{error, info, warn};
use map::MapLayers;
use models::electrical_profile::ElectricalProfileSet;
use models::{Retrieve, RollingStockModel};
use sentry::ClientInitGuard;
use std::env;
use std::error::Error;
use std::fs::File;
use std::io::BufReader;
use std::process::exit;
use views::infra::InfraApiError;

type DbPool = Pool<PgConnection>;

#[actix_web::main]
async fn main() {
    // Set the default log level to 'info'
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

    match run().await {
        Ok(_) => (),
        Err(e) => {
            error!("{e}");
            exit(2);
        }
    }
}

async fn run() -> Result<(), Box<dyn Error + Send + Sync>> {
    let client = Client::parse();
    let pg_config = client.postgres_config;
    let redis_config = client.redis_config;

    match client.color {
        Color::Never => colored::control::set_override(false),
        Color::Always => colored::control::set_override(true),
        Color::Auto => colored::control::set_override(atty::is(atty::Stream::Stderr)),
    }

    match client.command {
        Commands::Runserver(args) => runserver(args, pg_config, redis_config).await,
        Commands::Generate(args) => generate(args, pg_config, redis_config).await,
        Commands::Clear(args) => clear(args, pg_config, redis_config).await,
        Commands::ImportRailjson(args) => import_railjson(args, pg_config).await,
        Commands::ImportProfileSet(args) => add_electrical_profile_set(args, pg_config).await,
        Commands::ImportRollingStock(args) => import_rolling_stock(args, pg_config).await,
        Commands::OsmToRailjson(args) => {
            converters::osm_to_railjson(args.osm_pbf_in, args.railjson_out)
        }
        Commands::Openapi => {
            generate_openapi();
            Ok(())
        }
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
    log::info!(target: "actix_logger", "{} RECEIVED", request_line);
}

/// Create and run the server
async fn runserver(
    args: RunserverArgs,
    pg_config: PostgresConfig,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    info!("Building server...");
    // Config databases
    let manager = ConnectionManager::<PgConnection>::new(pg_config.url());
    let pool = Pool::builder(manager)
        .max_size(pg_config.pool_size)
        .build()
        .expect("Failed to create pool.");

    let redis = RedisClient::new(redis_config);

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
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();

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
            .app_data(Data::new(pool.clone()))
            .app_data(Data::new(redis.clone()))
            .app_data(infra_caches.clone())
            .app_data(Data::new(MapLayers::parse()))
            .app_data(Data::new(args.map_layers_config.clone()))
            .app_data(Data::new(core_client))
            .service(
                scope(&args.root_path)
                    .service(views::routes())
                    .service(views::study_routes()),
            )
    });

    // Run server
    info!("Running server...");
    server
        .bind((args.address.clone(), args.port))?
        .run()
        .await?;
    Ok(())
}

async fn build_redis_pool_and_invalidate_all_cache(redis_config: RedisConfig, infra_id: i64) {
    let redis = RedisClient::new(redis_config);
    let mut conn = redis.get_connection().await.unwrap();
    map::invalidate_all(
        &mut conn,
        &MapLayers::parse().layers.keys().cloned().collect(),
        infra_id,
    )
    .await;
}

/// Run the generate sub command
/// This command refresh all infra given as input (if no infra given then refresh all of them)
async fn generate(
    args: GenerateArgs,
    pg_config: PostgresConfig,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut conn = PgConnection::establish(&pg_config.url()).await?;
    let manager = ConnectionManager::<PgConnection>::new(pg_config.url());
    let pool = Data::new(
        Pool::builder(manager)
            .max_size(pg_config.pool_size)
            .build()
            .expect("Failed to create pool."),
    );
    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::all(&mut conn).await {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        for id in args.infra_ids {
            let infra = match Infra::retrieve(pool.clone(), id as i64).await? {
                Some(infra) => infra,
                None => {
                    return Err(InfraApiError::NotFound {
                        infra_id: id as i64,
                    }
                    .into())
                }
            };
            infras.push(infra);
        }
    };

    // Refresh each infras
    for infra in infras {
        info!(
            "🍞 Infra {}[{}] is generating:",
            infra.name.clone().unwrap().bold(),
            infra.id.unwrap()
        );
        let infra_cache = InfraCache::load(&mut conn, &infra).await?;
        if infra
            .refresh(pool.clone(), args.force, &infra_cache)
            .await?
        {
            build_redis_pool_and_invalidate_all_cache(redis_config.clone(), infra.id.unwrap())
                .await;
            info!(
                "✅ Infra {}[{}] generated!",
                infra.name.unwrap().bold(),
                infra.id.unwrap()
            );
        } else {
            info!(
                "✅ Infra {}[{}] already generated!",
                infra.name.unwrap().bold(),
                infra.id.unwrap()
            );
        }
    }
    Ok(())
}

async fn import_rolling_stock(
    args: ImportRollingStockArgs,
    pg_config: PostgresConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let manager = ConnectionManager::<PgConnection>::new(pg_config.url());
    let pool = Data::new(Pool::builder(manager).build().unwrap());
    for rolling_stock_path in args.rolling_stock_path {
        let rolling_stock_file = File::open(rolling_stock_path)?;
        let mut rolling_stock: RollingStockModel =
            serde_json::from_reader(BufReader::new(rolling_stock_file))?;
        info!(
            "🍞 Importing rolling stock {}",
            rolling_stock.name.clone().unwrap().bold()
        );
        rolling_stock.locked = Some(false);
        rolling_stock.version = Some(0);
        let rolling_stock = rolling_stock.create(pool.clone()).await?;
        info!(
            "✅ Rolling stock {}[{}] saved!",
            rolling_stock.name.clone().unwrap().bold(),
            rolling_stock.id.unwrap()
        );
    }
    Ok(())
}

async fn import_railjson(
    args: ImportRailjsonArgs,
    pg_config: PostgresConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let railjson_file = File::open(args.railjson_path)?;
    let manager = ConnectionManager::<PgConnection>::new(pg_config.url());
    let pool = Data::new(Pool::builder(manager).build().unwrap());

    let infra: Infra = InfraForm {
        name: args.infra_name,
    }
    .into();
    let railjson: RailJson = serde_json::from_reader(BufReader::new(railjson_file))?;

    info!("🍞 Importing infra {}", infra.name.clone().unwrap().bold());
    let infra = infra.persist(railjson, pool.clone()).await?;
    let infra_id = infra.id.unwrap();

    let mut conn = pool.get().await?;
    let infra = infra
        .bump_version(&mut conn)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;

    info!(
        "✅ Infra {}[{}] saved!",
        infra.name.clone().unwrap().bold(),
        infra.id.unwrap()
    );
    // Generate only if the was set
    if args.generate {
        let infra_cache = InfraCache::load(&mut conn, &infra).await?;
        infra.refresh(pool, true, &infra_cache).await?;
        info!(
            "✅ Infra {}[{}] generated data refreshed!",
            infra.name.unwrap().bold(),
            infra.id.unwrap()
        );
    };
    Ok(())
}

async fn add_electrical_profile_set(
    args: ImportProfileSetArgs,
    pg_config: PostgresConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let manager = ConnectionManager::<PgConnection>::new(pg_config.url());
    let pool = Data::new(Pool::builder(manager).max_size(1).build().unwrap());
    let electrical_profile_set_file = File::open(args.electrical_profile_set_path)?;

    let electrical_profile_set_data: ElectricalProfileSetData =
        serde_json::from_reader(BufReader::new(electrical_profile_set_file))?;
    let ep_set = ElectricalProfileSet {
        id: None,
        name: Some(args.name),
        data: Some(DieselJson(electrical_profile_set_data)),
    };

    let created_ep_set = ep_set.create(pool).await.unwrap();
    let ep_set_id = created_ep_set.id.unwrap();
    info!("✅ Electrical profile set {ep_set_id} created");
    Ok(())
}

/// Run the clear subcommand
/// This command clear all generated data for the given infra
async fn clear(
    args: ClearArgs,
    pg_config: PostgresConfig,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut conn = PgConnection::establish(&pg_config.url())
        .await
        .expect("Error while connecting DB");
    let manager = ConnectionManager::<PgConnection>::new(pg_config.url());
    let pool = Data::new(
        Pool::builder(manager)
            .max_size(pg_config.pool_size)
            .build()
            .expect("Failed to create pool."),
    );
    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::all(&mut conn).await {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        for id in args.infra_ids {
            let infra = match Infra::retrieve(pool.clone(), id as i64).await? {
                Some(infra) => infra,
                None => {
                    return Err(InfraApiError::NotFound {
                        infra_id: id as i64,
                    }
                    .into())
                }
            };
            infras.push(infra);
        }
    };

    for infra in infras {
        info!(
            "🍞 Infra {}[{}] is clearing:",
            infra.name.clone().unwrap().bold(),
            infra.id.unwrap()
        );
        build_redis_pool_and_invalidate_all_cache(redis_config.clone(), infra.id.unwrap()).await;
        infra.clear(&mut conn).await?;
        info!(
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

#[cfg(test)]
mod tests {
    use crate::client::{ImportRailjsonArgs, PostgresConfig};

    use crate::import_railjson;
    use crate::schema::RailJson;
    use actix_web::test as actix_test;
    use diesel::sql_query;
    use diesel::sql_types::Text;
    use diesel_async::{
        AsyncConnection as Connection, AsyncPgConnection as PgConnection, RunQueryDsl,
    };
    use rand::distributions::Alphanumeric;
    use rand::{thread_rng, Rng};
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[actix_test]
    async fn import_railjson_ko_file_not_found() {
        // GIVEN
        let pg_config = Default::default();
        let args: ImportRailjsonArgs = ImportRailjsonArgs {
            infra_name: "test".into(),
            railjson_path: "non/existing/railjson/file/location".into(),
            generate: false,
        };

        // WHEN
        let result = import_railjson(args, pg_config).await;

        // THEN
        assert!(result.is_err())
    }

    #[actix_test]
    async fn import_railjson_ok() {
        // GIVEN
        let railjson = Default::default();
        let file = generate_railjson_temp_file(&railjson);
        let pg_config = PostgresConfig::default();
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
        let result = import_railjson(args, pg_config.clone()).await;

        // THEN
        assert!(result.is_ok());

        // CLEANUP
        let mut conn = PgConnection::establish(&pg_config.url())
            .await
            .expect("Error while connecting DB");
        sql_query("DELETE FROM infra WHERE name = $1")
            .bind::<Text, _>(infra_name)
            .execute(&mut conn)
            .await
            .unwrap();
    }

    fn generate_railjson_temp_file(railjson: &RailJson) -> NamedTempFile {
        let mut tmp_file = NamedTempFile::new().unwrap();
        write!(tmp_file, "{}", serde_json::to_string(railjson).unwrap()).unwrap();
        tmp_file
    }
}
