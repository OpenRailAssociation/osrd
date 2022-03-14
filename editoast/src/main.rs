#[macro_use]
extern crate rocket;
#[macro_use]
extern crate diesel;

mod client;
mod generate;
mod models;
mod railjson;
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

    let mut infras = vec![];
    if args.infra_ids.is_empty() {
        // Retrieve all available infra
        for infra in Infra::list(&conn)? {
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
        generate::refresh(&conn, &infra, args.force)?;
        println!("✅ Infra {}[{}] generated!", infra.name.bold(), infra.id);
    }
    Ok(())
}

#[cfg(test)]
mod test {
    use super::views;
    use rocket::http::Status;
    use rocket::local::blocking::Client;
    use rocket::routes;

    #[test]
    fn health() {
        let serv = rocket::build().mount("/", routes![views::health]);
        let client = Client::tracked(serv).expect("valid rocket instance");
        let response = client.get("/health").dispatch();
        assert_eq!(response.status(), Status::Ok);
    }
}
