mod edition;
mod errors;
mod objects;

use std::sync::Arc;

use super::params::List;
use crate::api_error::ApiResult;
use crate::chartos;
use crate::client::ChartosConfig;
use crate::db_connection::DBConnection;
use crate::infra::{Infra, InfraName};
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::operation::{Operation, OperationResult};
use crate::schema::SwitchType;
use chashmap::CHashMap;
use errors::get_paginated_infra_errors;
use objects::get_objects;
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::{json, Error as JsonError, Json, Value as JsonValue};
use rocket::{routes, Route, State};

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
        get_objects,
        rename,
        lock,
        unlock
    ]
}

/// Refresh infra generated data
#[post("/refresh?<infras>&<force>")]
async fn refresh<'a>(
    conn: DBConnection,
    infras: List<'a, i32>,
    force: bool,
    chartos_config: &State<ChartosConfig>,
    infra_caches: &State<Arc<CHashMap<i32, InfraCache>>>,
) -> ApiResult<JsonValue> {
    let infra_caches = infra_caches.inner().clone();
    let refreshed_infra = conn
        .run::<_, ApiResult<_>>(move |conn| {
            // Use a transaction to give scope to infra list lock
            let mut infras_list = vec![];
            let infras = infras.0;

            if infras.is_empty() {
                // Retrieve all available infra
                for infra in Infra::list_for_update(conn) {
                    infras_list.push(infra);
                }
            } else {
                // Retrieve given infras
                for id in infras.iter() {
                    infras_list.push(Infra::retrieve_for_update(conn, *id)?);
                }
            }

            // Refresh each infras
            let mut refreshed_infra = vec![];

            for infra in infras_list {
                let infra_cache = InfraCache::get_or_load(conn, &infra_caches, &infra)?;
                if infra.refresh(conn, force, &infra_cache)? {
                    refreshed_infra.push(infra.id);
                }
            }
            Ok(refreshed_infra)
        })
        .await?;

    for infra_id in refreshed_infra.iter() {
        chartos::invalidate_all(*infra_id, chartos_config).await;
    }

    Ok(json!({ "infra_refreshed": refreshed_infra }))
}

/// Return a list of infras
#[get("/")]
async fn list(conn: DBConnection) -> ApiResult<Json<Vec<Infra>>> {
    conn.run(move |conn| Ok(Json(Infra::list(conn)))).await
}

/// Return a specific infra
#[get("/<infra>")]
async fn get(conn: DBConnection, infra: i32) -> ApiResult<Custom<Json<Infra>>> {
    conn.run(move |conn| Ok(Custom(Status::Ok, Json(Infra::retrieve(conn, infra)?))))
        .await
}

/// Create an infra
#[post("/", data = "<data>")]
async fn create(
    data: Result<Json<InfraName>, JsonError<'_>>,
    conn: DBConnection,
) -> ApiResult<Custom<Json<Infra>>> {
    let data = data?;
    conn.run(move |conn| {
        let infra = Infra::create(&data.name, conn)?;
        Ok(Custom(Status::Created, Json(infra)))
    })
    .await
}

/// Delete an infra
#[delete("/<infra>")]
async fn delete(
    infra: i32,
    conn: DBConnection,
    infra_caches: &State<Arc<CHashMap<i32, InfraCache>>>,
) -> ApiResult<Custom<()>> {
    let infra_caches = infra_caches.inner().clone();
    conn.run(move |conn| {
        Infra::delete(infra, conn)?;
        infra_caches.remove(&infra);
        Ok(Custom(Status::NoContent, ()))
    })
    .await
}

/// Update an infra name
#[put("/<infra>", data = "<new_name>")]
async fn rename(
    infra: i32,
    new_name: Result<Json<InfraName>, JsonError<'_>>,
    conn: DBConnection,
) -> ApiResult<Custom<Json<Infra>>> {
    let new_name = new_name?.0.name;
    conn.run(move |conn| {
        let infra = Infra::rename(conn, infra, new_name)?;
        Ok(Custom(Status::Ok, Json(infra)))
    })
    .await
}

