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

#[post("/infra/<infra>")]
async fn edit_infra(infra: u32, connection: DBConnection) -> Result<String, Custom<String>> {
    // Retrieve infra
    let infra = match connection
        .run(move |c| Infra::retrieve(c, infra as i32))
        .await
    {
        Ok(infra) => infra,
        Err(error) => match error {
            InfraError::NotFound(_) => return Err(Custom(Status::NotFound, error.to_string())),
            e => return Err(Custom(Status::InternalServerError, e.to_string())),
        },
    };
    // Parse json body
    // Apply modifications
    // Refresh layers
    // Check for warnings and errors
    Ok(format!("OK! {:?}", infra))
}
