use super::params::List;
use crate::client::ChartosConfig;
use crate::error::{ApiResult, EditoastError, InfraLockedError};
use crate::generate;
use crate::infra_cache::InfraCache;
use crate::layer::InvalidationZone;
use crate::models::errors::generate_errors;
use crate::models::infra_errors::get_paginated_infra_errors;
use crate::models::{CreateInfra, DBConnection, Infra, InfraError};
use crate::objects::operation::{Operation, OperationResult};
use crate::objects::SwitchType;
use chashmap::CHashMap;
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::{routes, Route, State};
use rocket_contrib::json::{Json, JsonError, JsonValue};

pub fn routes() -> Vec<Route> {
    routes![
        list,
        get,
        edit,
        create,
        delete,
        refresh,
        list_errors,
        get_switch_types,
        lock,
        unlock
    ]
}

/// Refresh infra generated data
#[post("/refresh?<infras>&<force>")]
fn refresh(
    conn: DBConnection,
    infras: List<i32>,
    force: bool,
    chartos_config: State<ChartosConfig>,
    infra_caches: State<CHashMap<i32, InfraCache>>,
) -> ApiResult<JsonValue> {
    // Use a transaction to give scope to infra list lock
    conn.build_transaction().run::<_, EditoastError, _>(|| {
        let mut infras_list = vec![];
        let infras = infras.0?;

        if infras.is_empty() {
            // Retrieve all available infra
            for infra in Infra::list_for_update(&conn) {
                infras_list.push(infra);
            }
        } else {
            // Retrieve given infras
            for id in infras.iter() {
                infras_list.push(Infra::retrieve_for_update(&conn, *id)?);
            }
        }

        // Refresh each infras
        let mut refreshed_infra = vec![];

        for infra in infras_list {
            let infra_cache = infra_caches.get(&infra.id).unwrap();
            if generate::refresh(&conn, &infra, force, &chartos_config, &infra_cache)? {
                refreshed_infra.push(infra.id);
            }
        }

        Ok(json!({ "infra_refreshed": refreshed_infra }))
    })
}

/// Return a list of infras
#[get("/")]
fn list(conn: DBConnection) -> ApiResult<Json<Vec<Infra>>> {
    Ok(Json(Infra::list(&conn)))
}

/// Return a specific infra
#[get("/<infra>")]
fn get(conn: DBConnection, infra: i32) -> ApiResult<Custom<Json<Infra>>> {
    Ok(Custom(Status::Ok, Json(Infra::retrieve(&conn, infra)?)))
}

/// Create an infra
#[post("/", data = "<data>")]
fn create(
    data: Result<Json<CreateInfra>, JsonError>,
    conn: DBConnection,
    infra_caches: State<CHashMap<i32, InfraCache>>,
) -> ApiResult<Custom<Json<Infra>>> {
    let data = data?;
    let infra = Infra::create(&data.name, &conn)?;
    infra_caches.insert_new(infra.id, InfraCache::default());
    Ok(Custom(Status::Created, Json(infra)))
}

/// Delete an infra
#[delete("/<infra>")]
fn delete(
    infra: i32,
    conn: DBConnection,
    infra_caches: State<CHashMap<i32, InfraCache>>,
) -> ApiResult<Custom<()>> {
    Infra::delete(infra, &conn)?;
    infra_caches.remove(&infra);
    Ok(Custom(Status::NoContent, ()))
}

/// CRUD for edit an infrastructure. Takes a batch of operations.
#[post("/<infra>", data = "<operations>")]
fn edit(
    infra: i32,
    operations: Result<Json<Vec<Operation>>, JsonError>,
    infra_caches: State<CHashMap<i32, InfraCache>>,
    chartos_config: State<ChartosConfig>,
    conn: DBConnection,
) -> ApiResult<Json<Vec<OperationResult>>> {
    let operations = operations?;

    // Use a transaction to give scope to the infra lock
    conn.build_transaction().run::<_, EditoastError, _>(|| {
        // Retrieve and lock infra
        let infra = Infra::retrieve_for_update(&conn, infra as i32)?;

        // Check if the infra is locked
        if infra.locked {
            return Err(InfraLockedError { infra_id: infra.id }.into());
        }

        // Apply modifications
        let mut operation_results = vec![];
        for operation in operations.iter() {
            let operation = operation.clone();
            let infra_id = infra.id;
            operation_results.push(operation.apply(infra_id, &conn)?);
        }

        // Bump version
        let infra = infra.bump_version(&conn)?;

        // Retrieve infra cache
        let mut infra_cache = infra_caches.get_mut(&infra.id).unwrap();

        // Compute cache invalidation zone
        let invalid_zone = InvalidationZone::compute(&infra_cache, &operation_results);

        // Apply operations to infra cache
        infra_cache.apply_operations(&operation_results);

        // Refresh layers if needed
        if invalid_zone.geo.is_valid() {
            assert!(invalid_zone.sch.is_valid());
            generate::update(
                &conn,
                infra.id,
                &operation_results,
                &infra_cache,
                &invalid_zone,
                &chartos_config,
            )
            .expect("Update generated data failed");
        }

        // Generate errors
        generate_errors(&conn, infra.id, &infra_cache, &chartos_config)?;

        // Bump infra generated version to the infra version
        infra.bump_generated_version(&conn)?;

        // Check for warnings and errors
        Ok(Json(operation_results))
    })
}

