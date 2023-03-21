mod attached;
mod edition;
mod errors;
mod lines;
mod objects;
mod pathfinding;
mod railjson;
mod routes;

use std::pin::Pin;

use self::edition::edit;
use super::params::List;
use crate::error::Result;
use crate::infra::{Infra, InfraName};
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::map::{self, MapLayers};
use crate::schema::{ObjectType, SwitchType};
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{block, scope, Data, Json, Path, Query};
use actix_web::{delete, get, post, put, HttpResponse, Responder};
use chashmap::CHashMap;
use diesel::sql_types::{BigInt, Double, Text};
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use futures::future::join_all;
use futures::Future;
use redis::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use std::result::Result as StdResult;
use strum::IntoEnumIterator;

/// Return `/infra` routes
pub fn routes() -> impl HttpServiceFactory {
    scope("/infra")
        .service((list, create, refresh, railjson::routes()))
        .service(
            scope("/{infra}")
                .service((
                    get,
                    delete,
                    clone,
                    edit,
                    rename,
                    lock,
                    unlock,
                    get_switch_types,
                    get_speed_limit_tags,
                    get_voltages,
                ))
                .service((
                    errors::routes(),
                    objects::routes(),
                    lines::routes(),
                    routes::routes(),
                    pathfinding::routes(),
                    attached::routes(),
                )),
        )
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

#[derive(Debug, Deserialize)]
struct RefreshQueryParams {
    #[serde(default)]
    force: bool,
    #[serde(default)]
    infras: List<i64>,
}

/// Refresh infra generated data
#[post("/refresh")]
async fn refresh(
    db_pool: Data<DbPool>,
    redis_client: Data<Client>,
    query_params: Query<RefreshQueryParams>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    map_layers: Data<MapLayers>,
) -> Result<Json<JsonValue>> {
    let refreshed_infra = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        // Use a transaction to give scope to infra list lock
        let mut infras_list = vec![];
        let infras = &query_params.infras.0;

        if infras.is_empty() {
            // Retrieve all available infra
            for infra in Infra::list_for_update(&mut conn) {
                infras_list.push(infra);
            }
        } else {
            // Retrieve given infras
            for id in infras.iter() {
                infras_list.push(Infra::retrieve_for_update(&mut conn, *id)?);
            }
        }

        // Refresh each infras
        let mut refreshed_infra = vec![];

        for infra in infras_list {
            let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra)?;
            if infra.refresh(&mut conn, query_params.force, &infra_cache)? {
                refreshed_infra.push(infra.id);
            }
        }
        Ok(refreshed_infra)
    })
    .await
    .unwrap()?;
    let mut conn = redis_client.get_tokio_connection_manager().await.unwrap();
    for infra_id in refreshed_infra.iter() {
        map::invalidate_all(
            &mut conn,
            &map_layers.layers.keys().cloned().collect(),
            *infra_id,
        )
        .await;
    }

    Ok(Json(json!({ "infra_refreshed": refreshed_infra })))
}

/// Return a list of infras
#[get("")]
async fn list(db_pool: Data<DbPool>) -> Result<Json<Vec<Infra>>> {
    block(move || {
        let mut conn = db_pool.get()?;
        Ok(Json(Infra::list(&mut conn)))
    })
    .await
    .unwrap()
}

/// Return a specific infra
#[get("")]
async fn get(db_pool: Data<DbPool>, infra: Path<i64>) -> Result<Json<Infra>> {
    let infra = infra.into_inner();
    block(move || {
        let mut conn = db_pool.get()?;
        Ok(Json(Infra::retrieve(&mut conn, infra)?))
    })
    .await
    .unwrap()
}

/// Create an infra
#[post("")]
async fn create(db_pool: Data<DbPool>, data: Json<InfraName>) -> Result<impl Responder> {
    let infra = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        Infra::create(&data.name, &mut conn)
    })
    .await
    .unwrap()?;
    Ok(HttpResponse::Created().json(infra))
}

