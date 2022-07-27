#![feature(proc_macro_hygiene, decl_macro)]
#[macro_use]
extern crate rocket;
#[macro_use]
extern crate diesel;
#[macro_use]
extern crate rocket_contrib;

mod client;
mod error;
mod generate;
mod infra_cache;
mod models;
mod railjson;
mod schema;
mod views;

use chashmap::CHashMap;
use clap::Parser;
use client::{ChartosConfig, Client, Commands, GenerateArgs, PostgresConfig, RunserverArgs};
use colored::*;
use diesel::{Connection, PgConnection};
use infra_cache::InfraCache;
use models::{DBConnection, Infra};
use rocket::config::Value;
use rocket::Rocket;
use rocket_cors::CorsOptions;
use std::collections::HashMap;
use std::error::Error;
use std::process::exit;

fn main() {
    match run() {
        Ok(_) => (),
        Err(e) => {
            eprintln!("{}", e);
            exit(2);
        }
    }
}

fn run() -> Result<(), Box<dyn Error + Send + Sync>> {
    let client = Client::parse();
    let pg_config = client.postgres_config;
    let chartos_config = client.chartos_config;

    match client.command {
        Commands::Runserver(args) => runserver(args, pg_config, chartos_config),
        Commands::Generate(args) => generate(args, pg_config, chartos_config),
    }
}
pub fn create_server(
    infra_caches: CHashMap<i32, InfraCache>,
    port: u16,
    pg_config: &PostgresConfig,
    chartos_config: ChartosConfig,
) -> Rocket {
    // Config server
    let databases = HashMap::from([(
        "postgres",
        Value::from(HashMap::from([("url", Value::from(pg_config.url()))])),
    )]);

    let mut config = rocket::Config::active().unwrap();
    config.set_port(port);
    config
        .extras
        .insert("databases".to_string(), databases.into());

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

fn runserver(
    args: RunserverArgs,
    pg_config: PostgresConfig,
    chartos_config: ChartosConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let conn = PgConnection::establish(&pg_config.url()).expect("Error while connecting DB");
    let infras = Infra::list(&conn);

    // Initialize infra caches
    let infra_caches = CHashMap::new();
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
    rocket.launch();
    Ok(())
}

/// Run the generate sub command
/// This command refresh all infra given as input (if no infra given then refresh all of them)
fn generate(
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
        generate::refresh(&conn, &infra, args.force, &chartos_config, &infra_cache)?;
        println!("✅ Infra {}[{}] generated!", infra.name.bold(), infra.id);
    }
    Ok(())
}
