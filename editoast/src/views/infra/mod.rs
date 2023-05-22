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
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::map::{self, MapLayers};
use crate::models::infra::INFRA_VERSION;
use crate::models::{
    Create, Delete, Infra, List as ModelList, NoParams, Retrieve, Update, RAILJSON_VERSION,
};
use crate::schema::{ObjectType, SwitchType};
use crate::views::pagination::{PaginatedResponse, PaginationQueryParam};
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{block, scope, Data, Json, Path, Query};
use actix_web::{delete, get, post, put, HttpResponse, Responder};
use chashmap::CHashMap;
use chrono::Utc;
use diesel::sql_types::{BigInt, Text};
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use editoast_derive::EditoastError;
use futures::future::join_all;
use futures::Future;
use redis::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value as JsonValue};
use std::result::Result as StdResult;
use strum::IntoEnumIterator;
use thiserror::Error;
use uuid::Uuid;

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

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra")]
pub enum InfraApiError {
    /// Couldn't find the infra with the given id
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { infra_id: i64 },
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InfraForm {
    pub name: String,
}

impl From<InfraForm> for Infra {
    fn from(infra: InfraForm) -> Self {
        Infra {
            name: Some(infra.name),
            owner: Some(Uuid::nil()),
            created: Some(Utc::now().naive_utc()),
            railjson_version: Some(RAILJSON_VERSION.into()),
            version: Some(INFRA_VERSION.into()),
            generated_version: Some(Some(INFRA_VERSION.into())),
            locked: Some(false),
            ..Default::default()
        }
    }
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
struct SpeedLimitTags {
    #[diesel(sql_type = Text)]
    tag: String,
}

#[derive(QueryableByName, Debug, Clone, Serialize, Deserialize)]
struct Voltage {
    #[diesel(sql_type = Text)]
    voltage: String,
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
                let infra = match Infra::retrieve_for_update(&mut conn, *id) {
                    Ok(infra) => infra,
                    Err(_) => return Err(InfraApiError::NotFound { infra_id: *id }.into()),
                };
                infras_list.push(infra);
            }
        }

        // Refresh each infras
        let mut refreshed_infra = vec![];

