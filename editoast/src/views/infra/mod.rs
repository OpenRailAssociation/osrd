mod attached;
mod auto_fixes;
mod edition;
mod errors;
mod lines;
mod objects;
mod pathfinding;
mod railjson;
mod routes;

use std::collections::HashMap;
use std::sync::Arc;

use actix_web::delete;
use actix_web::dev::HttpServiceFactory;
use actix_web::get;
use actix_web::post;
use actix_web::put;
use actix_web::web::scope;
use actix_web::web::Data;
use actix_web::web::Json;
use actix_web::web::Path;
use actix_web::web::Query;
use actix_web::Either;
use actix_web::HttpResponse;
use actix_web::Responder;
use chashmap::CHashMap;
use diesel::sql_query;
use diesel::sql_types::BigInt;
use diesel::sql_types::Text;
use diesel::QueryableByName;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use utoipa::IntoParams;

use self::edition::edit;
use super::params::List;
use crate::core::infra_loading::InfraLoadRequest;
use crate::core::infra_state::InfraStateRequest;
use crate::core::infra_state::InfraStateResponse;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use crate::map::MapLayers;
use crate::map::{self};
use crate::models::List as ModelList;
use crate::models::NoParams;
use crate::modelsv2::prelude::*;
use crate::modelsv2::DbConnectionPool;
use crate::modelsv2::Infra;
use crate::views::pagination::PaginatedResponse;
use crate::views::pagination::PaginationQueryParam;
use crate::RedisClient;
use editoast_schemas::infra::SwitchType;

crate::routes! {
    "/infra" => {
        "/{infra_id}" => {
            routes::routes(),
            lines::routes(),
            auto_fixes::routes(),
            pathfinding::routes(),
            attached::routes(),
            lock,
            unlock,
            get_speed_limit_tags,
            get_voltages,
            get_switch_types,
        },
        get_all_voltages,
        railjson::routes(),
    },
}

editoast_common::schemas! {
    pathfinding::schemas(),
}

