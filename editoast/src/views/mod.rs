use crate::models::{DBConnection, Infra};
use rocket::serde::json::Json;
use rocket::Route;

pub fn routes() -> Vec<Route> {
    routes![health, infra_list]
}

#[get("/health")]
async fn health() {}

#[get("/infra")]
async fn infra_list(connection: DBConnection) -> Json<Vec<Infra>> {
    connection
        .run(|c| Infra::list(c))
        .await
        .map(Json)
        .expect("An error occurred")
}