/// CRUD for edit an infrastructure. Takes a batch of operations.
#[post("/<infra>", data = "<operations>")]
async fn edit<'a>(
    infra: i32,
    operations: Result<Json<Vec<Operation>>, JsonError<'a>>,
    infra_caches: &State<Arc<CHashMap<i32, InfraCache>>>,
    chartos_config: &State<ChartosConfig>,
    conn: DBConnection,
) -> ApiResult<Json<Vec<OperationResult>>> {
    let operations = operations?;
    let infra_caches = infra_caches.inner().clone();

    let (operation_results, invalid_zone) = conn
        .run::<_, ApiResult<_>>(move |conn| {
            let infra = Infra::retrieve_for_update(conn, infra)?;
            let mut infra_cache = InfraCache::get_or_load_mut(conn, &infra_caches, &infra).unwrap();
            edition::edit(conn, &infra, &operations, &mut infra_cache)
        })
        .await?;

    chartos::invalidate_zone(infra, chartos_config, &invalid_zone).await;

    Ok(Json(operation_results))
}

/// Return the list of errors of an infra
#[get("/<infra>/errors?<page>&<exclude_warnings>&<page_size>")]
async fn list_errors(
    infra: i32,
    page: Option<i64>,
    page_size: Option<i64>,
    exclude_warnings: bool,
    conn: DBConnection,
) -> ApiResult<Custom<JsonValue>> {
    let page = page.unwrap_or_default().max(1);
    let per_page = page_size.unwrap_or(25).max(10);

    let (infra_errors, count) = conn
        .run(move |conn| get_paginated_infra_errors(conn, infra, page, per_page, exclude_warnings))
        .await?;
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
async fn get_switch_types(
    infra: i32,
    conn: DBConnection,
    infra_caches: &State<Arc<CHashMap<i32, InfraCache>>>,
) -> ApiResult<Custom<Json<Vec<SwitchType>>>> {
    let infra_caches = infra_caches.inner().clone();
    conn.run(move |conn| {
        let infra = Infra::retrieve(conn, infra)?;
        let infra = InfraCache::get_or_load(conn, &infra_caches, &infra)?;
        Ok(Custom(
            Status::Ok,
            Json(
                infra
                    .switch_types()
                    .values()
                    .map(ObjectCache::unwrap_switch_type)
                    .cloned()
                    .collect(),
            ),
        ))
    })
    .await
}

/// Lock an infra
#[post("/<infra>/lock")]
async fn lock(infra: i32, conn: DBConnection) -> ApiResult<Custom<JsonValue>> {
    conn.run(move |conn| {
        let infra = Infra::retrieve_for_update(conn, infra)?;
        infra.set_locked(true, conn)?;
        Ok(Custom(Status::NoContent, json!(null)))
    })
    .await
}

/// Unlock an infra
#[post("/<infra>/unlock")]
async fn unlock(infra: i32, conn: DBConnection) -> ApiResult<Custom<JsonValue>> {
    conn.run(move |conn| {
        let infra = Infra::retrieve_for_update(conn, infra)?;
        infra.set_locked(false, conn)?;
        Ok(Custom(Status::NoContent, json!(null)))
    })
    .await
}

#[cfg(test)]
mod tests {
    use crate::infra::Infra;
    use crate::schema::operation::{Operation, RailjsonObject};
    use crate::schema::SwitchType;
    use crate::views::tests::create_test_client;
    use rocket::http::{ContentType, Status};
    use serde::Deserialize;

    #[test]
    fn infra_list() {
        let client = create_test_client();
        let response = client.get("/infra").dispatch();
        assert_eq!(response.status(), Status::Ok);
    }

    #[test]
    fn infra_create_delete() {
        let client = create_test_client();
        let create_infra_response = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"test"}"#)
            .dispatch();

        assert_eq!(create_infra_response.status(), Status::Created);

        let body = create_infra_response.into_string().unwrap();
        let infra: Infra = serde_json::from_str(body.as_str()).unwrap();

        assert_eq!(infra.name, "test");

        let delete_infra_response = client.delete(format!("/infra/{}", infra.id)).dispatch();

        assert_eq!(delete_infra_response.status(), Status::NoContent);
    }

    #[test]
    fn infra_get() {
        let client = create_test_client();
        let create_infra_response = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"test"}"#)
            .dispatch();

        assert_eq!(create_infra_response.status(), Status::Created);

        let body = create_infra_response.into_string().unwrap();
        let infra: Infra = serde_json::from_str(body.as_str()).unwrap();

        assert_eq!(infra.name, "test");

        let get_infra_response = client.get(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(get_infra_response.status(), Status::Ok);

        let delete_infra_response = client.delete(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra_response.status(), Status::NoContent);

        let delete_infra_response = client.get(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra_response.status(), Status::NotFound);
    }

    #[test]
    fn infra_rename() {
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"test"}"#)
            .dispatch();
        assert_eq!(create_infra.status(), Status::Created);
        let body = create_infra.into_string().unwrap();
        let infra: Infra = serde_json::from_str(body.as_str()).unwrap();
        assert_eq!(infra.name, "test");
        let put_infra_response = client
            .put(format!("/infra/{}", infra.id))
            .body(r#"{"name":"rename_test"}"#)
            .dispatch();
        assert_eq!(put_infra_response.status(), Status::Ok);
    }

    #[derive(Deserialize)]
    struct InfraRefreshedResponse {
        infra_refreshed: Vec<i32>,
    }

    #[test]
    fn infra_refresh() {
        let client = create_test_client();
        let create_infra_response = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"refresh_test"}"#)
            .dispatch();

        assert_eq!(create_infra_response.status(), Status::Created);

        let body_infra = create_infra_response.into_string();
        assert!(body_infra.is_some());
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        assert_eq!(infra.name, "refresh_test");

        // Check that no infra is really refreshed
        let infra_refresh_response = client
            .post(format!("/infra/refresh/?infras={}", infra.id))
            .dispatch();
        assert_eq!(infra_refresh_response.status(), Status::Ok);

        let body_refresh = infra_refresh_response.into_string();
        assert!(body_refresh.is_some());

        let refresh: InfraRefreshedResponse =
            serde_json::from_str(body_refresh.unwrap().as_str()).unwrap();
        assert!(refresh.infra_refreshed.is_empty());

        let delete_infra = client.delete(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra.status(), Status::NoContent);
    }

    #[test]
    fn infra_refresh_force() {
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"refresh_test"}"#)
            .dispatch();

        assert_eq!(create_infra.status(), Status::Created);

        let body_infra = create_infra.into_string();
        assert!(body_infra.is_some());
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        assert_eq!(infra.name, "refresh_test");

        let infra_no_refresh = client
            .post(format!("/infra/refresh/?force=true&infras={}", infra.id))
            .dispatch();
        assert_eq!(infra_no_refresh.status(), Status::Ok);

        let body_refresh = infra_no_refresh.into_string();
        assert!(body_refresh.is_some());

        let refresh: InfraRefreshedResponse =
            serde_json::from_str(body_refresh.unwrap().as_str()).unwrap();
        assert!(refresh.infra_refreshed.contains(&infra.id));

        let delete_infra = client.delete(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra.status(), Status::NoContent);
    }

    #[test]
    fn infra_get_switch_types() {
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"get_switch_types"}"#)
            .dispatch();

        assert_eq!(create_infra.status(), Status::Created);

        let body_infra = create_infra.into_string();
        assert!(body_infra.is_some());
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();

        let switch_type = SwitchType::default();
        let operation = Operation::Create(Box::new(RailjsonObject::SwitchType {
            railjson: switch_type.clone(),
        }));

        let create_switch_type = client
            .post(format!("/infra/{}/", infra.id))
            .header(ContentType::JSON)
            .body(serde_json::to_string(&vec![operation]).unwrap())
            .dispatch();
        assert_eq!(create_switch_type.status(), Status::Ok);

        let get_switch_types = client
            .get(format!("/infra/{}/switch_types/", infra.id))
            .dispatch();
        assert_eq!(get_switch_types.status(), Status::Ok);
        let body_switch_types = get_switch_types.into_string();
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
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"lock test"}"#)
            .dispatch();
        assert_eq!(create_infra.status(), Status::Created);

        let body_infra = create_infra.into_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        assert!(!infra.locked);

        let lock_query = client.post(format!("/infra/{}/lock/", infra.id)).dispatch();
        assert_eq!(lock_query.status(), Status::NoContent);

        let body_infra = client
            .get(format!("/infra/{}", infra.id))
            .dispatch()
            .into_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        assert!(infra.locked);

        let unlock_query = client
            .post(format!("/infra/{}/unlock/", infra.id))
            .dispatch();
        assert_eq!(unlock_query.status(), Status::NoContent);

        let body_infra = client
            .get(format!("/infra/{}", infra.id))
            .dispatch()
            .into_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        assert!(!infra.locked);

        let delete_infra = client.delete(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra.status(), Status::NoContent);
    }
}
