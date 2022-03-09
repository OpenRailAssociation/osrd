#[macro_use]
extern crate rocket;
#[macro_use]
extern crate diesel;

mod client;
mod models;
mod schema;
mod views;

use clap::Parser;
use client::{Client, Commands, GenerateArgs, PostgresConfig, RunserverArgs};
use diesel::{Connection, PgConnection};
use models::{DBConnection, Infra};
use std::error::Error;
use std::process::exit;

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

fn generate(args: GenerateArgs, pg_config: PostgresConfig) -> Result<(), Box<dyn Error>> {
    let conn = PgConnection::establish(&pg_config.url()).expect("Error while connecting DB");

    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        for infra in Infra::list(&conn)? {
            infras.push(infra);
        }
    } else {
        args.infra_ids
            .iter()
            .map(|infra_id| Infra::retrieve(*infra_id as i32, &conn))
            .for_each(|infra| infras.push(infra.expect("Couldn't retrieve infra")));
    }
    println!("{:?}", infras);
    Ok(())
}