/// Return `/infra` routes
pub fn infra_routes() -> impl HttpServiceFactory {
    scope("/infra")
        .service((
            list,
            create,
            refresh,
            cache_status,
            get_all_voltages,
            railjson::railjson_routes(),
        ))
        .service(
            scope("/{infra_id}")
                .service((
                    get,
                    load,
                    delete,
                    clone,
                    edit,
                    rename,
                    lock,
                    unlock,
                    get_speed_limit_tags,
                    get_voltages,
                    get_switch_types,
                ))
                .service((
                    errors::routes(),
                    objects::routes(),
                    routes::routes(),
                    pathfinding::routes(),
                    attached::routes(),
                    lines::routes(),
                    auto_fixes::routes(),
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

impl From<InfraForm> for Changeset<Infra> {
    fn from(infra: InfraForm) -> Self {
        Self::default().name(infra.name).last_railjson_version()
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

#[derive(Debug, Serialize)]
struct RefreshResponse {
    infra_refreshed: Vec<i64>,
}

/// Refresh infra generated data
#[post("/refresh")]
async fn refresh(
    db_pool: Data<DbConnectionPool>,
    redis_client: Data<RedisClient>,
    Query(query_params): Query<RefreshQueryParams>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
    map_layers: Data<MapLayers>,
) -> Result<Json<RefreshResponse>> {
    let mut conn = db_pool.get().await?;
    // Use a transaction to give scope to infra list lock
    let RefreshQueryParams {
        force,
        infras: List(infras),
    } = query_params;

    let infras_list = if infras.is_empty() {
        // Retrieve all available infra
        Infra::all(&mut conn).await
    } else {
        // Retrieve given infras
        Infra::retrieve_batch_or_fail(&mut conn, infras, |missing| InfraApiError::NotFound {
            infra_id: missing.into_iter().next().unwrap(),
        })
        .await?
    };

    // Refresh each infras
    let mut infra_refreshed = vec![];

    for mut infra in infras_list {
        let infra_cache = InfraCache::get_or_load(&mut conn, &infra_caches, &infra).await?;
        if infra.refresh(db_pool.clone(), force, &infra_cache).await? {
            infra_refreshed.push(infra.id);
        }
    }

    let mut conn = redis_client.get_connection().await?;
    for infra_id in infra_refreshed.iter() {
        map::invalidate_all(
            &mut conn,
            &map_layers.layers.keys().cloned().collect(),
            *infra_id,
        )
        .await?;
    }

    Ok(Json(RefreshResponse { infra_refreshed }))
}

/// Return a list of infras
#[get("")]
async fn list(
    db_pool: Data<DbConnectionPool>,
    core: Data<CoreClient>,
    pagination_params: Query<PaginationQueryParam>,
) -> Result<Json<PaginatedResponse<InfraWithState>>> {
    let (page, per_page) = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .unpack();
    let infras = Infra::list(db_pool.clone(), page, per_page, NoParams).await?;
    let infra_state = call_core_infra_state(None, db_pool, core).await?;
    let infras_with_state: Vec<InfraWithState> = infras
        .results
        .into_iter()
        .map(|infra| {
            let infra_id = infra.id;
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

#[derive(Debug, Clone, Copy, Serialize, Default, Deserialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Serialize)]
struct InfraWithState {
    #[serde(flatten)]
    pub infra: Infra,
    pub state: InfraState,
}

#[derive(IntoParams, Deserialize)]
#[allow(unused)]
struct InfraIdParam {
    /// An existing infra ID
    infra_id: i64,
}

/// Return a specific infra
#[get("")]
async fn get(
    db_pool: Data<DbConnectionPool>,
    infra: Path<i64>,
    core: Data<CoreClient>,
) -> Result<Json<InfraWithState>> {
    let infra_id = infra.into_inner();
    let conn = &mut db_pool.get().await?;
    let infra =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;
    let infra_state = call_core_infra_state(Some(infra_id), db_pool, core).await?;
    let state = infra_state
        .get(&infra_id.to_string())
        .unwrap_or(&InfraStateResponse::default())
        .status;
    Ok(Json(InfraWithState { infra, state }))
}

/// Create an infra
#[post("")]
async fn create(db_pool: Data<DbConnectionPool>, data: Json<InfraForm>) -> Result<impl Responder> {
    let infra: Changeset<Infra> = data.into_inner().into();
    let conn = &mut db_pool.get().await?;
    let infra = infra.create(conn).await?;
    Ok(HttpResponse::Created().json(infra))
}

#[derive(Deserialize)]
struct CloneQuery {
    /// The name of the new infra
    name: Option<String>,
}

/// Duplicate an infra
#[post("/clone")]
async fn clone(
    infra_id: Path<i64>,
    db_pool: Data<DbConnectionPool>,
    Query(CloneQuery { name }): Query<CloneQuery>,
) -> Result<Json<i64>> {
    let conn = &mut db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn, *infra_id, || InfraApiError::NotFound {
        infra_id: infra_id.into_inner(),
    })
    .await?;
    let cloned_infra = infra.clone(db_pool.clone(), name).await?;
    Ok(Json(cloned_infra.id))
}

/// Delete an infra
#[delete("")]
async fn delete(
    infra: Path<i64>,
    db_pool: Data<DbConnectionPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<HttpResponse> {
    let conn = &mut db_pool.get().await?;
    if Infra::delete_static(conn, *infra).await? {
        infra_caches.remove(&infra);
        Ok(HttpResponse::NoContent().finish())
    } else {
        Ok(HttpResponse::NotFound().finish())
    }
}

/// Patch form for a project
#[derive(Serialize, Deserialize)]
struct InfraPatchForm {
    pub name: Option<String>,
}

impl From<InfraPatchForm> for Changeset<Infra> {
    fn from(patch: InfraPatchForm) -> Self {
        Infra::changeset().flat_name(patch.name)
    }
}

/// Update an infra name
#[put("")]
async fn rename(
    db_pool: Data<DbConnectionPool>,
    infra: Path<i64>,
    Json(patch): Json<InfraPatchForm>,
) -> Result<Json<Infra>> {
    let infra_cs: Changeset<Infra> = patch.into();
    let conn = &mut db_pool.get().await?;
    let infra = infra_cs
        .update_or_fail(conn, *infra, || InfraApiError::NotFound {
            infra_id: *infra,
        })
        .await?;
    Ok(Json(infra))
}

/// Return the railjson list of switch types
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200, description = "A list of switch types", body = Vec<SwitchType>),
        (status = 404, description = "The infra was not found"),
    )
)]
#[get("/switch_types")]
async fn get_switch_types(
    infra: Path<InfraIdParam>,
    db_pool: Data<DbConnectionPool>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<Json<Vec<SwitchType>>> {
    let conn = &mut db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn, infra.infra_id, || InfraApiError::NotFound {
        infra_id: infra.infra_id,
    })
    .await?;

    let infra = InfraCache::get_or_load(conn, &infra_caches, &infra).await?;
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
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200, description = "List all speed limit tags", body = Vec<String>,  example = json!(["freight", "heavy_load"])),
        (status = 404, description = "The infra was not found"),
    )
)]
#[get("/speed_limit_tags")]
async fn get_speed_limit_tags(
    infra: Path<InfraIdParam>,
    db_pool: Data<DbConnectionPool>,
) -> Result<Json<Vec<String>>> {
    use diesel_async::RunQueryDsl;
    let mut conn = db_pool.get().await?;
    let speed_limits_tags: Vec<SpeedLimitTags> = sql_query(
        "SELECT DISTINCT jsonb_object_keys(data->'speed_limit_by_tag') AS tag
        FROM infra_object_speed_section
        WHERE infra_id = $1
        ORDER BY tag",
    )
    .bind::<BigInt, _>(infra.infra_id)
    .load(&mut conn)
    .await?;
    Ok(Json(
        speed_limits_tags.into_iter().map(|el| (el.tag)).collect(),
    ))
}

#[derive(Debug, Clone, Deserialize, IntoParams)]
struct GetVoltagesQueryParams {
    #[serde(default)]
    include_rolling_stock_modes: bool,
}

/// Returns the set of voltages for a given infra and/or rolling_stocks modes.
/// If include_rolling_stocks_modes is true, it returns also rolling_stocks modes.
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam, GetVoltagesQueryParams),
    responses(
        (status = 200,  description = "Voltages list", body = Vec<String>, example = json!(["750V", "1500V", "2500.5V"])),
        (status = 404, description = "The infra was not found",),
    )
)]
#[get("/voltages")]
async fn get_voltages(
    infra: Path<InfraIdParam>,
    param: Query<GetVoltagesQueryParams>,
    db_pool: Data<DbConnectionPool>,
) -> Result<Json<Vec<String>>> {
    use diesel_async::RunQueryDsl;
    let include_rolling_stock_modes = param.into_inner().include_rolling_stock_modes;
    let mut conn = db_pool.get().await?;
    let query = if !include_rolling_stock_modes {
        include_str!("sql/get_voltages_without_rolling_stocks_modes.sql")
    } else {
        include_str!("sql/get_voltages_with_rolling_stocks_modes.sql")
    };
    let voltages: Vec<Voltage> = sql_query(query)
        .bind::<BigInt, _>(infra.infra_id)
        .load(&mut conn)
        .await?;
    Ok(Json(voltages.into_iter().map(|el| (el.voltage)).collect()))
}

