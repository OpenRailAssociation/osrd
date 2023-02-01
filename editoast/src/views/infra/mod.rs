mod edition;
mod errors;
mod objects;
mod pathfinding;
mod railjson;
mod routes;

use std::sync::Arc;

use super::params::List;
use crate::api_error::ApiResult;
use crate::db_connection::{DBConnection, RedisPool};
use crate::infra::{Infra, InfraName};
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::map::{self, MapLayers};
use crate::schema::SwitchType;
use chashmap::CHashMap;
use diesel::sql_types::{BigInt, Double, Text};
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::{json, Error as JsonError, Json, Value as JsonValue};
use rocket::{routes, Route, State};
use serde::{Deserialize, Serialize};

/// Return the endpoints routes of this module
pub fn routes() -> Vec<Route> {
    routes![
        list,
        get,
        create,
        delete,
        refresh,
        get_switch_types,
        get_speed_limit_tags,
        get_voltages,
        rename,
        lock,
        unlock,
    ]
    .into_iter()
    .chain(edition::routes())
    .chain(errors::routes())
    .chain(objects::routes())
    .chain(railjson::routes())
    .chain(routes::routes())
    .chain(pathfinding::routes())
    .collect()
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
struct SpeedLimitTags {
    #[diesel(sql_type = Text)]
    tag: String,
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
struct Voltage {
    #[diesel(sql_type = Double)]
    voltage: f64,
}

/// Refresh infra generated data
#[post("/refresh?<infras>&<force>")]
async fn refresh<'a>(
    conn: DBConnection,
    infras: List<'a, i64>,
    force: bool,
    infra_caches: &State<Arc<CHashMap<i64, InfraCache>>>,
    map_layers: &State<MapLayers>,
    redis_pool: &RedisPool,
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
        map::invalidate_all(
            redis_pool,
            &map_layers.layers.keys().cloned().collect(),
            *infra_id,
        )
        .await;
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
async fn get(conn: DBConnection, infra: i64) -> ApiResult<Custom<Json<Infra>>> {
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
    infra: i64,
    conn: DBConnection,
    infra_caches: &State<Arc<CHashMap<i64, InfraCache>>>,
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
    infra: i64,
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

/// Return the railjson list of switch types
#[get("/<infra>/switch_types")]
async fn get_switch_types(
    infra: i64,
    conn: DBConnection,
    infra_caches: &State<Arc<CHashMap<i64, InfraCache>>>,
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
async fn get_speed_limit_tags(infra: i64, conn: DBConnection) -> ApiResult<Custom<JsonValue>> {
    let speed_limits_tags: Vec<SpeedLimitTags> = conn
        .run(move |conn| {
            sql_query(
                "SELECT DISTINCT jsonb_object_keys(data->'speed_limit_by_tag') AS tag
        FROM osrd_infra_speedsectionmodel
        WHERE infra_id = $1
        ORDER BY tag",
            )
            .bind::<BigInt, _>(infra)
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
async fn get_voltages(infra: i64, conn: DBConnection) -> ApiResult<Custom<JsonValue>> {
    let voltages: Vec<Voltage> = conn
        .run(move |conn| {
            sql_query(
                "SELECT DISTINCT ((data->'voltage')->>0)::float AS voltage
                FROM osrd_infra_catenarymodel
                WHERE infra_id = $1
                ORDER BY voltage",
            )
            .bind::<BigInt, _>(infra)
            .load(conn)
        })
        .await?;
    let voltages: Vec<f64> = voltages.into_iter().map(|el| (el.voltage)).collect();

    Ok(Custom(Status::Ok, serde_json::to_value(voltages).unwrap()))
}

/// Lock an infra
#[post("/<infra>/lock")]
async fn lock(infra: i64, conn: DBConnection) -> ApiResult<Custom<JsonValue>> {
    conn.run(move |conn| {
        let infra = Infra::retrieve_for_update(conn, infra)?;
        infra.set_locked(true, conn)?;
        Ok(Custom(Status::NoContent, json!(null)))
    })
    .await
}

/// Unlock an infra
#[post("/<infra>/unlock")]
async fn unlock(infra: i64, conn: DBConnection) -> ApiResult<Custom<JsonValue>> {
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
        infra_refreshed: Vec<i64>,
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