/// Return the list of errors of an infra
#[get("/<infra>/errors?<page>&<exclude_warnings>&<page_size>")]
fn list_errors(
    infra: i32,
    page: Option<i64>,
    page_size: Option<i64>,
    exclude_warnings: bool,
    conn: DBConnection,
) -> ApiResult<Custom<JsonValue>> {
    let page = page.unwrap_or_default().max(1);
    let per_page = page_size.unwrap_or(25).max(10);
    let (infra_errors, count) =
        get_paginated_infra_errors(&conn, infra, page, per_page, exclude_warnings)?;
    let previous = if page == 1 { None } else { Some(page - 1) };
    let max_page = (count as f64 / per_page as f64).ceil() as i64;
    let next = if page >= max_page {
        None
    } else {
        Some(page + 1)
    };
    Ok(Custom(
        Status::Ok,
        json!({ "count": count, "previous": previous, "next": next, "results": infra_errors }),
    ))
}

/// Return the railjson list of switch types
#[get("/<infra>/switch_types")]
fn get_switch_types(
    infra: i32,
    infra_caches: State<CHashMap<i32, InfraCache>>,
) -> ApiResult<Custom<Json<Vec<SwitchType>>>> {
    let infra = match infra_caches.get(&infra) {
        Some(infra) => infra,
        None => return Err(InfraError::NotFound(infra).into()),
    };

    Ok(Custom(
        Status::Ok,
        Json(infra.switch_types.values().cloned().collect()),
    ))
}

/// Lock an infra
#[post("/<infra>/lock")]
fn lock(infra: i32, conn: DBConnection) -> ApiResult<Custom<JsonValue>> {
    let infra = Infra::retrieve_for_update(&conn, infra)?;
    infra.set_locked(true, &conn)?;
    Ok(Custom(Status::NoContent, json!(null)))
}

