use super::params::List;
use crate::client::ChartosConfig;
use crate::error::{ApiResult, EditoastError};
use crate::generate;
use crate::infra_cache::InfraCache;
use crate::models::{CreateInfra, DBConnection, Infra};
use crate::railjson::operation::{Operation, OperationResult};
use chashmap::CHashMap;
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::{routes, Route, State};
use rocket_contrib::json::{Json, JsonError, JsonValue};
use std::ops::DerefMut;

pub fn routes() -> Vec<Route> {
    routes![list, edit, create, delete, refresh]
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
        let mut infra_cache = infra_caches.get_mut(&infra.id).unwrap();
        for op_res in operation_results.iter() {
            infra_cache.apply(op_res);
        }

        // Refresh layers
        generate::update(
            &conn,
            infra.id,
            &operations,
            infra_cache.deref_mut(),
            &chartos_config,
        )
        .expect("Update generated data failed");

        // Bump infra generated version to the infra version
        infra.bump_generated_version(&conn)?;

        // Check for warnings and errors
        Ok(Json(operation_results))
    })
}

#[cfg(test)]
mod test {
    use crate::create_server;
    use crate::models::Infra;
    use rocket::http::{ContentType, Status};
    use rocket::local::Client;
    use serde::Deserialize;

    #[test]
    fn infras_list() {
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
    fn infras_create_delete() {
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

    #[derive(Deserialize)]
    struct InfraRefreshedResponse {
        infra_refreshed: Vec<i32>,
    }

    #[test]
    fn infras_refresh() {
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
    fn infras_refresh_force() {
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
}
