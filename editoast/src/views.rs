use crate::generate;
use crate::infra_cache::InfraCache;
use crate::models::{DBConnection, GeneratedInfra, Infra, InfraError};
use crate::railjson::operation::Operation;
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::Json;
use rocket::{routes, Route, State};
use std::collections::HashMap;

pub fn routes() -> Vec<Route> {
    routes![health, infra_list, edit_infra]
}

#[get("/health")]
pub async fn health() {}

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
    infra_caches: &State<HashMap<i32, InfraCache>>,
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

    // List objects that needs to be refreshed
    let infra_cache = infra_caches
        .get(&infra.id)
        .expect(format!("Infra cache does not contain infra '{}'", infra.id).as_str());
    let mut update_lists = HashMap::new();
    for operation in operations.iter() {
        operation.get_updated_objects(&mut update_lists, &infra_cache);
    }

    // Refresh layers
    connection
        .run(move |c| generate::update(c, infra.id, &update_lists))
        .await
        .expect("Update generated data failed");

    // Bump generated infra version to the infra version
    connection
        .run(move |c| {
            let mut gen_infra = GeneratedInfra::retrieve(c, infra.id);
            gen_infra.version = infra.version;
            gen_infra.save(c);
        })
        .await;

    // Check for warnings and errors
    Ok(format!("OK!"))
}
