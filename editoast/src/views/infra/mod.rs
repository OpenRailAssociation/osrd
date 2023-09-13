mod attached;
mod edition;
mod errors;
mod lines;
mod objects;
mod pathfinding;
mod railjson;
mod routes;

use std::collections::HashMap;
use std::pin::Pin;

use super::params::List;
use crate::core::infra_loading::InfraLoadRequest;
use crate::core::infra_state::{InfraStateRequest, InfraStateResponse};
use crate::core::{AsCoreRequest, CoreClient};
use crate::error::Result;
use crate::infra_cache::{InfraCache, ObjectCache};
use crate::map::redis_utils::RedisClient;
use crate::map::{self, MapLayers};
use crate::models::infra::INFRA_VERSION;
use crate::models::{
    Create, Delete, Infra, List as ModelList, NoParams, Retrieve, Update, RAILJSON_VERSION,
};
use crate::schema::{ObjectType, SwitchType};
use crate::views::pagination::{PaginatedResponse, PaginationQueryParam};
use crate::DbPool;
use crate::{routes, schemas};
use actix_web::web::{Data, Json, Path, Query};
use actix_web::{delete, get, post, put, Either, HttpResponse, Responder};
use chashmap::CHashMap;
use chrono::Utc;
use diesel::sql_types::{BigInt, Text};
use diesel::{sql_query, QueryableByName};
use diesel_async::RunQueryDsl;
use editoast_derive::EditoastError;
use futures::future::try_join_all;
use futures::Future;
use serde::{Deserialize, Serialize};
use strum::IntoEnumIterator;
use thiserror::Error;
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

routes! {
    "/infra" => {
        list,
        create,
        refresh,
        cache_status,
        railjson::routes(),
        "/{id}" => {
            get,
            load,
            delete,
            clone,
            edition::routes(),
            rename,
            lock,
            unlock,
            get_switch_types,
            get_speed_limit_tags,
            get_voltages,
            (
                errors::routes(),
                objects::routes(),
                lines::routes(),
                routes::routes(),
                pathfinding::routes(),
                attached::routes(),
            )
        },
    }
}

schemas! {
    InfraForm,
    RefreshResponse,
    InfraState,
    InfraWithState,
    InfraPatchForm,
    StatePayload,
    attached::schemas(),
    errors::schemas(),
    pathfinding::schemas(),
    routes::schemas(),
}

// Only meant to be used in utoipa::path as param()
#[derive(IntoParams)]
#[allow(unused)]
struct InfraId {
    /// An infra ID
    id: i64,
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra")]
pub enum InfraApiError {
    /// Couldn't find the infra with the given id
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { infra_id: i64 },
}

#[derive(Debug, Deserialize, ToSchema, IntoParams)]
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

#[derive(Debug, Deserialize, IntoParams)]
struct RefreshQueryParams {
    /// Force the refresh of the layers
    #[serde(default)]
    #[param(default = false)]
    force: bool,
    /// Comma-separated list of infra IDs
    #[serde(default)]
    #[param(value_type = String, example = "1,2,3")]
    infras: List<i64>,
}

#[derive(Serialize, ToSchema)]
struct RefreshResponse {
    infra_refreshed: Vec<i64>,
}

/// Refresh infra generated data
#[utoipa::path(
    params(RefreshQueryParams),
    responses(
        (status = 200, description = "A list thats contains the ID of the infras that were refreshed", body = inline(RefreshResponse)),
    ),
)]
#[post("/refresh")]
async fn refresh(
    db_pool: Data<DbPool>,
    redis_client: Data<RedisClient>,
    query_params: Query<RefreshQueryParams>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    map_layers: Data<MapLayers>,
) -> Result<Json<RefreshResponse>> {
    let mut conn = db_pool.get().await?;
    // Use a transaction to give scope to infra list lock
    let mut infras_list = vec![];
    let infras = &query_params.infras.0;

    if infras.is_empty() {
        // Retrieve all available infra
        for infra in Infra::list_for_update(&mut conn).await {
            infras_list.push(infra);
        }
    } else {
        // Retrieve given infras
        for id in infras.iter() {
            let infra = Infra::retrieve_for_update(&mut conn, *id)
                .await
                .map_err(|_| InfraApiError::NotFound { infra_id: *id })?;
            infras_list.push(infra);
        }
    }

    // Refresh each infras
    let mut refreshed_infra = vec![];

    for infra in infras_list {
        let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;
        if infra
            .refresh(db_pool.clone(), query_params.force, &infra_cache)
            .await?
        {
            refreshed_infra.push(infra.id.unwrap());
        }
    }

    let mut conn = redis_client.get_connection().await?;
    for infra_id in refreshed_infra.iter() {
        map::invalidate_all(
            &mut conn,
            &map_layers.layers.keys().cloned().collect(),
            *infra_id,
        )
        .await;
    }
    let response = RefreshResponse {
        infra_refreshed: refreshed_infra,
    };

    Ok(Json(response))
}

