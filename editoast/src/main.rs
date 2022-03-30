#![feature(proc_macro_hygiene, decl_macro)]
#[macro_use]
extern crate rocket;
#[macro_use]
extern crate diesel;
#[macro_use]
extern crate rocket_contrib;

mod client;
mod generate;
mod infra_cache;
mod models;
mod railjson;
mod response;
mod schema;
mod views;

use clap::Parser;
use client::{Client, Commands, GenerateArgs, PostgresConfig, RunserverArgs};
use colored::*;
use diesel::{Connection, PgConnection};
use infra_cache::InfraCache;
use models::{DBConnection, Infra};
use rocket::config::Value;
use std::collections::HashMap;
use std::error::Error;
use std::process::exit;
use std::sync::Mutex;

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

    match client.command {
        Commands::Runserver(args) => runserver(args, pg_config),
        Commands::Generate(args) => generate(args, pg_config),
    }
}

fn runserver(
    args: RunserverArgs,
    pg_config: PostgresConfig,
) -> Result<(), Box<dyn Error + Send + Sync>> {
    let conn = PgConnection::establish(&pg_config.url()).expect("Error while connecting DB");
    let infras = Infra::list(&conn);

    // Initialize infra caches
    let mut infra_caches = HashMap::new();
    for infra in infras.iter() {
        let infra_cache = Mutex::new(InfraCache::init(&conn, infra.id));
        infra_caches.insert(infra.id, infra_cache);
    }

    // Config and run server
    let databases = HashMap::from([(
        "postgres",
        Value::from(HashMap::from([("url", Value::from(pg_config.url()))])),
    )]);

    let mut config = rocket::Config::active().unwrap();
    config.set_port(args.port);
    config
        .extras
        .insert("databases".to_string(), databases.into());

    rocket::custom(config)
        .attach(DBConnection::fairing())
        .manage(infra_caches)
        .mount("/", views::routes())
        .launch();
    Ok(())
}

/// Run the generate sub command
/// This command refresh all infra given as input (if no infra given then refresh all of them)
fn generate(
    args: GenerateArgs,
    pg_config: PostgresConfig,
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
            infras.push(Infra::retrieve(&conn, id as i32).unwrap());
        }
    };

    // Refresh each infras
    for infra in infras {
        println!(
            "🍞 Infra {}[{}] is generating:",
            infra.name.bold(),
            infra.id
        );
        generate::refresh(&conn, &infra, args.force)?;
        println!("✅ Infra {}[{}] generated!", infra.name.bold(), infra.id);
    }
    Ok(())
}

#[cfg(test)]
mod test {
    use super::views;
    use rocket::http::Status;
    use rocket::local::Client;
    use rocket::routes;

    #[test]
    fn health() {
        let serv = rocket::ignite().mount("/", routes![views::health]);
        let client = Client::new(serv).expect("valid rocket instance");
        let response = client.get("/health").dispatch();
        assert_eq!(response.status(), Status::Ok);
    }
}
