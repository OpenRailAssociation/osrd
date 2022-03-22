use crate::generate;
use crate::infra_cache::InfraCache;
use crate::models::{CreateInfra, DBConnection, GeneratedInfra, Infra};
use crate::railjson::operation::Operation;
use crate::response::ApiResult;
use rocket::serde::json::Json;
use rocket::{routes, Route, State};
use std::collections::HashMap;

pub fn routes() -> Vec<Route> {
    routes![health, infra_list, edit_infra, create_infra, delete_infra]
}

#[get("/health")]
pub async fn health() {}

#[get("/infra")]
/// Return a list of infras
async fn infra_list(connection: DBConnection) -> ApiResult<Vec<Infra>> {
    Ok(Json(connection.run(|c| Infra::list(c)).await))
}

#[post("/infra", data = "<data>")]
async fn create_infra(data: Json<CreateInfra>, connection: DBConnection) -> ApiResult<i32> {
    let infra = connection
        .run(move |c| Infra::create(&data.name, c))
        .await?;
    Ok(Json(infra.id))
}

#[delete("/infra/<infra>")]
async fn delete_infra(infra: u32, connection: DBConnection) -> ApiResult<()> {
    connection
        .run(move |c| Infra::delete(infra as i32, c))
        .await?;
    Ok(Json(()))
}

#[post("/infra/<infra>", data = "<operations>")]
/// CRUD for edit an infrastructure. Takes a batch of operations
async fn edit_infra(
    infra: u32,
    operations: Json<Vec<Operation>>,
    infra_caches: &State<HashMap<i32, InfraCache>>,
    connection: DBConnection,
) -> ApiResult<String> {
    // Retrieve infra
    let infra = connection
        .run(move |c| Infra::retrieve(c, infra as i32))
        .await?;

    // Apply modifications
    for operation in operations.iter() {
        let operation = operation.clone();
        let infra_id = infra.id;
        connection
            .run(move |c| operation.apply(infra_id, c))
            .await?
    }

    // Bump version
    let infra = connection.run(move |c| infra.bump_version(c)).await?;

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
    Ok(Json(String::from("ok")))
}
