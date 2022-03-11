use crate::generate;
use crate::models::{DBConnection, Infra, InfraError};
use crate::railjson::operation::Operation;
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::Json;
use rocket::Route;

pub fn routes() -> Vec<Route> {
    routes![health, infra_list, edit_infra]
}

#[get("/health")]
async fn health() {}

#[get("/infra")]
/// Return a list of infras
async fn infra_list(connection: DBConnection) -> Json<Vec<Infra>> {
    connection
        .run(|c| Infra::list(c))
        .await
        .map(Json)
        .expect("An error occurred")
}

#[post("/infra/<infra>", data = "<operations>")]
/// CRUD for edit an infrastructure. Takes a batch of
async fn edit_infra(
    infra: u32,
    operations: Json<Vec<Operation>>,
    connection: DBConnection,
) -> Result<String, Custom<String>> {
    // TODO: Fix lifetime issue ?
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

    // Apply modifications
    for operation in operations.iter() {
        let operation = operation.clone();
        let infra_id = infra.id;
        connection
            .run(move |c| {
                operation.apply(infra_id, c);
            })
            .await
    }

    // Bump version
    let _infra = infra.clone();
    connection.run(move |c| _infra.bump_version(c)).await;

    // Refresh layers
    let _infra = infra.clone();

    // TODO: Make it work async
    connection
        .run(move |c| generate::refresh(c, &_infra, false))
        .await;

    // Check for warnings and errors
    Ok(format!("OK!"))
}
