#[macro_use]
extern crate rocket;
#[macro_use]
extern crate diesel;

mod api_error;
mod chartos;
mod client;
mod db_connection;
mod generated_data;
mod infra;
mod infra_cache;
mod schema;
mod tables;
mod views;

use chashmap::CHashMap;
use clap::Parser;
use client::{
    ChartosConfig, ClearArgs, Client, Commands, GenerateArgs, PostgresConfig, RunserverArgs,
};
use colored::*;
use db_connection::DBConnection;
use diesel::{Connection, PgConnection};
use infra::Infra;
use infra_cache::InfraCache;
use rocket::{Build, Config, Rocket};
use rocket_cors::CorsOptions;
use std::error::Error;
use std::process::exit;
use std::sync::Arc;

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
    let pg_config = client.postgres_config;
    let chartos_config = client.chartos_config;

    match client.command {
        Commands::Runserver(args) => runserver(args, pg_config, chartos_config).await,
        Commands::Generate(args) => generate(args, pg_config, chartos_config).await,
        Commands::Clear(args) => clear(args, pg_config),
    }
}
pub fn create_server(
    infra_caches: Arc<CHashMap<i32, InfraCache>>,
    port: u16,
    pg_config: &PostgresConfig,
    chartos_config: ChartosConfig,
) -> Rocket<Build> {
    // Config server
    let mut config = Config::figment()
        .merge(("port", port))
        .merge(("databases.postgres.url", pg_config.url()))
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

    // Setup CORS
    let cors = CorsOptions::default().to_cors().unwrap();

    let mut rocket = rocket::custom(config)
        .attach(DBConnection::fairing())
        .attach(cors)
        .manage(infra_caches)
        .manage(chartos_config);

    // Mount routes
    for (base, routes) in views::routes() {
        rocket = rocket.mount(base, routes);
    }
    rocket
}

async fn runserver(
    args: RunserverArgs,
    pg_config: PostgresConfig,
    chartos_config: ChartosConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let conn = pg_config.make_connection();
    let infras = Infra::list(&conn);

    // Initialize infra caches
    let infra_caches = Arc::new(CHashMap::new());
    for infra in infras.iter() {
        println!(
            "🍞 Loading cache for infra {}[{}]...",
            infra.name.bold(),
            infra.id
        );
        let infra_cache = InfraCache::load(&conn, infra.id);
        infra_caches.insert_new(infra.id, infra_cache);
    }
    println!("✅ Done loading infra caches!");

    let rocket = create_server(infra_caches, args.port, &pg_config, chartos_config);

    // Run server
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
    let conn = PgConnection::establish(&pg_config.url()).expect("Error while connecting DB");

    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::list(&conn) {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        for id in args.infra_ids {
            infras.push(Infra::retrieve(&conn, id as i32)?);
        }
    };

    // Refresh each infras
    for infra in infras {
        println!(
            "🍞 Infra {}[{}] is generating:",
            infra.name.bold(),
            infra.id
        );
        let infra_cache = InfraCache::load(&conn, infra.id);
        if infra.refresh(&conn, args.force, &infra_cache)? {
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

/// Run the clear subcommand
/// This command clear all generated data for the given infra
fn clear(args: ClearArgs, pg_config: PostgresConfig) -> Result<(), Box<dyn Error + Send + Sync>> {
    let conn = PgConnection::establish(&pg_config.url()).expect("Error while connecting DB");
    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::list(&conn) {
            infras.push(infra);
        }
    } else {
        // Retrieve given infras
        for id in args.infra_ids {
            infras.push(Infra::retrieve(&conn, id as i32)?);
        }
    };

    for infra in infras {
        println!("🍞 Infra {}[{}] is clearing:", infra.name.bold(), infra.id);
        infra.clear(&conn)?;
        println!("✅ Infra {}[{}] cleared!", infra.name.bold(), infra.id);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::clear;
    use crate::client::ClearArgs;
    use crate::client::PostgresConfig;
    #[test]
    fn clear_generated_data() {
        let args = ClearArgs { infra_ids: vec![0] };
        let pg_config = PostgresConfig::default();
        let err = clear(args, pg_config);
        assert!(err.is_err());
    }
}
