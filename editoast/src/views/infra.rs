use crate::error::{ApiError, ApiResult};
use crate::generate;
use crate::infra_cache::InfraCache;
use crate::models::{CreateInfra, DBConnection, Infra, InfraError};
use crate::railjson::operation::{Operation, OperationResult};
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::{routes, Route, State};
use rocket_contrib::json::{Json, JsonError, JsonValue};
use std::collections::HashMap;
use std::ops::DerefMut;
use std::sync::Mutex;

use super::params::List;

pub fn routes() -> Vec<Route> {
    routes![list, edit, create, delete, refresh]
}

/// Refresh infra generated data
#[post("/refresh?<infras>&<force>")]
fn refresh(conn: DBConnection, infras: List<i32>, force: bool) -> ApiResult<JsonValue> {
    let mut infras_list = vec![];
    let infras = infras.0?;

    if infras.is_empty() {
        // Retrieve all available infra
        for infra in Infra::list(&conn) {
            infras_list.push(infra);
        }
    } else {
        // Retrieve given infras
        for id in infras.iter() {
            infras_list.push(Infra::retrieve(&conn, *id)?);
        }
    }

    // Refresh each infras
    let mut refreshed_infra = vec![];
    for infra in infras_list {
        if generate::refresh(&conn, &infra, force)? {
            refreshed_infra.push(infra.id);
        }
    }

    Ok(json!({ "infra_refreshed": refreshed_infra }))
}

/// Return a list of infras
#[get("/")]
fn list(conn: DBConnection) -> ApiResult<Json<Vec<Infra>>> {
    Ok(Json(Infra::list(&conn)))
}

#[post("/", data = "<data>")]
fn create(
    data: Result<Json<CreateInfra>, JsonError>,
    conn: DBConnection,
) -> ApiResult<Custom<Json<Infra>>> {
    let data = data?;
    let infra = Infra::create(&data.name, &conn)?;
    Ok(Custom(Status::Created, Json(infra)))
}

#[delete("/<infra>")]
fn delete(infra: u32, conn: DBConnection) -> ApiResult<Custom<()>> {
    Infra::delete(infra as i32, &conn)?;
    Ok(Custom(Status::NoContent, ()))
}

/// CRUD for edit an infrastructure. Takes a batch of operations.
#[post("/<infra>", data = "<operations>")]
fn edit(
    infra: i32,
    operations: Result<Json<Vec<Operation>>, JsonError>,
    infra_caches: State<HashMap<i32, Mutex<InfraCache>>>,
    conn: DBConnection,
) -> ApiResult<Json<Vec<OperationResult>>> {
    let operations = operations?;

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
    let mut operation_results = vec![];
    for operation in operations.iter() {
        let operation = operation.clone();
        let infra_id = infra.id;
        operation_results.push(operation.apply(infra_id, &conn)?);
    }

    // Bump version
    let infra = infra.bump_version(&conn)?;

    // Apply operations to infra cache
    for op_res in operation_results.iter() {
        infra_cache.apply(op_res);
    }

    // Refresh layers
    generate::update(&conn, infra.id, &operations, infra_cache.deref_mut())
        .expect("Update generated data failed");

    // Bump infra generated version to the infra version
    infra.bump_generated_version(&conn)?;

    // Check for warnings and errors
    Ok(Json(operation_results))
}