/// Returns the set of voltages for all infras and rolling_stocks modes.
#[utoipa::path(
    tag = "infra,rolling_stock",
    responses(
        (status = 200,  description = "Voltages list", body = Vec<String>, example = json!(["750V", "1500V", "2500.5V"])),
        (status = 404, description = "The infra was not found",),
    )
)]
#[get("/voltages")]
async fn get_all_voltages(db_pool: Data<DbConnectionPool>) -> Result<Json<Vec<String>>> {
    use diesel_async::RunQueryDsl;
    let mut conn = db_pool.get().await?;
    let query = include_str!("sql/get_all_voltages_and_modes.sql");
    let voltages: Vec<Voltage> = sql_query(query).load(&mut conn).await?;
    Ok(Json(voltages.into_iter().map(|el| (el.voltage)).collect()))
}

async fn set_locked(infra_id: i64, locked: bool, db_pool: Arc<DbConnectionPool>) -> Result<()> {
    let conn = &mut db_pool.get().await?;
    let mut infra =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;
    infra.locked = locked;
    infra.save(conn).await
}

/// Lock an infra
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 204, description = "The infra was locked successfully"),
        (status = 404, description = "The infra was not found",),
    )
)]
#[post("/lock")]
async fn lock(infra: Path<InfraIdParam>, db_pool: Data<DbConnectionPool>) -> Result<HttpResponse> {
    set_locked(infra.infra_id, true, db_pool.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// Unlock an infra
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 204, description = "The infra was unlocked successfully"),
        (status = 404, description = "The infra was not found",),
    )
)]
#[post("/unlock")]
async fn unlock(
    infra: Path<InfraIdParam>,
    db_pool: Data<DbConnectionPool>,
) -> Result<HttpResponse> {
    set_locked(infra.infra_id, false, db_pool.into_inner()).await?;
    Ok(HttpResponse::NoContent().finish())
}

