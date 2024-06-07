mod attached;
mod auto_fixes;
mod edition;
mod errors;
mod lines;
mod objects;
mod pathfinding;
mod railjson;
mod routes;

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
use actix_web::HttpResponse;
use actix_web::Responder;
use chashmap::CHashMap;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::ops::DerefMut;
use std::sync::Arc;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use self::edition::edit;
use self::edition::split_track_section;
use super::pagination::PaginationStats;
use super::params::List;
use crate::core::infra_loading::InfraLoadRequest;
use crate::core::infra_state::InfraStateRequest;
use crate::core::infra_state::InfraStateResponse;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use crate::map;
use crate::map::MapLayers;
use crate::modelsv2::prelude::*;
use crate::modelsv2::DbConnectionPool;
use crate::modelsv2::DbConnectionPoolV2;
use crate::modelsv2::Infra;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParam;
use crate::RedisClient;
use editoast_schemas::infra::SwitchType;

crate::routes! {
    "/infra" => {
        "/{infra_id}" => {
            (
                routes::routes(),
                lines::routes(),
                auto_fixes::routes(),
                pathfinding::routes(),
                attached::routes(),
                edition::routes(),
            ),
            get,
            load,
            delete,
            put,
            clone,
            lock,
            unlock,
            get_speed_limit_tags,
            get_voltages,
            get_switch_types,
        },
        list,
        create,
        refresh,
        get_all_voltages,
        railjson::routes(),
    },
}

editoast_common::schemas! {
    pathfinding::schemas(),
    InfraState,
    InfraWithState,
}

/// Return `/infra` routes
pub fn infra_routes() -> impl HttpServiceFactory {
    scope("/infra")
        .service((
            list,
            create,
            refresh,
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
                    split_track_section,
                    put,
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

#[derive(Debug, Deserialize, IntoParams)]
struct RefreshQueryParams {
    #[serde(default)]
    force: bool,
    /// A comma-separated list of infra IDs to refresh
    ///
    /// If not provided, all available infras will be refreshed.
    #[serde(default)]
    #[param(value_type = Vec<u64>)]
    infras: List<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
struct RefreshResponse {
    /// The list of infras that were refreshed successfully
    infra_refreshed: Vec<i64>,
}

/// Refresh infra generated geographic layers
#[utoipa::path(
    tag = "infra",
    params(RefreshQueryParams),
    responses(
        (status = 200, body = inline(RefreshResponse)),
        (status = 404, description = "Invalid infra ID query parameters"),
    )
)]
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
    let db_pool = db_pool.into_inner();
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

#[derive(Serialize, ToSchema)]
struct InfraListResponse {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<InfraWithState>,
}

/// Lists all infras along with their current loading state in Core
#[utoipa::path(
    tag = "infra",
    params(PaginationQueryParam),
    responses(
        (status = 200, description = "All infras, paginated", body = inline(InfraListResponse))
    ),
)]
#[get("")]
async fn list(
    db_pool: Data<DbConnectionPool>,
    core: Data<CoreClient>,
    pagination_params: Query<PaginationQueryParam>,
) -> Result<Json<InfraListResponse>> {
    let settings = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .into_selection_settings();

    let ((infras, stats), infra_states) = {
        let conn = &mut db_pool.get().await?;
        futures::try_join!(
            Infra::list_paginated(conn, settings),
            fetch_all_infra_states(core.as_ref()),
        )?
    };

    let response = InfraListResponse {
        stats,
        results: infras
            .into_iter()
            .map(|infra| {
                let state = infra_states
                    .get(&infra.id.to_string())
                    .map(|response| response.status)
                    .unwrap_or_default();
                InfraWithState { infra, state }
            })
            .collect(),
    };
    Ok(Json(response))
}

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InfraState {
    #[default]
    NotLoaded,
    Initializing,
    Downloading,
    ParsingJson,
    ParsingInfra,
    LoadingSignals,
    BuildingBlocks,
    Cached,
    TransientError,
    Error,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
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

/// Retrieve a specific infra
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200, description = "The infra", body = InfraWithState),
        (status = 404, description = "Infra ID not found"),
    ),
)]
#[get("")]
async fn get(
    db_pool: Data<DbConnectionPoolV2>,
    infra: Path<InfraIdParam>,
    core: Data<CoreClient>,
) -> Result<Json<InfraWithState>> {
    let infra_id = infra.infra_id;
    let infra = Infra::retrieve_or_fail(db_pool.get().await?.deref_mut(), infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;
    let state = fetch_infra_state(infra.id, core.as_ref()).await?.status;
    Ok(Json(InfraWithState { infra, state }))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct InfraCreateForm {
    /// The name to give to the new infra
    pub name: String,
}

impl From<InfraCreateForm> for Changeset<Infra> {
    fn from(infra: InfraCreateForm) -> Self {
        Self::default().name(infra.name).last_railjson_version()
    }
}

/// Creates an empty infra
///
/// The infra may be edited by batch later via the `POST /infra/ID` or `POST /infra/ID/railjson` endpoints.
#[utoipa::path(
    tag = "infra",
    request_body = inline(InfraCreateForm),
    responses(
        (status = 201, description = "The created infra", body = Infra),
    ),
)]
#[post("")]
async fn create(
    db_pool: Data<DbConnectionPoolV2>,
    data: Json<InfraCreateForm>,
) -> Result<impl Responder> {
    let infra: Changeset<Infra> = data.into_inner().into();
    let infra = infra.create(db_pool.get().await?.deref_mut()).await?;
    Ok(HttpResponse::Created().json(infra))
}