        for infra in infras_list {
            let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra)?;
            if infra.refresh(&mut conn, query_params.force, &infra_cache)? {
                refreshed_infra.push(infra.id.unwrap());
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
async fn list(
    db_pool: Data<DbPool>,
    pagination_params: Query<PaginationQueryParam>,
) -> Result<Json<PaginatedResponse<Infra>>> {
    let page = pagination_params.page;
    let per_page = pagination_params.page_size.unwrap_or(25).max(10);
    let infras = Infra::list(db_pool, page, per_page, NoParams).await?;
    Ok(Json(infras))
}

/// Return a specific infra
#[get("")]
async fn get(db_pool: Data<DbPool>, infra: Path<i64>) -> Result<Json<Infra>> {
    let infra_id = infra.into_inner();

    match Infra::retrieve(db_pool.clone(), infra_id).await? {
        Some(infra) => Ok(Json(infra)),
        None => Err(InfraApiError::NotFound { infra_id }.into()),
    }
}

/// Create an infra
#[post("")]
async fn create(db_pool: Data<DbPool>, data: Json<InfraForm>) -> Result<impl Responder> {
    let infra: Infra = data.into_inner().into();
    let infra = infra.create(db_pool).await?;
    Ok(HttpResponse::Created().json(infra))
}

/// Duplicate an infra
#[post("/clone")]
async fn clone(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
    new_name: Query<InfraForm>,
) -> Result<Json<i64>> {
    let db_pool_ref = db_pool.clone();
    let mut futures = Vec::<Pin<Box<dyn Future<Output = _>>>>::new();

    let infra = infra.into_inner();
    let name = new_name.name.clone();
    let cloned_infra = Infra::clone(infra, db_pool_ref.clone(), name).await?;

    for object in ObjectType::iter() {
        let model_table = object.get_table();
        let db_pool_ref = db_pool.clone();
        let model = block::<_, Result<_>>(move || {
            let mut conn = db_pool_ref.get()?;
            sql_query(format!(
                "INSERT INTO {model_table}(id, obj_id,data,infra_id) SELECT nextval('{model_table}_id_seq'), obj_id,data,$1 FROM {model_table} WHERE infra_id=$2"
            ))
            .bind::<BigInt, _>(cloned_infra.id.unwrap())
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
                .bind::<BigInt, _>(cloned_infra.id.unwrap())
                .bind::<BigInt, _>(infra)
                .execute(&mut conn).map_err(|err| err.into())
            });
            futures.push(Box::pin(layer));
        }
    }

    let res = join_all(futures).await;
    let res: Vec<_> = res.into_iter().collect::<StdResult<_, _>>().unwrap();
    res.into_iter().collect::<Result<Vec<usize>>>()?;

    Ok(Json(cloned_infra.id.unwrap()))
}

/// Delete an infra
#[delete("")]
async fn delete(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<HttpResponse> {
    let infra = infra.into_inner();
    assert!(Infra::delete(db_pool.clone(), infra).await?);
    infra_caches.remove(&infra);
    Ok(HttpResponse::NoContent().finish())
}

/// Patch form for a project
#[derive(Serialize, Deserialize)]
struct InfraPatchForm {
    pub name: Option<String>,
}

impl InfraPatchForm {
    fn into_infra(self, infra_id: i64) -> Infra {
        Infra {
            id: Some(infra_id),
            name: self.name,
            ..Default::default()
        }
    }
}

/// Update an infra name
#[put("")]
async fn rename(
    db_pool: Data<DbPool>,
    infra: Path<i64>,
    new_name: Json<InfraPatchForm>,
) -> Result<Json<Infra>> {
    let infra_id = infra.into_inner();
    let infra = new_name.into_inner().into_infra(infra_id);
    let infra = match infra.update(db_pool.clone(), infra_id).await? {
        Some(infra) => infra,
        None => return Err(InfraApiError::NotFound { infra_id }.into()),
    };
    Ok(Json(infra))
}

/// Return the railjson list of switch types
#[get("/switch_types")]
async fn get_switch_types(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<Json<Vec<SwitchType>>> {
    let infra_id = infra.into_inner();
    let infra = match Infra::retrieve(db_pool.clone(), infra_id).await? {
        Some(infra) => infra,
        None => return Err(InfraApiError::NotFound { infra_id }.into()),
    };
    block(move || {
        let mut conn = db_pool.get()?;
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

#[derive(Debug, Clone, Deserialize)]
struct GetVoltagesQueryParams {
    #[serde(default)]
    include_rolling_stock_modes: bool,
}

/// Returns the set of voltages for a given infra and/or rolling_stocks modes.
/// If include_rolling_stocks_modes is true, it returns also rolling_stocks modes.
#[get("/voltages")]
async fn get_voltages(
    infra: Path<i64>,
    param: Query<GetVoltagesQueryParams>,
    db_pool: Data<DbPool>,
) -> Result<Json<Vec<String>>> {
    let infra = infra.into_inner();
    let include_rolling_stock_modes = param.into_inner().include_rolling_stock_modes;
    let voltages: Vec<Voltage> = block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        let query = if !include_rolling_stock_modes {
            include_str!("sql/get_voltages_without_rolling_stocks_modes.sql")
        } else {
            include_str!("sql/get_voltages_with_rolling_stocks_modes.sql")
        };
        match sql_query(query).bind::<BigInt, _>(infra).load(&mut conn) {
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
    let infra_id = infra.into_inner();
    block::<_, Result<()>>(move || {
        let mut conn = db_pool.get()?;
        let mut infra = match Infra::retrieve_for_update(&mut conn, infra_id) {
            Ok(infra) => infra,
            Err(_) => return Err(InfraApiError::NotFound { infra_id }.into()),
        };
        infra.locked = Some(true);
        infra.update_conn(&mut conn, infra_id)?;
        Ok(())
    })
    .await
    .unwrap()?;
    Ok(HttpResponse::NoContent().finish())
}

/// Unlock an infra
#[post("/unlock")]
async fn unlock(infra: Path<i64>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let infra_id = infra.into_inner();
    block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        let mut infra = match Infra::retrieve_for_update(&mut conn, infra_id) {
            Ok(infra) => infra,
            Err(_) => return Err(InfraApiError::NotFound { infra_id }.into()),
        };
        infra.locked = Some(false);
        infra.update_conn(&mut conn, infra_id)?;
        Ok(())
    })
    .await
    .unwrap()?;
    Ok(HttpResponse::NoContent().finish())
}

#[cfg(test)]
pub mod tests {
    use crate::models::infra::INFRA_VERSION;
    use crate::models::rolling_stock::tests::get_other_rolling_stock;
    use crate::models::{Infra, RollingStockModel, RAILJSON_VERSION};
    use crate::schema::operation::{Operation, RailjsonObject};
    use crate::schema::{Catenary, SpeedSection, SwitchType};
    use crate::views::rolling_stocks::tests::rolling_stock_delete_request;
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
            .uri(format!("/infra/{}/clone/?name=cloned_infra/", infra.id.unwrap()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let cloned_infra_id: i64 = read_body_json(response).await;
        let response = call_service(&app, delete_infra_request(infra.id.unwrap())).await;
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
    async fn default_infra_create_delete() {
        let app = create_test_service().await;
        let response = call_service(&app, create_infra_request("create_infra_test")).await;
        assert_eq!(response.status(), StatusCode::CREATED);
        let infra: Infra = read_body_json(response).await;
        assert_eq!(infra.name.unwrap(), "create_infra_test");
        assert_eq!(infra.railjson_version.unwrap(), RAILJSON_VERSION);
        assert_eq!(infra.version.unwrap(), INFRA_VERSION);
        assert_eq!(infra.generated_version.unwrap().unwrap(), INFRA_VERSION);
        assert!(!infra.locked.unwrap());

        let response = call_service(&app, delete_infra_request(infra.id.unwrap())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_get() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_infra_test")).await;

        let req = TestRequest::get()
            .uri(format!("/infra/{}", infra.id.unwrap()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let req = TestRequest::delete()
            .uri(format!("/infra/{}", infra.id.unwrap()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_rename() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("infra_rename_test")).await;
        let req = TestRequest::put()
            .uri(format!("/infra/{}", infra.id.unwrap()).as_str())
            .set_json(json!({"name": "rename_test"}))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let infra: Infra = read_body_json(response).await;
        assert_eq!(infra.name.unwrap(), "rename_test");

        let response = call_service(&app, delete_infra_request(infra.id.unwrap())).await;
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
            .uri(format!("/infra/refresh/?infras={}", infra.id.unwrap()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let refreshed_infras: InfraRefreshedResponse = read_body_json(response).await;
        assert!(refreshed_infras.infra_refreshed.is_empty());

        let response = call_service(&app, delete_infra_request(infra.id.unwrap())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_refresh_force() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("refresh_force_infra_test")).await;

        let req = TestRequest::post()
            .uri(format!("/infra/refresh/?infras={}&force=true", infra.id.unwrap()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let refreshed_infras: InfraRefreshedResponse = read_body_json(response).await;
        assert!(refreshed_infras
            .infra_refreshed
            .contains(&infra.id.unwrap()));

        let response = call_service(&app, delete_infra_request(infra.id.unwrap())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_get_speed_limit_tags() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_speed_tags_test")).await;

        let req = create_object_request(infra.id.unwrap(), SpeedSection::default().into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = TestRequest::get()
            .uri(format!("/infra/{}/speed_limit_tags/", infra.id.unwrap()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        let response = call_service(&app, delete_infra_request(infra.id.unwrap())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_get_voltages() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_voltages_test")).await;

        let test_cases = vec![true, false];
        // Create catenary
        let catenary = Catenary {
            id: "test".into(),
            voltage: "0".into(),
            track_ranges: vec![],
        };

        let req = create_object_request(infra.id.unwrap(), catenary.into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        // Create rolling_stock
        let rolling_stock: RollingStockModel = get_other_rolling_stock();
        let post_response = call_service(
            &app,
            TestRequest::post()
                .uri("/rolling_stock")
                .set_json(rolling_stock)
                .to_request(),
        )
        .await;
        let rolling_stock: RollingStockModel = read_body_json(post_response).await;
        let rolling_stock_id = rolling_stock.id.unwrap();

        for include_rolling_stock_modes in test_cases {
            let req = TestRequest::get()
                .uri(
                    format!(
                        "/infra/{}/voltages/?include_rolling_stock_modes={}",
                        infra.id.unwrap(),
                        include_rolling_stock_modes
                    )
                    .as_str(),
                )
                .to_request();
            let response = call_service(&app, req).await;
            assert_eq!(response.status(), StatusCode::OK);

            if !include_rolling_stock_modes {
                let voltages: Vec<String> = read_body_json(response).await;
                assert_eq!(voltages[0], "0");
                assert_eq!(voltages.len(), 1);
            } else {
                let voltages: Vec<String> = read_body_json(response).await;
                assert_eq!(voltages[1], "25000");
            }
        }
        // Delete Rolling_stock
        let delete_request = rolling_stock_delete_request(rolling_stock_id);
        let delete_response = call_service(&app, delete_request).await;
        assert_eq!(delete_response.status(), StatusCode::NO_CONTENT);
        let response = call_service(&app, delete_infra_request(infra.id.unwrap())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_get_switch_types() {
        let app = create_test_service().await;
        let infra: Infra =
            call_and_read_body_json(&app, create_infra_request("get_switch_types_test")).await;

        let switch_type = SwitchType::default();
        let switch_type_id = switch_type.id.clone();
        let req = create_object_request(infra.id.unwrap(), switch_type.into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = TestRequest::get()
            .uri(format!("/infra/{}/switch_types/", infra.id.unwrap()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let switch_types: Vec<SwitchType> = read_body_json(response).await;
        assert_eq!(switch_types.len(), 1);
        assert_eq!(switch_types[0].id, switch_type_id);

        let response = call_service(&app, delete_infra_request(infra.id.unwrap())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[actix_test]
    async fn infra_lock() {
        let app = create_test_service().await;
        let infra: Infra = call_and_read_body_json(&app, create_infra_request("lock_test")).await;
        assert!(!infra.locked.unwrap());

        // Lock infra
        let req = TestRequest::post()
            .uri(format!("/infra/{}/lock/", infra.id.unwrap()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        // Check lock
        let req = TestRequest::get()
            .uri(format!("/infra/{}", infra.id.unwrap()).as_str())
            .to_request();
        let infra: Infra = call_and_read_body_json(&app, req).await;
        assert!(infra.locked.unwrap());

        // Unlock infra
        let req = TestRequest::post()
            .uri(format!("/infra/{}/unlock/", infra.id.unwrap()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        // Check lock
        let req = TestRequest::get()
            .uri(format!("/infra/{}", infra.id.unwrap()).as_str())
            .to_request();
        let infra: Infra = call_and_read_body_json(&app, req).await;
        assert!(!infra.locked.unwrap());

        let response = call_service(&app, delete_infra_request(infra.id.unwrap())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }
}