/// Returns the list of infras in DB
#[utoipa::path(
    params(PaginationQueryParam),
    responses(
        (status = 200, description = "A list of infras", body = PaginatedInfras),
    ),
)]
#[get("")]
async fn list(
    db_pool: Data<DbPool>,
    core: Data<CoreClient>,
    pagination_params: Query<PaginationQueryParam>,
) -> Result<Json<PaginatedResponse<InfraWithState>>> {
    let page = pagination_params.page;
    let per_page = pagination_params.page_size.unwrap_or(25).max(10);
    let infras = Infra::list(db_pool.clone(), page, per_page, NoParams).await?;
    let infra_state = call_core_infra_state(None, db_pool, core).await?;
    let infras_with_state: Vec<InfraWithState> = infras
        .results
        .into_iter()
        .map(|infra| {
            let infra_id = infra.id.unwrap();
            let state = infra_state
                .get(&infra_id.to_string())
                .unwrap_or(&InfraStateResponse::default())
                .status;
            InfraWithState { infra, state }
        })
        .collect();
    let infras_with_state = PaginatedResponse::<InfraWithState> {
        count: infras.count,
        previous: infras.previous,
        next: infras.next,
        results: infras_with_state,
    };

    Ok(Json(infras_with_state))
}

#[derive(Debug, Clone, Copy, Serialize, Default, Deserialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InfraState {
    #[default]
    NotLoaded,
    Initializing,
    Downloading,
    ParsingJson,
    ParsingInfra,
    AdaptingKotlin,
    LoadingSignals,
    BuildingBlocks,
    Cached,
    TransientError,
    Error,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct InfraWithState {
    #[serde(flatten)]
    pub infra: Infra,
    pub state: InfraState,
}

/// Retrieve a specific infra
#[utoipa::path(
    params(InfraId),
    responses(
        (status = 200, description = "Information about the retrieved infra", body = InfraWithState),
    ),
)]
#[get("")]
async fn get(
    db_pool: Data<DbPool>,
    infra: Path<i64>,
    core: Data<CoreClient>,
) -> Result<Json<InfraWithState>> {
    let infra_id = infra.into_inner();

    let infra = match Infra::retrieve(db_pool.clone(), infra_id).await? {
        Some(infra) => infra,
        None => return Err(InfraApiError::NotFound { infra_id }.into()),
    };
    let infra_state = call_core_infra_state(Some(infra_id), db_pool, core).await?;
    let state = infra_state
        .get(&infra_id.to_string())
        .unwrap_or(&InfraStateResponse::default())
        .status;
    Ok(Json(InfraWithState { infra, state }))
}

/// Create an infra
#[utoipa::path(
    params(InfraId),
    request_body = inline(InfraForm),
    responses(
        (status = 200, description = "Information about the created infra", body = Infra),
    ),
)]
#[post("")]
async fn create(db_pool: Data<DbPool>, data: Json<InfraForm>) -> Result<impl Responder> {
    let infra: Infra = data.into_inner().into();
    let infra = infra.create(db_pool).await?;
    Ok(HttpResponse::Created().json(infra))
}

