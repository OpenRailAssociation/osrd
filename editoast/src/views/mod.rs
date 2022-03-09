use crate::diesel::RunQueryDsl;
use crate::schema::osrd_infra_infra::dsl::*;
use crate::DBConnection;
use rocket::serde::json::Json;
use rocket::serde::uuid::Uuid;
use rocket::serde::Serialize;
use rocket::Route;

#[get("/health")]
async fn health() {}

#[derive(Queryable, Debug, Serialize)]
#[serde(crate = "rocket::serde")]
#[table_name = "osrd_infra_infra"]
pub struct Infra {
    pub id: i32,
    pub name: String,
    pub owner: Uuid,
}

#[get("/infra")]
async fn infra_list(connection: DBConnection) -> Json<Vec<Infra>> {
    connection
        .run(|c| osrd_infra_infra.load::<Infra>(c))
        .await
        .map(Json)
        .expect("Error loading infras")
}

pub fn routes() -> Vec<Route> {
    routes![health, infra_list]
}
