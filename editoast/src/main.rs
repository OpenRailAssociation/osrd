#[macro_use]
extern crate diesel;

mod client;
mod documents;
mod error;
mod generated_data;
mod infra;
mod infra_cache;
mod map;
mod projects;
mod schema;
mod tables;
mod views;

use crate::schema::electrical_profiles::ElectricalProfileSetData;
use crate::schema::RailJson;
use actix_cors::Cors;
use actix_web::middleware::{Condition, Logger, NormalizePath};
use actix_web::web::{Data, JsonConfig};
use actix_web::{App, HttpServer};
use chashmap::CHashMap;
use clap::Parser;
use client::{
    ClearArgs, Client, Commands, GenerateArgs, ImportProfileSetArgs, ImportRailjsonArgs,
    PostgresConfig, RedisConfig, RunserverArgs,
};
use colored::*;
use diesel::r2d2::{self, ConnectionManager, Pool};
use diesel::{Connection, PgConnection};
use infra::Infra;
use infra_cache::InfraCache;
use map::MapLayers;
use sentry::ClientInitGuard;
use std::env;
use std::error::Error;
use std::fs::File;
use std::io::BufReader;
use std::process::exit;
use views::electrical_profiles::ElectricalProfileSet;
use views::search::config::Config as SearchConfig;

type DbPool = r2d2::Pool<ConnectionManager<PgConnection>>;

#[actix_web::main]
async fn main() {
    match run().await {
        Ok(_) => (),
        Err(e) => {
            eprintln!("{e}");
            exit(2);
        }
    }
}

async fn run() -> Result<(), Box<dyn Error + Send + Sync>> {
    let client = Client::parse();
    let pg_config = client.postgres_config;
    let redis_config = client.redis_config;

    match client.command {
        Commands::Runserver(args) => runserver(args, pg_config, redis_config).await,
        Commands::Generate(args) => generate(args, pg_config, redis_config).await,
        Commands::Clear(args) => clear(args, pg_config, redis_config).await,
        Commands::ImportRailjson(args) => import_railjson(args, pg_config),
        Commands::ImportProfileSet(args) => add_electrical_profile_set(args, pg_config).await,
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
            println!("SENTRY_DSN must be set to send events to Sentry.");
            None
        }
        (Some(_), None) => {
            println!("SENTRY_ENV must be set to send events to Sentry.");
            None
        }
        _ => None,
    }
}

/// Create and run the server
async fn runserver(
    args: RunserverArgs,
    pg_config: PostgresConfig,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    println!("Building server...");
    // Config databases
    let manager = ConnectionManager::<PgConnection>::new(pg_config.url());
    let pool = Pool::builder()
        .max_size(pg_config.pool_size)
        .build(manager)
        .expect("Failed to create pool.");
    let redis = redis::Client::open(redis_config.redis_url.clone()).unwrap();

    // Custom Json extractor configuration
    let json_cfg = JsonConfig::default()
        .limit(250 * 1024 * 1024) // 250MB
        .error_handler(|err, _| err.into());

    // Set the default log level to 'info'
    env_logger::init_from_env(env_logger::Env::new().default_filter_or("info"));

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

        App::new()
            .wrap(Condition::new(
                is_sentry_initialized,
                sentry_actix::Sentry::new(),
            ))
            .wrap(cors)
            .wrap(NormalizePath::trim())
            .wrap(Logger::default())
            .app_data(json_cfg.clone())
            .app_data(Data::new(pool.clone()))
            .app_data(Data::new(redis.clone()))
            .app_data(infra_caches.clone())
            .app_data(Data::new(MapLayers::parse()))
            .app_data(Data::new(args.map_layers_config.clone()))
            .app_data(Data::new(SearchConfig::parse()))
            .service(views::routes())
    });

    // Run server
    println!("Running server...");
    server
        .bind((args.address.clone(), args.port))?
        .run()
        .await?;
    Ok(())
}

async fn build_redis_pool_and_invalidate_all_cache(redis_url: &str, infra_id: i64) {
    let redis = redis::Client::open(redis_url).unwrap();
    let mut conn = redis.get_tokio_connection_manager().await.unwrap();
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
    let mut conn = PgConnection::establish(&pg_config.url()).expect("Error while connecting DB");

    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::list(&mut conn) {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        for id in args.infra_ids {
            infras.push(Infra::retrieve(&mut conn, id as i64)?);
        }
    };

    // Refresh each infras
    for infra in infras {
        println!(
            "🍞 Infra {}[{}] is generating:",
            infra.name.bold(),
            infra.id
        );
        let infra_cache = InfraCache::load(&mut conn, &infra)?;
        if infra.refresh(&mut conn, args.force, &infra_cache)? {
            build_redis_pool_and_invalidate_all_cache(&redis_config.redis_url, infra.id).await;
            println!("✅ Infra {}[{}] generated!", infra.name.bold(), infra.id);
        } else {
            println!(
                "✅ Infra {}[{}] already generated!",
                infra.name.bold(),
                infra.id
            );
        }
    }
    Ok(())
}