/// Duplicate an infra
#[post("/clone")]
async fn clone(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
    new_name: Query<InfraName>,
) -> Result<Json<i64>> {
    let db_pool_ref = db_pool.clone();
    let mut futures = Vec::<Pin<Box<dyn Future<Output = _>>>>::new();

    let infra = infra.into_inner();
    let cloned_infra = block::<_, Result<_>>(move || {
        let name = new_name.name.clone();
        let mut conn = db_pool_ref.get()?;
        Infra::clone(infra, &mut conn, name)
    })
    .await
    .unwrap()?;

    for object in ObjectType::iter() {
        let model_table = object.get_table();
        let db_pool_ref = db_pool.clone();
        let model = block::<_, Result<_>>(move || {
            let mut conn = db_pool_ref.get()?;
            sql_query(format!(
                "INSERT INTO {model_table}(id, obj_id,data,infra_id) SELECT nextval('{model_table}_id_seq'), obj_id,data,$1 FROM {model_table} WHERE infra_id=$2"
            ))
            .bind::<BigInt, _>(cloned_infra.id)
            .bind::<BigInt, _>(infra)
            .execute(&mut conn).map_err(|err| err.into())
        });
        futures.push(Box::pin(model));

        if object != ObjectType::SwitchType && object != ObjectType::Route {
            let layer_table = object.get_geometry_layer_table().unwrap().to_string();
            let db_pool_ref = db_pool.clone();
            let layer = block::<_, Result<_>>(move || {
                let mut conn = db_pool_ref.get()?;
                sql_query(format!(
                    "INSERT INTO {layer_table}(id, obj_id,geographic,schematic,infra_id) SELECT nextval('{layer_table}_id_seq'), obj_id,geographic,schematic,$1 FROM {layer_table} WHERE infra_id=$2"
                ))
                .bind::<BigInt, _>(cloned_infra.id)
                .bind::<BigInt, _>(infra)
                .execute(&mut conn).map_err(|err| err.into())
            });
            futures.push(Box::pin(layer));
        }
    }

    let res = join_all(futures).await;
    let res: Vec<_> = res.into_iter().collect::<StdResult<_, _>>().unwrap();
    res.into_iter().collect::<Result<Vec<usize>>>()?;

    Ok(Json(cloned_infra.id))
}

/// Delete an infra
#[delete("")]
async fn delete(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<HttpResponse> {
    let infra = infra.into_inner();
    block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        Infra::delete(infra, &mut conn)?;
        infra_caches.remove(&infra);
        Ok(())
    })
    .await
    .unwrap()?;
    Ok(HttpResponse::NoContent().finish())
}

/// Update an infra name
#[put("")]
async fn rename(
    db_pool: Data<DbPool>,
    infra: Path<i64>,
    new_name: Json<InfraName>,
) -> Result<Json<Infra>> {
    let infra = infra.into_inner();
    block(move || {
        let mut conn = db_pool.get()?;
        let name = new_name.name.clone();
        Ok(Json(Infra::rename(&mut conn, infra, name)?))
    })
    .await
    .unwrap()
}

/// Return the railjson list of switch types
#[get("/switch_types")]
async fn get_switch_types(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<Json<Vec<SwitchType>>> {
    let infra = infra.into_inner();
    block(move || {
        let mut conn = db_pool.get()?;
        let infra = Infra::retrieve(&mut conn, infra)?;
        let infra = InfraCache::get_or_load(&mut conn, &infra_caches, &infra)?;
        Ok(Json(
            infra
                .switch_types()
                .values()
                .map(ObjectCache::unwrap_switch_type)
                .cloned()
                .collect(),
        ))
    })
    .await
    .unwrap()
}

/// Returns the set of speed limit tags for a given infra
#[get("/speed_limit_tags")]
async fn get_speed_limit_tags(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
) -> Result<Json<Vec<String>>> {
    let infra = infra.into_inner();
    let speed_limits_tags: Vec<SpeedLimitTags> = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        Ok(sql_query(
            "SELECT DISTINCT jsonb_object_keys(data->'speed_limit_by_tag') AS tag
        FROM osrd_infra_speedsectionmodel
        WHERE infra_id = $1
        ORDER BY tag",
        )
        .bind::<BigInt, _>(infra)
        .load(&mut conn)?)
    })
    .await
    .unwrap()?;
    Ok(Json(
        speed_limits_tags.into_iter().map(|el| (el.tag)).collect(),
    ))
}

/// Returns the set of voltages for a given infra
#[get("/voltages")]
async fn get_voltages(infra: Path<i64>, db_pool: Data<DbPool>) -> Result<Json<Vec<f64>>> {
    let infra = infra.into_inner();
    let voltages: Vec<Voltage> = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        match sql_query(
            "SELECT DISTINCT ((data->'voltage')->>0)::float AS voltage
                FROM osrd_infra_catenarymodel
                WHERE infra_id = $1
                ORDER BY voltage",
        )
        .bind::<BigInt, _>(infra)
        .load(&mut conn)
        {
            Ok(voltages) => Ok(voltages),
            Err(err) => Err(err.into()),
        }
    })
    .await
    .unwrap()?;
    Ok(Json(voltages.into_iter().map(|el| (el.voltage)).collect()))
}

/// Lock an infra
#[post("/lock")]
async fn lock(infra: Path<i64>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let infra = infra.into_inner();
    block::<_, Result<()>>(move || {
        let mut conn = db_pool.get()?;
        let infra = Infra::retrieve_for_update(&mut conn, infra)?;
        infra.set_locked(true, &mut conn)?;
        Ok(())
    })
    .await
    .unwrap()?;
    Ok(HttpResponse::NoContent().finish())
}

/// Unlock an infra
#[post("/unlock")]
async fn unlock(infra: Path<i64>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let infra = infra.into_inner();
    block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        let infra = Infra::retrieve_for_update(&mut conn, infra)?;
        infra.set_locked(false, &mut conn)?;
        Ok(())
    })
    .await
    .unwrap()?;
    Ok(HttpResponse::NoContent().finish())
}