#[derive(Debug, Default, Deserialize)]

pub struct StatePayload {
    infra: Option<i64>,
}

/// Builds a Core infra load request, runs it
async fn call_core_infra_load(
    infra_id: i64,
    db_pool: Data<DbConnectionPool>,
    core: Data<CoreClient>,
) -> Result<()> {
    let conn = &mut db_pool.get().await?;
    let infra =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;
    let infra_request = InfraLoadRequest {
        infra: infra.id,
        expected_version: infra.version,
    };
    infra_request.fetch(core.as_ref()).await?;
    Ok(())
}

#[post("/load")]
async fn load(
    infra: Path<i64>,
    db_pool: Data<DbConnectionPool>,
    core: Data<CoreClient>,
) -> Result<HttpResponse> {
    call_core_infra_load(*infra, db_pool, core).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// Builds a Core cache_status request, runs it
pub async fn call_core_infra_state(
    infra_id: Option<i64>,
    db_pool: Data<DbConnectionPool>,
    core: Data<CoreClient>,
) -> Result<HashMap<String, InfraStateResponse>> {
    if let Some(infra_id) = infra_id {
        let conn = &mut db_pool.get().await?;
        if !Infra::exists(conn, infra_id).await? {
            return Err(InfraApiError::NotFound { infra_id }.into());
        }
    }
    let infra_request = InfraStateRequest { infra: infra_id };
    let response = infra_request.fetch(core.as_ref()).await?;
    Ok(response)
}

#[get("/cache_status")]
async fn cache_status(
    payload: Either<Json<StatePayload>, ()>,
    db_pool: Data<DbConnectionPool>,
    core: Data<CoreClient>,
) -> Result<Json<HashMap<String, InfraStateResponse>>> {
    let payload = match payload {
        Either::Left(state) => state.into_inner(),
        Either::Right(_) => Default::default(),
    };
    let infra_id = payload.infra;
    Ok(Json(call_core_infra_state(infra_id, db_pool, core).await?))
}

#[cfg(test)]
pub mod tests {
    use actix_http::Request;
    use actix_web::http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::call_and_read_body_json;
    use actix_web::test::call_service;
    use actix_web::test::read_body_json;
    use actix_web::test::TestRequest;
    use diesel_async::RunQueryDsl;
    use rstest::*;
    use serde_json::json;
    use strum::IntoEnumIterator;

    use super::*;
    use crate::assert_status_and_read;
    use crate::core::mocking::MockingClient;
    use crate::fixtures::tests::db_pool;
    use crate::fixtures::tests::empty_infra;
    use crate::fixtures::tests::named_other_rolling_stock;
    use crate::fixtures::tests::small_infra;
    use crate::fixtures::tests::IntoFixture;
    use crate::fixtures::tests::TestFixture;
    use crate::generated_data;
    use crate::infra_cache::operation::Operation;
    use crate::infra_cache::operation::RailjsonObject;
    use crate::modelsv2::get_geometry_layer_table;
    use crate::modelsv2::get_table;
    use crate::modelsv2::infra::DEFAULT_INFRA_VERSION;
    use crate::views::tests::create_test_service;
    use crate::views::tests::create_test_service_with_core_client;
    use editoast_schemas::infra::Electrification;
    use editoast_schemas::infra::SpeedSection;
    use editoast_schemas::infra::SwitchType;
    use editoast_schemas::infra::RAILJSON_VERSION;
    use editoast_schemas::primitives::ObjectType;

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
    async fn infra_clone_empty(db_pool: Data<DbConnectionPool>) {
        let conn = &mut db_pool.get().await.unwrap();
        let infra = empty_infra(db_pool.clone()).await;
        let app = create_test_service().await;
        let req = TestRequest::post()
            .uri(format!("/infra/{}/clone/?name=cloned_infra", infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        let cloned_infra_id: i64 = assert_status_and_read!(response, StatusCode::OK);
        let cloned_infra = Infra::retrieve(conn, cloned_infra_id)
            .await
            .unwrap()
            .expect("infra was not cloned")
            .into_fixture(db_pool);
        assert_eq!(cloned_infra.name, "cloned_infra");
    }

    #[derive(QueryableByName)]
    struct Count {
        #[diesel(sql_type = BigInt)]
        nb: i64,
    }

    #[rstest] // Slow test
    async fn infra_clone(db_pool: Data<DbConnectionPool>) {
        let app = create_test_service().await;
        let small_infra = small_infra(db_pool.clone()).await;
        let small_infra_id = small_infra.id;
        let conn = &mut db_pool.get().await.unwrap();
        let infra_cache = InfraCache::load(conn, &small_infra).await.unwrap();

        generated_data::refresh_all(db_pool.clone(), small_infra_id, &infra_cache)
            .await
            .unwrap();

        let switch_type: RailjsonObject = SwitchType {
            id: "test_switch_type".into(),
            ..Default::default()
        }
        .into();

        let create_operation = TestRequest::post()
            .uri(format!("/infra/{small_infra_id}/").as_str())
            .set_json(json!([Operation::Create(Box::new(switch_type))]))
            .to_request();

        assert_eq!(
            call_service(&app, create_operation).await.status(),
            StatusCode::OK
        );

        let req_clone = TestRequest::post()
            .uri(format!("/infra/{}/clone/?name=cloned_infra", small_infra_id).as_str())
            .to_request();
        let response = call_service(&app, req_clone).await;
        assert_eq!(response.status(), StatusCode::OK);

        let cloned_infra_id: i64 = read_body_json(response).await;
        let _cloned_infra = Infra::retrieve(conn, cloned_infra_id)
            .await
            .unwrap()
            .expect("infra was not cloned")
            .into_fixture(db_pool);

        let mut tables = vec!["infra_layer_error"];
        for object in ObjectType::iter() {
            tables.push(get_table(&object));
            if let Some(layer_table) = get_geometry_layer_table(&object) {
                tables.push(layer_table);
            }
        }

        let mut table_content = HashMap::new();

        for table in tables {
            for inf_id in [small_infra_id, cloned_infra_id] {
                let count_object = sql_query(format!(
                    "SELECT COUNT (*) as nb from {} where infra_id = $1",
                    table
                ))
                .bind::<BigInt, _>(inf_id)
                .get_result::<Count>(conn)
                .await
                .unwrap();

                table_content
                    .entry(table)
                    .or_insert_with(Vec::new)
                    .push(count_object.nb);
            }
        }

        for val in table_content.values() {
            // check that with have values for small infra and values for the cloned infra
            assert_eq!(val.len(), 2);
            // check that we have at least one object in each table to ensure we have something to clone for each table
            assert!(val[0] > 0);
            // check that we have the same number of objects in each table for both infras
            assert_eq!(val[0], val[1]);
        }
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
    async fn default_infra_create(db_pool: Data<DbConnectionPool>) {
        let app = create_test_service().await;
        let req = TestRequest::post()
            .uri("/infra")
            .set_json(json!({ "name": "create_infra_test" }))
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::CREATED);
        let infra = read_body_json::<Infra, _>(response)
            .await
            .into_fixture(db_pool);
        assert_eq!(infra.name, "create_infra_test");
        assert_eq!(infra.railjson_version, RAILJSON_VERSION);
        assert_eq!(infra.version, DEFAULT_INFRA_VERSION);
        assert_eq!(infra.generated_version, None);
        assert!(!infra.locked);
    }

    #[rstest]
    async fn infra_get(#[future] empty_infra: TestFixture<Infra>, db_pool: Data<DbConnectionPool>) {
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

        let conn = &mut db_pool.get().await.unwrap();
        empty_infra.delete(conn).await.unwrap();

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
        assert_eq!(infra.name, "rename_test");
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
            .uri(format!("/infra/refresh/?infras={}", empty_infra.id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let refreshed_infras: InfraRefreshedResponse = read_body_json(response).await;
        assert_eq!(refreshed_infras.infra_refreshed, vec![empty_infra.id]);
    }

    #[rstest] // Slow test
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
    async fn infra_get_all_voltages() {
        let app = create_test_service().await;
        let infra_1 = empty_infra(db_pool()).await;
        let infra_2 = small_infra(db_pool()).await;

        // Create electrifications
        let electrification_1 = Electrification {
            id: "test1".into(),
            voltage: "0V".into(),
            track_ranges: vec![],
        };
        let electrification_2 = Electrification {
            id: "test2".into(),
            voltage: "1V".into(),
            track_ranges: vec![],
        };

        let req = create_object_request(infra_1.id(), electrification_1.into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        let req = create_object_request(infra_2.id(), electrification_2.into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        // Create rolling_stock
        let _rolling_stock =
            named_other_rolling_stock("other_rolling_stock_infra_get_all_voltages", db_pool())
                .await;

        let req = TestRequest::get().uri("/infra/voltages/").to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let voltages: Vec<String> = read_body_json(response).await;
        assert!(voltages.len() >= 3);
        assert!(voltages.contains(&String::from("0V")));
        assert!(voltages.contains(&String::from("1V")));
        assert!(voltages.contains(&String::from("25000V")));
    }

    #[rstest]
    async fn infra_get_voltages(#[future] empty_infra: TestFixture<Infra>) {
        let app = create_test_service().await;
        let infra = empty_infra.await;

        let test_cases = vec![true, false];
        // Create electrification
        let electrification = Electrification {
            id: "test".into(),
            voltage: "0".into(),
            track_ranges: vec![],
        };

        let req = create_object_request(infra.id(), electrification.into());
        assert_eq!(call_service(&app, req).await.status(), StatusCode::OK);

        // Create rolling_stock
        let _rolling_stock =
            named_other_rolling_stock("other_rolling_stock_infra_get_voltages", db_pool()).await;

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
                assert!(voltages.contains(&String::from("25000V")));
                assert!(voltages.len() >= 2);
            }
        }
    }

    #[rstest]
    async fn infra_get_switch_types(#[future] empty_infra: TestFixture<Infra>) {
        let empty_infra = empty_infra.await;
        let app = create_test_service().await;

        let req = TestRequest::get()
            .uri(format!("/infra/{}/switch_types/", empty_infra.id()).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let switch_types: Vec<SwitchType> = read_body_json(response).await;
        assert_eq!(switch_types.len(), 5);
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
        assert!(!empty_infra.locked);

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
        assert!(infra.locked);

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
        assert!(!infra.locked);
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
