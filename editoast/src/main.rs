#[macro_use]
extern crate rocket;
#[macro_use]
extern crate diesel;

mod client;
mod generate;
mod models;
mod schema;
mod views;

use clap::Parser;
use client::{Client, Commands, GenerateArgs, PostgresConfig, RunserverArgs};
use colored::*;
use diesel::{Connection, PgConnection};
use models::{DBConnection, Infra};
use std::error::Error;
use std::process::exit;

#[rocket::main]
async fn main() {
    match run().await {
        Ok(_) => (),
        Err(e) => {
            eprintln!("{}", e);
            exit(2);
        }
    }
}

async fn run() -> Result<(), Box<dyn Error>> {
    let client = Client::parse();
    let pg_config = client.postgres_config;

    match client.command {
        Commands::Runserver(args) => runserver(args, pg_config).await,
        Commands::Generate(args) => generate(args, pg_config),
    }
}

async fn runserver(args: RunserverArgs, pg_config: PostgresConfig) -> Result<(), Box<dyn Error>> {
    let config = rocket::Config::figment()
        .merge(("port", args.port))
        .merge(("databases.postgres.url", pg_config.url()));

    rocket::custom(config)
        .attach(DBConnection::fairing())
        .mount(args.get_root_url(), views::routes())
        .launch()
        .await?;

    Ok(())
}

/// Run the generate sub command
/// This command refresh all infra given as input (if no infra given then refresh all of them)
fn generate(args: GenerateArgs, pg_config: PostgresConfig) -> Result<(), Box<dyn Error>> {
    let conn = PgConnection::establish(&pg_config.url()).expect("Error while connecting DB");

    let infras = if args.infra_ids.is_empty() {
        // Retrieve all available infra
        let mut infras = vec![];
        for infra in Infra::list(&conn)? {
            infras.push(infra);
        }
        infras
    } else {
        // Retrieve given infra
        Infra::retrieve_list(&conn, &args.infra_ids.iter().map(|id| *id as i32).collect())?
    };

    // Refresh each infras
    for infra in infras {
        println!(
            "🍞 Infra {}[{}] is generating...",
            infra.name.bold(),
            infra.id
        );
        generate::refresh(&conn, infra.id)?;
        println!("✅ Infra {}[{}] generated!", infra.name.bold(), infra.id);
    }
    Ok(())
}
