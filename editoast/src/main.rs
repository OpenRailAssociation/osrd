#[macro_use]
extern crate rocket;

mod client;
mod views;

use clap::Parser;
use client::{Client, RunserverCommand};

#[rocket::main]
async fn main() {
    let client = Client::parse();
    match client {
        Client::Runserver(args) => runserver(args).await.expect("An error occured..."),
    };
}

async fn runserver(command: RunserverCommand) -> Result<(), rocket::Error> {
    let config = rocket::Config::figment().merge(("port", command.port));
    let root_url = if command.root_url.starts_with('/') {
        command.root_url
    } else {
        String::from("/") + command.root_url.as_str()
    };

    rocket::custom(config)
        .mount(root_url, views::routes())
        .launch()
        .await
}