/// Duplicate an infra
#[utoipa::path(
    params(InfraForm, InfraId),
    responses(
        (status = 200, description = "The duplicated infra ID", body = i64),
    ),
)]
#[post("/clone")]
async fn clone(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
    new_name: Query<InfraForm>,
) -> Result<Json<i64>> {
    let mut futures = Vec::<Pin<Box<dyn Future<Output = _>>>>::new();

    let infra = infra.into_inner();
    let name = new_name.name.clone();
    let cloned_infra = Infra::clone(infra, db_pool.clone(), name).await?;
    // When creating a connection for each objet, it will a panic with 'Cannot access shared transaction state' in the database pool
    // Just one connection fixes it, but partially* defeats the purpose of joining all the requests at the end
    // * AsyncPgConnection supports pipeling within one connection, but it won’t run parallel
    let mut conn = db_pool.get().await?;
    for object in ObjectType::iter() {
        let model_table = object.get_table();
        let model = sql_query(format!(
                "INSERT INTO {model_table}(obj_id,data,infra_id) SELECT obj_id,data,$1 FROM {model_table} WHERE infra_id=$2"
            ))
            .bind::<BigInt, _>(cloned_infra.id.unwrap())
            .bind::<BigInt, _>(infra)
            .execute(&mut conn);
        futures.push(model);

        if let Some(layer_table) = object.get_geometry_layer_table() {
            let layer_table = layer_table.to_string();
            let sql = if layer_table != ObjectType::Signal.get_geometry_layer_table().unwrap() {
                format!(
                    "INSERT INTO {layer_table}(obj_id,geographic,schematic,infra_id) SELECT obj_id,geographic,schematic,$1 FROM {layer_table} WHERE infra_id=$2")
            } else {
                format!(
                    "INSERT INTO {layer_table}(obj_id,geographic,schematic,infra_id, angle_geo, angle_sch) SELECT obj_id,geographic,schematic,$1,angle_geo,angle_sch FROM {layer_table} WHERE infra_id=$2"
                )
            };

            let layer = sql_query(sql)
                .bind::<BigInt, _>(cloned_infra.id.unwrap())
                .bind::<BigInt, _>(infra)
                .execute(&mut conn);
            futures.push(layer);
        }
    }

    let _res = try_join_all(futures).await?;
    Ok(Json(cloned_infra.id.unwrap()))
}

/// Delete an infra and all entities linked to it
#[utoipa::path(
    params(InfraId),
    responses(
        (status = 204, description = "The infra was deleted"),
        (status = 404, description = "The infra was not found"),
    )
)]
#[delete("")]
async fn delete(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<HttpResponse> {
    let infra = infra.into_inner();
    if Infra::delete(db_pool.clone(), infra).await? {
        infra_caches.remove(&infra);
        Ok(HttpResponse::NoContent().finish())
    } else {
        Ok(HttpResponse::NotFound().finish())
    }
}

/// Patch form for a project
#[derive(Serialize, Deserialize, ToSchema)]
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

/// Update an infrastructure name
#[utoipa::path(
    params(InfraId),
    request_body = inline(InfraPatchForm),
    responses(
        (status = 200, description = "Information about the updated infra", body = Infra),
    ),
)]
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
#[utoipa::path(
    params(InfraId),
    responses(
        (status = 200, description = "A switch type following Railjson spec", body = inline(Vec<SwitchType>)),
    ),
)]
#[get("/switch_types")]
async fn get_switch_types(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<Json<Vec<SwitchType>>> {
    let infra_id = infra.into_inner();
    let infra = Infra::retrieve(db_pool.clone(), infra_id)
        .await?
        .ok_or(InfraApiError::NotFound { infra_id })?;

    let mut conn = db_pool.get().await?;
    let infra = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;
    Ok(Json(
        infra
            .switch_types()
            .values()
            .map(ObjectCache::unwrap_switch_type)
            .cloned()
            .collect(),
    ))
}

/// Returns the set of speed limit tags for a given infra
#[utoipa::path(
    params(InfraId),
    responses(
        (
            status = 200,
            description = "The list of speed limit tags",
            body = inline(Vec<String>),
            example = json!(["freight", "heavy_load"])
        ),
    ),
)]
#[get("/speed_limit_tags")]
async fn get_speed_limit_tags(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
) -> Result<Json<Vec<String>>> {
    let infra = infra.into_inner();
    let mut conn = db_pool.get().await?;
    let speed_limits_tags: Vec<SpeedLimitTags> = sql_query(
        "SELECT DISTINCT jsonb_object_keys(data->'speed_limit_by_tag') AS tag
        FROM infra_object_speed_section
        WHERE infra_id = $1
        ORDER BY tag",
    )
    .bind::<BigInt, _>(infra)
    .load(&mut conn)
    .await?;
    Ok(Json(
        speed_limits_tags.into_iter().map(|el| (el.tag)).collect(),
    ))
}

#[derive(Debug, Clone, Deserialize, IntoParams)]
struct GetVoltagesQueryParams {
    #[serde(default)]
    #[param(default = false)]
    /// Include rolling stocks modes or not
    include_rolling_stock_modes: bool,
}

