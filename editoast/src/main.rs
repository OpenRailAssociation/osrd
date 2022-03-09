#[macro_use]
extern crate rocket;
#[macro_use]
extern crate diesel;

mod client;
mod schema;
mod views;

use clap::Parser;
use client::{Client, Commands, GenerateArgs, PostgresConfig, RunserverArgs};
use rocket_sync_db_pools::database;
use std::error::Error;
use std::process::exit;

#[database("postgres")]
pub struct DBConnection(diesel::PgConnection);

#[rocket::main]
async fn main() {
    match parse_client().await {
        Ok(_) => (),
        Err(e) => {
            eprintln!("{}", e);
            exit(2);
        }
    }
}

async fn parse_client() -> Result<(), Box<dyn Error>> {
    let client = Client::parse();
    let pg_config = client.postgres_config;

    match client.command {
        Commands::Runserver(args) => runserver(args, pg_config).await,
        Commands::Generate(args) => generate(args),
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

fn generate(args: GenerateArgs) -> Result<(), Box<dyn Error>> {
    Ok(())
}
