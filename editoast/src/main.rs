#[macro_use]
extern crate rocket;
#[macro_use]
extern crate diesel;

mod api_error;
mod chartos;
mod client;
mod cors;
mod db_connection;
mod generated_data;
mod infra;
mod infra_cache;
mod schema;
mod tables;
mod views;

use chartos::MapLayers;
use chashmap::CHashMap;
use clap::Parser;
use client::{
    ChartosConfig, ClearArgs, Client, Commands, GenerateArgs, ImportRailjsonArgs, PostgresConfig,
    RedisConfig, RunserverArgs,
};
use colored::*;
use db_connection::{DBConnection, RedisPool};
use diesel::{Connection, PgConnection};
use infra::Infra;
use infra_cache::InfraCache;
use rocket::{Build, Config, Rocket};
use rocket_db_pools::Database;
use std::error::Error;
use std::fs::File;
use std::io::BufReader;
use std::process::exit;
use std::sync::Arc;

use crate::schema::RailJson;

#[rocket::main]
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
    let chartos_config = client.chartos_config;
    let pg_config = client.postgres_config;
    let redis_config = client.redis_config;

    match client.command {
        Commands::Runserver(args) => runserver(args, pg_config, chartos_config, redis_config).await,
        Commands::Generate(args) => generate(args, pg_config, chartos_config).await,
        Commands::Clear(args) => clear(args, pg_config),
        Commands::ImportRailjson(args) => import_railjson(args, pg_config),
    }
}

/// Create a rocket server given the config
pub fn create_server(
    runserver_config: &RunserverArgs,
    pg_config: &PostgresConfig,
    chartos_config: ChartosConfig,
    redis_config: &RedisConfig,
) -> Rocket<Build> {
    // Config server
    let mut config = Config::figment()
        .merge(("port", runserver_config.port))
        .merge(("address", runserver_config.address.clone()))
        .merge(("databases.postgres.url", pg_config.url()))
        .merge(("databases.postgres.pool_size", pg_config.pool_size))
        .merge(("databases.postgres.timeout", 10))
        .merge(("databases.redis.url", redis_config.redis_url.clone()))
        .merge(("limits.json", 250 * 1024 * 1024)) // Set limits to 250MiB
    ;

    // Set secret key
    if let Some(secret_key) = client::get_secret_key() {
        config = config.merge(("secret_key", secret_key));
    } else if config.profile() != "debug" {
        eprintln!(
            "{}",
            "Error: No secret key set. This is a security risk!".red()
        );
        exit(1);
    }

    let mut rocket = rocket::custom(config)
        .attach(DBConnection::fairing())
        .attach(RedisPool::init())
        .attach(cors::Cors)
        .manage(Arc::<CHashMap<i64, InfraCache>>::default())
        .manage(chartos_config)
        .manage(MapLayers::parse())
        .manage(runserver_config.map_layers_config.clone());

    // Mount routes
    for (base, routes) in views::routes() {
        rocket = rocket.mount(base, routes);
    }
    rocket
}

/// Create and run the server
async fn runserver(
    args: RunserverArgs,
    pg_config: PostgresConfig,
    chartos_config: ChartosConfig,
    redis_config: RedisConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    println!("Building server...");
    let rocket = create_server(&args, &pg_config, chartos_config, &redis_config);
    // Run server
    println!("Running server...");
    let _rocket = rocket.launch().await?;
    Ok(())
}

/// Run the generate sub command
/// This command refresh all infra given as input (if no infra given then refresh all of them)
async fn generate(
    args: GenerateArgs,
    pg_config: PostgresConfig,
    chartos_config: ChartosConfig,
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
            chartos::invalidate_all(infra.id, &chartos_config).await;
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

/// Run the clear subcommand
/// This command clear all generated data for the given infra
fn clear(args: ClearArgs, pg_config: PostgresConfig) -> Result<(), Box<dyn Error + Send + Sync>> {
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