/// Returns the set of voltages for a given infra and/or rolling_stocks modes.
/// If include_rolling_stocks_modes is true, it returns also rolling_stocks modes.
#[utoipa::path(
    params(GetVoltagesQueryParams, InfraId),
    responses(
        (
            status = 200,
            description = "The list of voltages",
            body = inline(Vec<String>),
            example = json!(["750", "1500", "2500.5"])
        ),
    )
)]
#[get("/voltages")]
async fn get_voltages(
    infra: Path<i64>,
    param: Query<GetVoltagesQueryParams>,
    db_pool: Data<DbPool>,
) -> Result<Json<Vec<String>>> {
    let infra = infra.into_inner();
    let include_rolling_stock_modes = param.into_inner().include_rolling_stock_modes;
    let mut conn = db_pool.get().await?;
    let query = if !include_rolling_stock_modes {
        include_str!("sql/get_voltages_without_rolling_stocks_modes.sql")
    } else {
        include_str!("sql/get_voltages_with_rolling_stocks_modes.sql")
    };
    let voltages: Vec<Voltage> = sql_query(query)
        .bind::<BigInt, _>(infra)
        .load(&mut conn)
        .await?;
    Ok(Json(voltages.into_iter().map(|el| (el.voltage)).collect()))
}

/// Lock an infra from edition
#[utoipa::path(
    params(InfraId),
    responses(
        (status = 204, description = "The infra was locked"),
    ),
)]
#[post("/lock")]
async fn lock(infra: Path<i64>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let infra_id = infra.into_inner();
    let mut conn = db_pool.get().await?;
    let mut infra = Infra::retrieve_for_update(&mut conn, infra_id)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;
    infra.locked = Some(true);
    infra.update_conn(&mut conn, infra_id).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// Unlock an infra from edition
#[utoipa::path(
    params(InfraId),
    responses(
        (status = 204, description = "The infra was unlocked"),
    ),
)]
#[post("/unlock")]
async fn unlock(infra: Path<i64>, db_pool: Data<DbPool>) -> Result<HttpResponse> {
    let infra_id = infra.into_inner();
    let mut conn = db_pool.get().await?;
    let mut infra = Infra::retrieve_for_update(&mut conn, infra_id)
        .await
        .map_err(|_| InfraApiError::NotFound { infra_id })?;
    infra.locked = Some(false);
    infra.update_conn(&mut conn, infra_id).await?;
    Ok(HttpResponse::NoContent().finish())
}

#[derive(Debug, Default, Deserialize, ToSchema)]
pub struct StatePayload {
    infra: Option<i64>,
}

/// Builds a Core infra load request, runs it
async fn call_core_infra_load(
    infra_id: i64,
    db_pool: Data<DbPool>,
    core: Data<CoreClient>,
) -> Result<()> {
    let infra = Infra::retrieve(db_pool, infra_id)
        .await?
        .ok_or(InfraApiError::NotFound { infra_id })?;
    let infra_request = InfraLoadRequest {
        infra: infra.id.unwrap(),
        expected_version: infra.version.unwrap(),
    };
    infra_request.fetch(core.as_ref()).await?;
    Ok(())
}