fn import_railjson(
    args: ImportRailjsonArgs,
    pg_config: PostgresConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let railjson_file = File::open(args.railjson_path)?;
    let conn = &mut PgConnection::establish(&pg_config.url()).expect("Error while connecting DB");

    let railjson: RailJson = serde_json::from_reader(BufReader::new(railjson_file))?;

    let infra = railjson.persist(args.infra_name, conn)?;
    let infra = infra.bump_version(conn)?;

    println!("✅ Infra {}[{}] saved!", infra.name.bold(), infra.id);
    // Generate only if the was set
    if args.generate {
        let infra_cache = InfraCache::load(conn, &infra)?;
        infra.refresh(conn, true, &infra_cache)?;
        println!(
            "✅ Infra {}[{}] generated data refreshed!",
            infra.name.bold(),
            infra.id
        );
    }

    Ok(())
}

async fn add_electrical_profile_set(
    args: ImportProfileSetArgs,
    pg_config: PostgresConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let manager = ConnectionManager::<PgConnection>::new(pg_config.url());
    let pool = Data::new(Pool::builder().max_size(1).build(manager).unwrap());
    let electrical_profile_set_file = File::open(args.electrical_profile_set_path)?;

    let electrical_profile_set_data: ElectricalProfileSetData =
        serde_json::from_reader(BufReader::new(electrical_profile_set_file))?;

    let created_ep_set = ElectricalProfileSet::create_electrical_profile_set(
        pool,
        args.name,
        electrical_profile_set_data,
    )
    .await
    .unwrap();
    println!("✅ Electrical profile set {} created", created_ep_set.id);

    Ok(())
}

/// Run the clear subcommand
/// This command clear all generated data for the given infra
async fn clear(
    args: ClearArgs,
    pg_config: PostgresConfig,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let mut conn = PgConnection::establish(&pg_config.url()).expect("Error while connecting DB");
    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::list(&mut conn) {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        for id in args.infra_ids {
            infras.push(Infra::retrieve(&mut conn, id as i64)?);
        }
    };

    for infra in infras {
        println!("🍞 Infra {}[{}] is clearing:", infra.name.bold(), infra.id);
        build_redis_pool_and_invalidate_all_cache(&redis_config.redis_url, infra.id).await;
        infra.clear(&mut conn)?;
        println!("✅ Infra {}[{}] cleared!", infra.name.bold(), infra.id);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::client::{ImportRailjsonArgs, PostgresConfig};

    use crate::import_railjson;
    use crate::schema::RailJson;
    use diesel::result::Error;
    use diesel::sql_types::Text;
    use diesel::{sql_query, Connection, PgConnection, RunQueryDsl};
    use rand::distributions::Alphanumeric;
    use rand::{thread_rng, Rng};
    use std::io::Write;
    use tempfile::NamedTempFile;

    pub fn test_transaction(fn_test: fn(&mut PgConnection)) {
        let mut conn = PgConnection::establish(&PostgresConfig::default().url()).unwrap();
        conn.test_transaction::<_, Error, _>(|conn| {
            fn_test(conn);
            Ok(())
        });
    }

    #[test]
    fn import_railjson_ko_file_not_found() {
        // GIVEN
        let pg_config = Default::default();
        let args: ImportRailjsonArgs = ImportRailjsonArgs {
            infra_name: "test".into(),
            railjson_path: "non/existing/railjson/file/location".into(),
            generate: false,
        };

        // WHEN
        let result = import_railjson(args, pg_config);

        // THEN
        assert!(result.is_err())
    }

    #[test]
    fn import_railjson_ok() {
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
        let result = import_railjson(args, pg_config.clone());

        // THEN
        assert!(result.is_ok());

        // CLEANUP
        let mut conn =
            PgConnection::establish(&pg_config.url()).expect("Error while connecting DB");
        sql_query("DELETE FROM osrd_infra_infra WHERE name = $1")
            .bind::<Text, _>(infra_name)
            .execute(&mut conn)
            .unwrap();
    }

    fn generate_railjson_temp_file(railjson: &RailJson) -> NamedTempFile {
        let mut tmp_file = NamedTempFile::new().unwrap();
        write!(tmp_file, "{}", serde_json::to_string(railjson).unwrap()).unwrap();
        tmp_file
    }
}