#[derive(Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
struct CloneQuery {
    /// The name of the new infra
    name: String,
}

/// Duplicate an infra
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam, CloneQuery),
    responses(
        (status = 200, description = "The new infra ID", body = u64),
        (status = 404, description = "Infra ID not found"),
    ),
)]
#[post("/clone")]
async fn clone(
    params: Path<InfraIdParam>,
    db_pool: Data<DbConnectionPool>,
    Query(CloneQuery { name }): Query<CloneQuery>,
) -> Result<Json<i64>> {
    let conn = &mut db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn, params.infra_id, || InfraApiError::NotFound {
        infra_id: params.infra_id,
    })
    .await?;
    let cloned_infra = infra.clone(db_pool.into_inner(), name).await?;
    Ok(Json(cloned_infra.id))
}

/// Delete an infra and all entities linked to it.
///
/// This operation cannot be undone.
///
/// So beware.
///
/// You've been warned.
///
/// This operation may take a while to complete.
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 204, description = "The infra has been deleted"),
        (status = 404, description = "Infra ID not found"),
    ),
)]
#[delete("")]
async fn delete(
    infra: Path<InfraIdParam>,
    db_pool: Data<DbConnectionPoolV2>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<HttpResponse> {
    let infra_id = infra.infra_id;
    if Infra::delete_static(db_pool.get().await?.deref_mut(), infra_id).await? {
        infra_caches.remove(&infra_id);
        Ok(HttpResponse::NoContent().finish())
    } else {
        Ok(HttpResponse::NotFound().finish())
    }
}

#[derive(Serialize, Deserialize, ToSchema)]
struct InfraPatchForm {
    /// The new name to give the infra
    pub name: String,
}

impl From<InfraPatchForm> for Changeset<Infra> {
    fn from(patch: InfraPatchForm) -> Self {
        Infra::changeset().name(patch.name)
    }
}

/// Rename an infra
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam),
    request_body = inline(InfraPatchForm),
    responses(
        (status = 200, description = "The infra has been renamed", body = Infra),
        (status = 404, description = "Infra ID not found"),
    ),
)]
#[put("")]
async fn put(
    db_pool: Data<DbConnectionPoolV2>,
    infra: Path<i64>,
    Json(patch): Json<InfraPatchForm>,
) -> Result<Json<Infra>> {
    let infra_cs: Changeset<Infra> = patch.into();
    let infra = infra_cs
        .update_or_fail(db_pool.get().await?.deref_mut(), *infra, || {
            InfraApiError::NotFound { infra_id: *infra }
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
    db_pool: Data<DbConnectionPoolV2>,
    infra_caches: Data<CHashMap<i64, InfraCache>>,
) -> Result<Json<Vec<SwitchType>>> {
    let infra = Infra::retrieve_or_fail(db_pool.get().await?.deref_mut(), infra.infra_id, || {
        InfraApiError::NotFound {
            infra_id: infra.infra_id,
        }
    })
    .await?;

    let infra =
        InfraCache::get_or_load(db_pool.get().await?.deref_mut(), &infra_caches, &infra).await?;
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
    let conn = &mut db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn, infra.infra_id, || InfraApiError::NotFound {
        infra_id: infra.infra_id,
    })
    .await?;
    let speed_limits_tags = infra.get_speed_limit_tags(conn).await?;
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
    let include_rolling_stock_modes = param.into_inner().include_rolling_stock_modes;
    let conn = &mut db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn, infra.infra_id, || InfraApiError::NotFound {
        infra_id: infra.infra_id,
    })
    .await?;
    let voltages = infra
        .get_voltages(conn, include_rolling_stock_modes)
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
    let conn = &mut db_pool.get().await?;
    let voltages = Infra::get_all_voltages(conn).await?;
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

/// Instructs Core to load an infra
#[utoipa::path(
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 204, description = "The infra was loaded successfully"),
        (status = 404, description = "The infra was not found"),
    )
)]
#[post("/load")]
async fn load(
    path: Path<InfraIdParam>,
    db_pool: Data<DbConnectionPool>,
    core: Data<CoreClient>,
) -> Result<HttpResponse> {
    let conn = &mut db_pool.get().await?;
    let infra_id = path.infra_id;
    let infra =
        Infra::retrieve_or_fail(conn, infra_id, || InfraApiError::NotFound { infra_id }).await?;
    let infra_request = InfraLoadRequest {
        infra: infra.id,
        expected_version: infra.version,
    };
    infra_request.fetch(core.as_ref()).await?;
    Ok(HttpResponse::NoContent().finish())
}