/// Load an infra if not loaded
#[utoipa::path(
    params(InfraId),
    responses(
        (status = 204, description = "The infra was loaded"),
    ),
)]
#[post("/load")]
async fn load(
    infra: Path<i64>,
    db_pool: Data<DbPool>,
    core: Data<CoreClient>,
) -> Result<HttpResponse> {
    let infra_id = infra.into_inner();
    call_core_infra_load(infra_id, db_pool, core).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// Builds a Core cache_status request, runs it
pub async fn call_core_infra_state(
    infra_id: Option<i64>,
    db_pool: Data<DbPool>,
    core: Data<CoreClient>,
) -> Result<HashMap<String, InfraStateResponse>> {
    if let Some(infra_id) = infra_id {
        Infra::retrieve(db_pool.clone(), infra_id)
            .await?
            .ok_or(InfraApiError::NotFound { infra_id })?;
    };
    let infra_request = InfraStateRequest { infra: infra_id };
    let response = infra_request.fetch(core.as_ref()).await?;
    Ok(response)
}

/// Returns the status of the infras in cache
#[utoipa::path(
    params(InfraId),
    request_body = inline(Option<StatePayload>),
    responses(
        (
            status = 200,
            description = "The status of the infras in cache",
            body = inline(HashMap<String, InfraStateResponse>),
        ),
    )
)]
#[get("/cache_status")]
async fn cache_status(
    payload: Either<Json<StatePayload>, ()>,
    db_pool: Data<DbPool>,
    core: Data<CoreClient>,
) -> Result<Json<HashMap<String, InfraStateResponse>>> {
    let StatePayload { infra } = match payload {
        Either::Left(state) => state.into_inner(),
        Either::Right(_) => Default::default(),
    };
    Ok(Json(call_core_infra_state(infra, db_pool, core).await?))
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use crate::core::mocking::MockingClient;
    use crate::fixtures::tests::{db_pool, empty_infra, other_rolling_stock, TestFixture};
    use crate::models::RollingStockModel;
    use crate::schema::operation::{Operation, RailjsonObject};
    use crate::schema::{Catenary, SpeedSection};
    use crate::views::tests::{create_test_service, create_test_service_with_core_client};
    use actix_http::Request;
    use actix_web::http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::{call_and_read_body_json, call_service, read_body_json, TestRequest};
    use rstest::*;
    use serde_json::json;

    fn delete_infra_request(infra_id: i64) -> Request {
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

    #[rstest]
    async fn infra_clone(db_pool: Data<DbPool>, #[future] empty_infra: TestFixture<Infra>) {
        let app = create_test_service().await;
        let infra = empty_infra.await;
        let req = TestRequest::post()
            .uri(format!("/infra/{}/clone/?name=cloned_infra", infra.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let cloned_infra_id: i64 = read_body_json(response).await;
        let cloned_infra = Infra::retrieve(db_pool.clone(), cloned_infra_id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(cloned_infra.name.unwrap(), "cloned_infra");
        assert!(Infra::delete(db_pool, cloned_infra_id).await.unwrap());
    }

    #[rstest]
    async fn infra_delete(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let response = call_service(&app, delete_infra_request(empty_infra.id())).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let response = call_service(&app, delete_infra_request(empty_infra.id())).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_test]
    async fn infra_list() {
        let mut core = MockingClient::new();
        core.stub("/cache_status")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body("{}")
            .finish();
        let app = create_test_service_with_core_client(core).await;
        let req = TestRequest::get().uri("/infra/").to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn default_infra_create(db_pool: Data<DbPool>) {
        let app = create_test_service().await;
        let req = TestRequest::post()
            .uri("/infra")
            .set_json(json!({ "name": "create_infra_test" }))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::CREATED);
        let infra: Infra = read_body_json(response).await;
        assert_eq!(infra.name.unwrap(), "create_infra_test");
        assert_eq!(infra.railjson_version.unwrap(), RAILJSON_VERSION);
        assert_eq!(infra.version.unwrap(), INFRA_VERSION);
        assert_eq!(infra.generated_version.unwrap().unwrap(), INFRA_VERSION);
        assert!(!infra.locked.unwrap());

        assert!(Infra::delete(db_pool, infra.id.unwrap()).await.unwrap());
    }

    #[rstest]
    async fn infra_get(#[future] empty_infra: TestFixture<Infra>, db_pool: Data<DbPool>) {
        let empty_infra = empty_infra.await;
        let mut core = MockingClient::new();
        core.stub("/cache_status")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body("{}")
            .finish();
        let app = create_test_service_with_core_client(core).await;

        let req = TestRequest::get()
            .uri(format!("/infra/{}", empty_infra.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        Infra::delete(db_pool, empty_infra.id()).await.unwrap();

        let req = TestRequest::get()
            .uri(format!("/infra/{}", empty_infra.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn infra_rename(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;
        let req = TestRequest::put()
            .uri(format!("/infra/{}", empty_infra.id()).as_str())
            .set_json(json!({"name": "rename_test"}))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let infra: Infra = read_body_json(response).await;
        assert_eq!(infra.name.unwrap(), "rename_test");
    }

    #[derive(Deserialize)]
    struct InfraRefreshedResponse {
        infra_refreshed: Vec<i64>,
    }

    #[rstest]
    async fn infra_refresh(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let req = TestRequest::post()
            .uri(format!("/infra/refresh/?infras={}", empty_infra.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let refreshed_infras: InfraRefreshedResponse = read_body_json(response).await;
        assert!(refreshed_infras.infra_refreshed.is_empty());
    }

    #[rstest]
    async fn infra_refresh_force(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let req = TestRequest::post()
            .uri(format!("/infra/refresh/?infras={}&force=true", empty_infra.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let refreshed_infras: InfraRefreshedResponse = read_body_json(response).await;
        assert!(refreshed_infras.infra_refreshed.contains(&empty_infra.id()));
    }

    #[rstest]
    async fn infra_get_speed_limit_tags(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let req = create_object_request(empty_infra.id(), SpeedSection::default().into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = TestRequest::get()
            .uri(format!("/infra/{}/speed_limit_tags/", empty_infra.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn infra_get_voltages(
        #[future] empty_infra: TestFixture<Infra>,
        #[future] other_rolling_stock: TestFixture<RollingStockModel>,
    ) {
        let app = create_test_service().await;
        let infra = empty_infra.await;

        let test_cases = vec![true, false];
        // Create catenary
        let catenary = Catenary {
            id: "test".into(),
            voltage: "0".into(),
            track_ranges: vec![],
        };

        let req = create_object_request(infra.id(), catenary.into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        // Create rolling_stock
        let _rolling_stock = other_rolling_stock.await;

        for include_rolling_stock_modes in test_cases {
            let req = TestRequest::get()
                .uri(
                    format!(
                        "/infra/{}/voltages/?include_rolling_stock_modes={}",
                        infra.id(),
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
                assert!(voltages.contains(&String::from("25000")));
                assert!(voltages.len() >= 2);
            }
        }
    }

    #[rstest]
    async fn infra_get_switch_types(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let switch_type = SwitchType::default();
        let switch_type_id = switch_type.id.clone();
        let req = create_object_request(empty_infra.id(), switch_type.into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = TestRequest::get()
            .uri(format!("/infra/{}/switch_types/", empty_infra.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let switch_types: Vec<SwitchType> = read_body_json(response).await;
        assert_eq!(switch_types.len(), 1);
        assert_eq!(switch_types[0].id, switch_type_id);
    }

    #[rstest]
    async fn infra_lock(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let mut core = MockingClient::new();
        core.stub("/cache_status")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body("{}")
            .finish();
        let app = create_test_service_with_core_client(core).await;
        assert!(!empty_infra.model.locked.unwrap());

        let infra_id = empty_infra.id();

        // Lock infra
        let req = TestRequest::post()
            .uri(format!("/infra/{}/lock/", infra_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        // Check lock
        let req = TestRequest::get()
            .uri(format!("/infra/{}", infra_id).as_str())
            .to_request();
        let infra: Infra = call_and_read_body_json(&app, req).await;
        assert!(infra.locked.unwrap());

        // Unlock infra
        let req = TestRequest::post()
            .uri(format!("/infra/{}/unlock/", infra_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        // Check lock
        let req = TestRequest::get()
            .uri(format!("/infra/{}", infra_id).as_str())
            .to_request();
        let infra: Infra = call_and_read_body_json(&app, req).await;
        assert!(!infra.locked.unwrap());
    }

    #[rstest]
    async fn infra_load_core(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let mut core = MockingClient::new();
        core.stub("/infra_load")
            .method(reqwest::Method::POST)
            .response(StatusCode::NO_CONTENT)
            .body("")
            .finish();
        let app = create_test_service_with_core_client(core).await;
        let req = TestRequest::post()
            .uri(format!("/infra/{}/load", empty_infra.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);
    }

    #[rstest]
    async fn infra_get_state_no_result(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;

        let mut core = MockingClient::new();
        core.stub("/cache_status")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body("{}")
            .finish();
        let app = create_test_service_with_core_client(core).await;
        let payload = json!({"infra": empty_infra.id()});
        let req = TestRequest::get()
            .uri("/infra/cache_status")
            .set_json(payload)
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[rstest]
    async fn infra_get_state_with_result(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let infra_id = empty_infra.id();
        let mut core = MockingClient::new();
        core.stub("/cache_status")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body(format!(
                "{{
                \"{infra_id}\": {{
        \"last_status\": \"BUILDING_BLOCKS\",
        \"status\": \"CACHED\"
        }}
        }}"
            ))
            .finish();
        let app = create_test_service_with_core_client(core).await;
        let payload = json!({ "infra": infra_id });
        let req = TestRequest::get()
            .uri("/infra/cache_status")
            .set_json(payload)
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
    }
}
