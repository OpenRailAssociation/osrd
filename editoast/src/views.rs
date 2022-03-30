use crate::generate;
use crate::infra_cache::InfraCache;
use crate::models::{CreateInfra, DBConnection, Infra, InfraError};
use crate::railjson::operation::Operation;
use crate::response::{ApiError, ApiResult};
use rocket::{routes, Route, State};
use rocket_contrib::json::Json;
use std::collections::HashMap;
use std::ops::DerefMut;
use std::sync::Mutex;

pub fn routes() -> Vec<Route> {
    routes![health, infra_list, edit_infra, create_infra, delete_infra]
}

#[get("/health")]
pub fn health() {}

/// Return a list of infras
#[get("/infra")]
fn infra_list(conn: DBConnection) -> ApiResult<Vec<Infra>> {
    Ok(Json(Infra::list(&conn)))
}

#[post("/infra", data = "<data>")]
fn create_infra(data: Json<CreateInfra>, conn: DBConnection) -> ApiResult<i32> {
    let infra = Infra::create(&data.name, &conn)?;
    Ok(Json(infra.id))
}

#[delete("/infra/<infra>")]
fn delete_infra(infra: u32, conn: DBConnection) -> ApiResult<()> {
    Infra::delete(infra as i32, &conn)?;
    Ok(Json(()))
}

/// CRUD for edit an infrastructure. Takes a batch of operations.
#[post("/infra/<infra>", data = "<operations>")]
fn edit_infra(
    infra: i32,
    operations: Json<Vec<Operation>>,
    infra_caches: State<HashMap<i32, Mutex<InfraCache>>>,
    conn: DBConnection,
) -> ApiResult<String> {
    // Take lock on infra cache
    if !infra_caches.contains_key(&infra) {
        let err: Box<dyn ApiError> = Box::new(InfraError::NotFound(infra));
        return Err(err.into());
    }

    let infra_cache = infra_caches.get(&infra).unwrap();
    let mut infra_cache = infra_cache.lock().unwrap();

    // Retrieve infra
    let infra = Infra::retrieve(&conn, infra as i32)?;

    // Check if infra has sync generated data
    generate::refresh(&conn, &infra, false)?;

    // Apply modifications
    for operation in operations.iter() {
        let operation = operation.clone();
        let infra_id = infra.id;
        operation.apply(infra_id, &conn)?
    }

    // Bump version
    let infra = infra.bump_version(&conn)?;

    // Apply operations to infra cache
    for op in operations.iter() {
        infra_cache.apply(op);
    }

    // Refresh layers
    generate::update(&conn, infra.id, &operations, infra_cache.deref_mut())
        .expect("Update generated data failed");

    // Bump infra generated version to the infra version
    infra.bump_generated_version(&conn)?;

    // Check for warnings and errors
    Ok(Json(String::from("ok")))
}