#[cfg(test)]
pub mod tests {
    use crate::infra::Infra;
    use crate::schema::operation::{Operation, RailjsonObject};
    use crate::schema::{Catenary, SpeedSection, SwitchType};
    use crate::views::tests::create_test_service;
    use actix_http::Request;
    use actix_web::http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_and_read_body_json, call_service, read_body_json, TestRequest};
    use serde::Deserialize;
    use serde_json::json;

    pub fn create_infra_request(name: &'static str) -> Request {
        TestRequest::post()
            .uri("/infra")
            .set_json(json!({ "name": name }))
            .to_request()
    }

    pub fn delete_infra_request(infra_id: i64) -> Request {
        TestRequest::delete()
            .uri(format!("/infra/{infra_id}").as_str())
            .to_request()
    }

    pub fn create_object_request(infra_id: i64, obj: RailjsonObject) -> Request {
        let operation = Operation::Create(Box::new(obj));
        TestRequest::post()
            .uri(format!("/infra/{infra_id}/").as_str())
            .set_json(json!([operation]))
            .to_request()
    }

    #[actix_test]
    async fn infra_clone() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("clone_infra_test")).await;
        let req = TestRequest::post()
            .uri(format!("/infra/{}/clone/?name=cloned_infra/", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let cloned_infra_id: i64 = read_body_json(response).await;
        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        let response = call_service(&app, delete_infra_request(cloned_infra_id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_list() {
        let app = create_test_service().await;
        let req = TestRequest::get().uri("/infra/").to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[actix_test]
    async fn infra_create_delete() {
        let app = create_test_service().await;
        let response = call_service(&app, create_infra_request("create_infra_test")).await;
        assert_eq!(response.status(), StatusCode::CREATED);
        let infra: Infra = read_body_json(response).await;
        assert_eq!(infra.name, "create_infra_test");

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_get() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_infra_test")).await;

        let req = TestRequest::get()
            .uri(format!("/infra/{}", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let req = TestRequest::delete()
            .uri(format!("/infra/{}", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_test]
    async fn infra_rename() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("infra_rename_test")).await;

        let req = TestRequest::put()
            .uri(format!("/infra/{}", infra.id).as_str())
            .set_json(json!({"name": "rename_test"}))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[derive(Deserialize)]
    struct InfraRefreshedResponse {
        infra_refreshed: Vec<i64>,
    }

    #[actix_test]
    async fn infra_refresh() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("reresh_infra_test")).await;

        let req = TestRequest::post()
            .uri(format!("/infra/refresh/?infras={}", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let refreshed_infras: InfraRefreshedResponse = read_body_json(response).await;
        assert!(refreshed_infras.infra_refreshed.is_empty());

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_refresh_force() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("refresh_force_infra_test")).await;

        let req = TestRequest::post()
            .uri(format!("/infra/refresh/?infras={}&force=true", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let refreshed_infras: InfraRefreshedResponse = read_body_json(response).await;
        assert!(refreshed_infras.infra_refreshed.contains(&infra.id));

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_get_speed_limit_tags() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_speed_tags_test")).await;

        let req = create_object_request(infra.id, SpeedSection::default().into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = TestRequest::get()
            .uri(format!("/infra/{}/speed_limit_tags/", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_get_voltages() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_voltages_test")).await;

        let catenary = Catenary {
            id: "test".into(),
            voltage: "0".into(),
            track_ranges: vec![],
        };
        let req = create_object_request(infra.id, catenary.into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = TestRequest::get()
            .uri(format!("/infra/{}/voltages/", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_get_switch_types() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_switch_types_test")).await;

        let switch_type = SwitchType::default();
        let switch_type_id = switch_type.id.clone();
        let req = create_object_request(infra.id, switch_type.into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = TestRequest::get()
            .uri(format!("/infra/{}/switch_types/", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let switch_types: Vec<SwitchType> = read_body_json(response).await;
        assert_eq!(switch_types.len(), 1);
        assert_eq!(switch_types[0].id, switch_type_id);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_lock() {
        let app = create_test_service().await;
        let infra: Infra = call_and_read_body_json(&app, create_infra_request("lock_test")).await;
        assert!(!infra.locked);

        // Lock infra
        let req = TestRequest::post()
            .uri(format!("/infra/{}/lock/", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        // Check lock
        let req = TestRequest::get()
            .uri(format!("/infra/{}", infra.id).as_str())
            .to_request();
        let infra: Infra = call_and_read_body_json(&app, req).await;
        assert!(infra.locked);

        // Unlock infra
        let req = TestRequest::post()
            .uri(format!("/infra/{}/unlock/", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        // Check lock
        let req = TestRequest::get()
            .uri(format!("/infra/{}", infra.id).as_str())
            .to_request();
        let infra: Infra = call_and_read_body_json(&app, req).await;
        assert!(!infra.locked);

        let response = call_service(&app, delete_infra_request(infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