/// Unlock an infra
#[post("/<infra>/unlock")]
fn unlock(infra: i32, conn: DBConnection) -> ApiResult<Custom<JsonValue>> {
    let infra = Infra::retrieve_for_update(&conn, infra)?;
    infra.set_locked(false, &conn)?;
    Ok(Custom(Status::NoContent, json!(null)))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::create_server;
    use crate::infra_cache::tests::{create_switch_connection, create_switch_type_cache};
    use crate::models::Infra;
    use crate::objects::operation::{Operation, RailjsonObject};
    use crate::objects::SwitchType;
    use rocket::http::{ContentType, Status};
    use rocket::local::Client;
    use serde::Deserialize;

    #[test]
    fn infra_list() {
        let rocket = create_server(
            Default::default(),
            6000,
            &Default::default(),
            Default::default(),
        );

        let client = Client::new(rocket).expect("valid rocket instance");
        let response = client.get("/infra").dispatch();
        assert_eq!(response.status(), Status::Ok);
    }

    #[test]
    fn infra_create_delete() {
        let rocket = create_server(
            Default::default(),
            6000,
            &Default::default(),
            Default::default(),
        );

        let client = Client::new(rocket).expect("valid rocket instance");
        let mut create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"test"}"#)
            .dispatch();

        let body = create_infra.body_string();
        assert!(body.is_some());

        let infra: Infra = serde_json::from_str(body.unwrap().as_str()).unwrap();

        assert_eq!(create_infra.status(), Status::Created);
        assert_eq!(infra.name, "test");

        let delete_infra = client.delete(format!("/infra/{}", infra.id)).dispatch();

        assert_eq!(delete_infra.status(), Status::NoContent);
    }

    #[test]
    fn infra_get() {
        let rocket = create_server(
            Default::default(),
            6000,
            &Default::default(),
            Default::default(),
        );

        let client = Client::new(rocket).expect("valid rocket instance");
        let mut create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"test"}"#)
            .dispatch();

        let body = create_infra.body_string();
        assert!(body.is_some());

        let infra: Infra = serde_json::from_str(body.unwrap().as_str()).unwrap();
        assert_eq!(create_infra.status(), Status::Created);
        assert_eq!(infra.name, "test");

        let response = client.get(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(response.status(), Status::Ok);

        let delete_infra = client.delete(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra.status(), Status::NoContent);

        let responsedel = client.get(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(responsedel.status(), Status::NotFound);
    }

    #[derive(Deserialize)]
    struct InfraRefreshedResponse {
        infra_refreshed: Vec<i32>,
    }

    #[test]
    fn infra_refresh() {
        let rocket = create_server(
            Default::default(),
            6000,
            &Default::default(),
            Default::default(),
        );

        let client = Client::new(rocket).expect("valid rocket instance");

        let mut create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"refresh_test"}"#)
            .dispatch();

        assert_eq!(create_infra.status(), Status::Created);

        let body_infra = create_infra.body_string();
        assert!(body_infra.is_some());
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        assert_eq!(infra.name, "refresh_test");

        let mut infra_no_refresh = client
            .post(format!("/infra/refresh/?infras={}", infra.id))
            .dispatch();
        assert_eq!(infra_no_refresh.status(), Status::Ok);

        let body_refresh = infra_no_refresh.body_string();
        assert!(body_refresh.is_some());

        let refresh: InfraRefreshedResponse =
            serde_json::from_str(body_refresh.unwrap().as_str()).unwrap();
        assert!(refresh.infra_refreshed.is_empty());

        let delete_infra = client.delete(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra.status(), Status::NoContent);
    }

    #[test]
    fn infra_refresh_force() {
        let rocket = create_server(
            Default::default(),
            6000,
            &Default::default(),
            Default::default(),
        );

        let client = Client::new(rocket).expect("valid rocket instance");

        let mut create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"refresh_test"}"#)
            .dispatch();

        assert_eq!(create_infra.status(), Status::Created);

        let body_infra = create_infra.body_string();
        assert!(body_infra.is_some());
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        assert_eq!(infra.name, "refresh_test");

        let mut infra_no_refresh = client
            .post(format!("/infra/refresh/?force=true&infras={}", infra.id))
            .dispatch();
        assert_eq!(infra_no_refresh.status(), Status::Ok);

        let body_refresh = infra_no_refresh.body_string();
        assert!(body_refresh.is_some());

        let refresh: InfraRefreshedResponse =
            serde_json::from_str(body_refresh.unwrap().as_str()).unwrap();
        assert!(refresh.infra_refreshed.contains(&infra.id));

        let delete_infra = client.delete(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra.status(), Status::NoContent);
    }

    #[test]
    fn infra_get_switch_types() {
        let rocket = create_server(
            Default::default(),
            6000,
            &Default::default(),
            Default::default(),
        );

        let client = Client::new(rocket).expect("valid rocket instance");

        let mut create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"get_switch_types"}"#)
            .dispatch();

        assert_eq!(create_infra.status(), Status::Created);

        let body_infra = create_infra.body_string();
        assert!(body_infra.is_some());
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();

        let switch_type = create_switch_type_cache(
            "point",
            vec!["BASE".into(), "LEFT".into(), "RIGHT".into()],
            HashMap::from([
                (
                    "LEFT".into(),
                    vec![create_switch_connection("BASE".into(), "LEFT".into())],
                ),
                (
                    "RIGHT".into(),
                    vec![create_switch_connection("BASE".into(), "RIGHT".into())],
                ),
            ]),
        );
        let operation = Operation::Create(Box::new(RailjsonObject::SwitchType {
            railjson: switch_type.clone(),
        }));

        let create_switch_type = client
            .post(format!("/infra/{}/", infra.id))
            .header(ContentType::JSON)
            .body(serde_json::to_string(&vec![operation]).unwrap())
            .dispatch();
        assert_eq!(create_switch_type.status(), Status::Ok);

        let mut get_switch_types = client
            .get(format!("/infra/{}/switch_types/", infra.id))
            .dispatch();
        assert_eq!(get_switch_types.status(), Status::Ok);
        let body_switch_types = get_switch_types.body_string();
        assert!(body_switch_types.is_some());

        let switch_types: Vec<SwitchType> =
            serde_json::from_str(body_switch_types.unwrap().as_str()).unwrap();
        assert!(switch_types.len() == 1);
        assert_eq!(switch_types[0].id, switch_type.id);

        let delete_infra = client.delete(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra.status(), Status::NoContent);
    }

    #[test]
    fn infra_lock() {
        let rocket = create_server(
            Default::default(),
            6000,
            &Default::default(),
            Default::default(),
        );

        let client = Client::new(rocket).expect("valid rocket instance");

        let mut create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"lock test"}"#)
            .dispatch();
        assert_eq!(create_infra.status(), Status::Created);

        let body_infra = create_infra.body_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        assert!(!infra.locked);

        let lock_query = client.post(format!("/infra/{}/lock/", infra.id)).dispatch();
        assert_eq!(lock_query.status(), Status::NoContent);

        let body_infra = client
            .get(format!("/infra/{}", infra.id))
            .dispatch()
            .body_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        assert!(infra.locked);

        let unlock_query = client
            .post(format!("/infra/{}/unlock/", infra.id))
            .dispatch();
        assert_eq!(unlock_query.status(), Status::NoContent);

        let body_infra = client
            .get(format!("/infra/{}", infra.id))
            .dispatch()
            .body_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        assert!(!infra.locked);

        let delete_infra = client.delete(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra.status(), Status::NoContent);
    }
}