/// Builds a Core cache_status request, runs it
pub async fn fetch_infra_state(infra_id: i64, core: &CoreClient) -> Result<InfraStateResponse> {
    Ok(InfraStateRequest {
        infra: Some(infra_id),
    }
    .fetch(core)
    .await?
    .get(&infra_id.to_string())
    .cloned()
    .unwrap_or_default())
}

pub async fn fetch_all_infra_states(
    core: &CoreClient,
) -> Result<HashMap<String, InfraStateResponse>> {
    InfraStateRequest::default().fetch(core).await
}

#[cfg(test)]
pub mod tests {
    use actix_http::Request;
    use actix_web::http::StatusCode;
    use actix_web::test as actix_test;
    use actix_web::test::call_service;
    use actix_web::test::read_body_json;
    use actix_web::test::TestRequest;
    use diesel::sql_query;
    use diesel::sql_types::BigInt;
    use diesel_async::RunQueryDsl;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;
    use std::ops::DerefMut;
    use std::sync::Arc;
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
    use crate::modelsv2::fixtures::create_empty_infra;
    use crate::modelsv2::get_geometry_layer_table;
    use crate::modelsv2::get_table;
    use crate::modelsv2::infra::DEFAULT_INFRA_VERSION;
    use crate::views::test_app::TestAppBuilder;
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
    async fn infra_clone_empty(db_pool: Arc<DbConnectionPool>) {
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
    async fn infra_clone(db_pool: Arc<DbConnectionPool>) {
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
    async fn infra_delete() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        let response = call_service(&app.service, delete_infra_request(empty_infra.id)).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let response = call_service(&app.service, delete_infra_request(empty_infra.id)).await;
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
    async fn default_infra_create(db_pool: Arc<DbConnectionPool>) {
        let app = TestAppBuilder::default_app();
        let req = TestRequest::post()
            .uri("/infra")
            .set_json(json!({ "name": "create_infra_test" }))
            .to_request();
        let response = call_service(&app.service, req).await;
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
    async fn infra_get() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = MockingClient::new();
        core.stub("/cache_status")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body("{}")
            .finish();

        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
        let empty_infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        let req = TestRequest::get()
            .uri(format!("/infra/{}", empty_infra.id).as_str())
            .to_request();
        let response = call_service(&app.service, req).await;
        assert_eq!(response.status(), StatusCode::OK);

        empty_infra
            .delete(db_pool.get_ok().deref_mut())
            .await
            .unwrap();

        let req = TestRequest::get()
            .uri(format!("/infra/{}", empty_infra.id).as_str())
            .to_request();
        let response = call_service(&app.service, req).await;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn infra_rename() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        let req = TestRequest::put()
            .uri(format!("/infra/{}", empty_infra.id).as_str())
            .set_json(json!({"name": "rename_test"}))
            .to_request();
        let response = call_service(&app.service, req).await;
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
    async fn infra_get_switch_types() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(db_pool.get_ok().deref_mut()).await;

        let req = TestRequest::get()
            .uri(format!("/infra/{}/switch_types/", empty_infra.id).as_str())
            .to_request();
        let response = call_service(&app.service, req).await;
        assert_eq!(response.status(), StatusCode::OK);
        let switch_types: Vec<SwitchType> = read_body_json(response).await;
        assert_eq!(switch_types.len(), 5);
    }

    #[rstest]
    async fn infra_lock(#[future] empty_infra: TestFixture<Infra>, db_pool: Arc<DbConnectionPool>) {
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
        let conn = &mut db_pool.get().await.unwrap();
        let infra = Infra::retrieve(conn, infra_id)
            .await
            .unwrap()
            .expect("infra was not cloned");
        assert!(infra.locked);

        // Unlock infra
        let req = TestRequest::post()
            .uri(format!("/infra/{}/unlock/", infra_id).as_str())
            .to_request();
        let response = call_service(&app, req).await;
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        // Check lock
        let infra = Infra::retrieve(conn, infra_id)
            .await
            .unwrap()
            .expect("infra was not cloned");
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
}
