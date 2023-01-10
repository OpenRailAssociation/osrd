mod edition;
mod errors;
mod objects;
mod railjson;

use std::sync::Arc;

use super::params::List;
use crate::api_error::{ApiError, ApiResult};
use crate::chartos;
use crate::client::ChartosConfig;
use crate::db_connection::DBConnection;
use crate::infra::{Infra, InfraName};
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::schema::operation::{Operation, OperationResult};
use crate::schema::InfraErrorType;
use crate::schema::SwitchType;
use chashmap::CHashMap;
use diesel::sql_types::{Double, Integer, Text};
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use errors::{get_paginated_infra_errors, Level};
use objects::get_objects;
use railjson::{get_railjson, post_railjson};
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::{json, Error as JsonError, Json, Value as JsonValue};
use rocket::{routes, Route, State};
use serde::{Deserialize, Serialize};
use strum::VariantNames;
use thiserror::Error;

#[derive(Debug, Error)]
enum ListErrorsErrors {
    #[error("Wrong Error type provided")]
    WrongErrorTypeProvided,
}

impl ApiError for ListErrorsErrors {
    fn get_status(&self) -> Status {
        Status::BadRequest
    }

    fn get_type(&self) -> &'static str {
        match self {
            ListErrorsErrors::WrongErrorTypeProvided => "editoast:infra:WrongErrorTypeProvided",
        }
    }
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
struct SpeedLimitTags {
    #[sql_type = "Text"]
    tag: String,
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
struct Voltage {
    #[sql_type = "Double"]
    voltage: f64,
}

pub fn routes() -> Vec<Route> {
    routes![
        list,
        get,
        edit,
        create,
        delete,
        get_railjson,
        post_railjson,
        refresh,
        list_errors,
        get_switch_types,
        get_speed_limit_tags,
        get_voltages,
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

/// Check if the query parameter error_type exist
fn check_error_type_query(param: &String) -> bool {
    InfraErrorType::VARIANTS
        .iter()
        .any(|x| &x.to_string() == param)
}

/// Return the list of errors of an infra
#[get("/<infra>/errors?<page>&<page_size>&<error_type>&<object_id>&<level>")]
async fn list_errors(
    infra: i32,
    page: Option<i64>,
    page_size: Option<i64>,
    level: Option<Level>,
    error_type: Option<String>,
    object_id: Option<String>,
    conn: DBConnection,
) -> ApiResult<Custom<JsonValue>> {
    if let Some(error_type) = &error_type {
        if !check_error_type_query(error_type) {
            return Err(ListErrorsErrors::WrongErrorTypeProvided.into());
        }
    }
    let page = page.unwrap_or_default().max(1);
    let per_page = page_size.unwrap_or(25).max(10);
    let level = level.unwrap_or_default();
    let (infra_errors, count) = conn
        .run(move |conn| {
            get_paginated_infra_errors(conn, infra, page, per_page, level, error_type, object_id)
        })
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

/// Returns the set of speed limit tags for a given infra
#[get("/<infra>/speed_limit_tags")]
async fn get_speed_limit_tags(infra: i32, conn: DBConnection) -> ApiResult<Custom<JsonValue>> {
    let speed_limits_tags: Vec<SpeedLimitTags> = conn
        .run(move |conn| {
            sql_query(
                "SELECT DISTINCT jsonb_object_keys(data->'speed_limit_by_tag') AS tag
        FROM osrd_infra_speedsectionmodel
        WHERE infra_id = $1
        ORDER BY tag",
            )
            .bind::<Integer, _>(infra)
            .load(conn)
        })
        .await?;
    let speed_limits_tags: Vec<String> = speed_limits_tags.into_iter().map(|el| (el.tag)).collect();

    Ok(Custom(
        Status::Ok,
        serde_json::to_value(speed_limits_tags).unwrap(),
    ))
}

/// Returns the set of voltages for a given infra
#[get("/<infra>/voltages")]
async fn get_voltages(infra: i32, conn: DBConnection) -> ApiResult<Custom<JsonValue>> {
    let voltages: Vec<Voltage> = conn
        .run(move |conn| {
            sql_query(
                "SELECT DISTINCT ((data->'voltage')->>0)::float AS voltage
                FROM osrd_infra_catenarymodel
                WHERE infra_id = $1
                ORDER BY voltage",
            )
            .bind::<Integer, _>(infra)
            .load(conn)
        })
        .await?;
    let voltages: Vec<f64> = voltages.into_iter().map(|el| (el.voltage)).collect();

    Ok(Custom(Status::Ok, serde_json::to_value(voltages).unwrap()))
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
    use crate::schema::{Catenary, SpeedSection, SwitchType};
    use crate::views::tests::create_test_client;
    use rocket::http::{ContentType, Status};
    use serde::Deserialize;

    use super::check_error_type_query;

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
        let delete_infra = client.delete(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra.status(), Status::NoContent);
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
    fn infra_get_speed_limit_tags() {
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"get_speed_tags"}"#)
            .dispatch();
        assert_eq!(create_infra.status(), Status::Created);
        let body_infra = create_infra.into_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        let speed_section = SpeedSection::default();
        let operation = Operation::Create(Box::new(RailjsonObject::SpeedSection {
            railjson: speed_section,
        }));
        client
            .post(format!("/infra/{}/", infra.id))
            .header(ContentType::JSON)
            .body(serde_json::to_string(&vec![operation]).unwrap())
            .dispatch();
        let get_speed_limit_tags = client
            .get(format!("/infra/{}/speed_limit_tags/", infra.id))
            .dispatch();
        assert_eq!(get_speed_limit_tags.status(), Status::Ok);
        let body_speed_limit_tags = get_speed_limit_tags.into_string();
        assert!(body_speed_limit_tags.is_some());
        let delete_infra = client.delete(format!("/infra/{}", infra.id)).dispatch();
        assert_eq!(delete_infra.status(), Status::NoContent);
    }

    #[test]
    fn infra_get_voltages() {
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"get_voltages"}"#)
            .dispatch();
        assert_eq!(create_infra.status(), Status::Created);
        let body_infra = create_infra.into_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        let catenaries = Catenary {
            id: "test".into(),
            voltage: "0".into(),
            track_ranges: vec![],
        };
        let operation = Operation::Create(Box::new(RailjsonObject::Catenary {
            railjson: catenaries,
        }));
        let create_catenaries = client
            .post(format!("/infra/{}/", infra.id))
            .header(ContentType::JSON)
            .body(serde_json::to_string(&vec![operation]).unwrap())
            .dispatch();
        assert_eq!(create_catenaries.status(), Status::Ok);
        let get_voltages = client
            .get(format!("/infra/{}/voltages/", infra.id))
            .dispatch();
        assert_eq!(get_voltages.status(), Status::Ok);
        let body_voltages = get_voltages.into_string();
        assert!(body_voltages.is_some());
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
    fn check_error_type() {
        let error_type = "invalid_reference".to_string();
        assert!(check_error_type_query(&error_type));
    }

    #[test]
    fn list_errors_get() {
        let client = create_test_client();
        let create_infra = client
            .post("/infra")
            .header(ContentType::JSON)
            .body(r#"{"name":"get_list_errors"}"#)
            .dispatch();
        assert_eq!(create_infra.status(), Status::Created);
        let body_infra = create_infra.into_string();
        let infra: Infra = serde_json::from_str(body_infra.unwrap().as_str()).unwrap();
        let error_type = "overlapping_track_links";
        let level = "warnings";

        let list_errors_query = client
            .get(format!(
                "/infra/{}/errors?&error_type={}&level={}",
                infra.id, error_type, level
            ))
            .dispatch();
        assert_eq!(list_errors_query.status(), Status::Ok);
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
