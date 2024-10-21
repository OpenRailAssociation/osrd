mod attached;
mod auto_fixes;
mod edition;
mod errors;
mod lines;
mod objects;
mod pathfinding;
mod railjson;
mod routes;

use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Extension;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;
use editoast_osrdyne_client::OsrdyneClient;
use itertools::Itertools;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::pagination::PaginationStats;
use super::params::List;
use super::AuthenticationExt;
use crate::core::infra_loading::InfraLoadRequest;
use crate::core::AsCoreRequest;
use crate::error::Result;
use crate::infra_cache::InfraCache;
use crate::infra_cache::ObjectCache;
use crate::map;
use crate::models::prelude::*;
use crate::models::Infra;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParam;
use crate::views::AuthorizationError;
use crate::AppState;
use editoast_models::DbConnectionPoolV2;
use editoast_schemas::infra::SwitchType;

crate::routes! {
    "/infra" => {
        list,
        create,
        "/refresh" => refresh,
        "/voltages" => get_all_voltages,
        &railjson,
        "/{infra_id}" => {
            &objects,
            &routes,
            &lines,
            &auto_fixes,
            &pathfinding,
            &attached,
            &edition,
            &errors,

            get,
            "/load" => load,
            delete,
            put,
            "/clone" => clone,
            "/lock" => lock,
            "/unlock" => unlock,
            "/speed_limit_tags" => get_speed_limit_tags,
            "/voltages" => get_voltages,
            "/switch_types" => get_switch_types,
        },
    },
}

editoast_common::schemas! {
    pathfinding::schemas(),
    InfraState,
    InfraWithState,
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
#[into_params(parameter_in = Query)]
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
    post, path = "",
    tag = "infra",
    params(RefreshQueryParams),
    responses(
        (status = 200, body = inline(RefreshResponse)),
        (status = 404, description = "Invalid infra ID query parameters"),
    )
)]
async fn refresh(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    Query(query_params): Query<RefreshQueryParams>,
) -> Result<Json<RefreshResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let valkey_client = app_state.valkey.clone();
    let infra_caches = app_state.infra_caches.clone();
    let map_layers = app_state.map_layers.clone();

    // Use a transaction to give scope to infra list lock
    let RefreshQueryParams {
        force,
        infras: List(infras),
    } = query_params;

    let infras_list = if infras.is_empty() {
        // Retrieve all available infra
        Infra::all(&mut db_pool.get().await?).await
    } else {
        // Retrieve given infras
        Infra::retrieve_batch_or_fail(&mut db_pool.get().await?, infras, |missing| {
            InfraApiError::NotFound {
                infra_id: missing.into_iter().next().unwrap(),
            }
        })
        .await?
    };

    // Refresh each infras
    let db_pool = db_pool;
    let mut infra_refreshed = vec![];

    for mut infra in infras_list {
        let infra_cache =
            InfraCache::get_or_load(&mut db_pool.get().await?, &infra_caches, &infra).await?;
        if infra.refresh(db_pool.clone(), force, &infra_cache).await? {
            infra_refreshed.push(infra.id);
        }
    }

    let mut conn = valkey_client.get_connection().await?;
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
    get, path = "",
    tag = "infra",
    params(PaginationQueryParam),
    responses(
        (status = 200, description = "All infras, paginated", body = inline(InfraListResponse))
    ),
)]
async fn list(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    pagination_params: Query<PaginationQueryParam>,
) -> Result<Json<InfraListResponse>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }
    let db_pool = app_state.db_pool_v2.clone();
    let osrdyne_client = app_state.osrdyne_client.clone();

    let settings = pagination_params
        .validate(1000)?
        .warn_page_size(100)
        .into_selection_settings();

    let (infras, stats) = {
        let conn = &mut db_pool.get().await?;
        Infra::list_paginated(conn, settings).await?
    };

    let infra_states = fetch_all_infra_states(&infras, osrdyne_client.as_ref()).await?;

    let response = InfraListResponse {
        stats,
        results: infras
            .into_iter()
            .map(|infra| {
                let state = infra_states
                    .get(&infra.id.to_string())
                    .cloned()
                    .unwrap_or(InfraState::NotLoaded);
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

impl From<editoast_osrdyne_client::WorkerStatus> for InfraState {
    fn from(status: editoast_osrdyne_client::WorkerStatus) -> Self {
        match status {
            editoast_osrdyne_client::WorkerStatus::Unscheduled => InfraState::NotLoaded,
            editoast_osrdyne_client::WorkerStatus::Started => InfraState::Initializing,
            editoast_osrdyne_client::WorkerStatus::Ready => InfraState::Cached,
            editoast_osrdyne_client::WorkerStatus::Error => InfraState::Error,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
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
    get, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200, description = "The infra", body = InfraWithState),
        (status = 404, description = "Infra ID not found"),
    ),
)]
async fn get(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(infra): Path<InfraIdParam>,
) -> Result<Json<InfraWithState>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let osrdyne_client = app_state.osrdyne_client.clone();

    let infra_id = infra.infra_id;
    let infra = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;
    let state = fetch_infra_state(infra.id, osrdyne_client.as_ref()).await?;
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
    post, path = "",
    tag = "infra",
    request_body = inline(InfraCreateForm),
    responses(
        (status = 201, description = "The created infra", body = Infra),
    ),
)]
async fn create(
    db_pool: State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Json(infra_form): Json<InfraCreateForm>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let infra: Changeset<Infra> = infra_form.into();
    let infra = infra.create(&mut db_pool.get().await?).await?;
    Ok((StatusCode::CREATED, Json(infra)))
}

#[derive(Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
struct CloneQuery {
    /// The name of the new infra
    name: String,
}

/// Duplicate an infra
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam, CloneQuery),
    responses(
        (status = 200, description = "The new infra ID", body = u64),
        (status = 404, description = "Infra ID not found"),
    ),
)]
async fn clone(
    Extension(auth): AuthenticationExt,
    Path(params): Path<InfraIdParam>,
    db_pool: State<DbConnectionPoolV2>,
    Query(CloneQuery { name }): Query<CloneQuery>,
) -> Result<Json<i64>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let conn = &mut db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn, params.infra_id, || InfraApiError::NotFound {
        infra_id: params.infra_id,
    })
    .await?;
    let cloned_infra = infra.clone(conn, name).await?;
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
    delete, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 204, description = "The infra has been deleted"),
        (status = 404, description = "Infra ID not found"),
    ),
)]
async fn delete(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    infra: Path<InfraIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let infra_caches = app_state.infra_caches.clone();
    let infra_id = infra.infra_id;
    if Infra::fast_delete_static(db_pool.get().await?, infra_id).await? {
        infra_caches.remove(&infra_id);
        Ok(StatusCode::NO_CONTENT)
    } else {
        Ok(StatusCode::NOT_FOUND)
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
    put, path = "",
    tag = "infra",
    params(InfraIdParam),
    request_body = inline(InfraPatchForm),
    responses(
        (status = 200, description = "The infra has been renamed", body = Infra),
        (status = 404, description = "Infra ID not found"),
    ),
)]
async fn put(
    db_pool: State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
    Path(infra): Path<i64>,
    Json(patch): Json<InfraPatchForm>,
) -> Result<Json<Infra>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let infra_cs: Changeset<Infra> = patch.into();
    let infra = infra_cs
        .update_or_fail(&mut db_pool.get().await?, infra, || {
            InfraApiError::NotFound { infra_id: infra }
        })
        .await?;
    Ok(Json(infra))
}

/// Return the railjson list of switch types
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200, description = "A list of switch types", body = Vec<SwitchType>),
        (status = 404, description = "The infra was not found"),
    )
)]
async fn get_switch_types(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(infra): Path<InfraIdParam>,
) -> Result<Json<Vec<SwitchType>>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let conn = &mut db_pool.get().await?;
    let infra_caches = app_state.infra_caches.clone();

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
    get, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200, description = "List all speed limit tags", body = Vec<String>,  example = json!(["freight", "heavy_load"])),
        (status = 404, description = "The infra was not found"),
    )
)]
async fn get_speed_limit_tags(
    Extension(auth): AuthenticationExt,
    Path(infra): Path<InfraIdParam>,
    db_pool: State<DbConnectionPoolV2>,
) -> Result<Json<Vec<String>>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

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
#[into_params(parameter_in = Query)]
struct GetVoltagesQueryParams {
    #[serde(default)]
    include_rolling_stock_modes: bool,
}

/// Returns the set of voltages for a given infra and/or rolling_stocks modes.
/// If include_rolling_stocks_modes is true, it returns also rolling_stocks modes.
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(InfraIdParam, GetVoltagesQueryParams),
    responses(
        (status = 200,  description = "Voltages list", body = Vec<String>, example = json!(["750V", "1500V", "2500.5V"])),
        (status = 404, description = "The infra was not found",),
    )
)]
async fn get_voltages(
    Extension(auth): AuthenticationExt,
    Path(infra): Path<InfraIdParam>,
    Query(param): Query<GetVoltagesQueryParams>,
    db_pool: State<DbConnectionPoolV2>,
) -> Result<Json<Vec<String>>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let include_rolling_stock_modes = param.include_rolling_stock_modes;
    let infra = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra.infra_id, || {
        InfraApiError::NotFound {
            infra_id: infra.infra_id,
        }
    })
    .await?;
    let voltages = infra
        .get_voltages(&mut db_pool.get().await?, include_rolling_stock_modes)
        .await?;
    Ok(Json(voltages.into_iter().map(|el| (el.voltage)).collect()))
}

/// Returns the set of voltages for all infras and rolling_stocks modes.
#[utoipa::path(
    get, path = "",
    tag = "infra,rolling_stock",
    responses(
        (status = 200,  description = "Voltages list", body = Vec<String>, example = json!(["750V", "1500V", "2500.5V"])),
        (status = 404, description = "The infra was not found",),
    )
)]
async fn get_all_voltages(
    db_pool: State<DbConnectionPoolV2>,
    Extension(auth): AuthenticationExt,
) -> Result<Json<Vec<String>>> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let voltages = Infra::get_all_voltages(&mut db_pool.get().await?).await?;
    Ok(Json(voltages.into_iter().map(|el| (el.voltage)).collect()))
}

async fn set_locked(infra_id: i64, locked: bool, db_pool: DbConnectionPoolV2) -> Result<()> {
    let mut infra = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;
    infra.locked = locked;
    infra.save(&mut db_pool.get().await?).await
}

/// Lock an infra
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 204, description = "The infra was locked successfully"),
        (status = 404, description = "The infra was not found",),
    )
)]
async fn lock(
    Extension(auth): AuthenticationExt,
    Path(infra): Path<InfraIdParam>,
    State(db_pool): State<DbConnectionPoolV2>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    set_locked(infra.infra_id, true, db_pool).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Unlock an infra
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 204, description = "The infra was unlocked successfully"),
        (status = 404, description = "The infra was not found",),
    )
)]
async fn unlock(
    Extension(auth): AuthenticationExt,
    Path(infra): Path<InfraIdParam>,
    State(db_pool): State<DbConnectionPoolV2>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraWrite].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    set_locked(infra.infra_id, false, db_pool).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Instructs Core to load an infra
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 204, description = "The infra was loaded successfully"),
        (status = 404, description = "The infra was not found"),
    )
)]
async fn load(
    app_state: State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(path): Path<InfraIdParam>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([BuiltinRole::InfraRead].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let db_pool = app_state.db_pool_v2.clone();
    let core_client = app_state.core_client.clone();

    let infra_id = path.infra_id;
    let infra = Infra::retrieve_or_fail(&mut db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;
    let infra_request = InfraLoadRequest {
        infra: infra.id,
        expected_version: infra.version,
    };
    infra_request.fetch(core_client.as_ref()).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra_state")]
pub enum InfraStateError {
    #[error("Failed to fetch infra state: {0}")]
    #[editoast_error(status = 500)]
    FetchError(#[from] editoast_osrdyne_client::Error),
}

pub async fn fetch_infra_state(infra_id: i64, osrdyne: &OsrdyneClient) -> Result<InfraState> {
    let status = osrdyne
        .get_worker_status(&infra_id.to_string())
        .await
        .map_err(InfraStateError::FetchError)?;
    Ok(status.into())
}

pub async fn fetch_all_infra_states(
    infras: &[Infra],
    osrdyne: &OsrdyneClient,
) -> Result<HashMap<String, InfraState>> {
    let ids = infras
        .iter()
        .map(|infra| infra.id.to_string())
        .collect_vec();
    let statuses = osrdyne
        .get_workers_statuses(&ids)
        .await
        .map_err(InfraStateError::FetchError)?;

    Ok(statuses
        .into_iter()
        .map(|(id, status)| (id, status.into()))
        .collect())
}

#[cfg(test)]
pub mod tests {
    use axum::http::StatusCode;
    use diesel::sql_query;
    use diesel::sql_types::BigInt;
    use diesel_async::RunQueryDsl;
    use editoast_osrdyne_client::WorkerStatus;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use serde_json::json;
    use std::ops::DerefMut;
    use strum::IntoEnumIterator;

    use super::*;
    use crate::core::mocking::MockingClient;
    use crate::core::CoreClient;
    use crate::generated_data;
    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::models::fixtures::create_empty_infra;
    use crate::models::fixtures::create_rolling_stock_with_energy_sources;
    use crate::models::fixtures::create_small_infra;
    use crate::models::get_geometry_layer_table;
    use crate::models::get_table;
    use crate::models::infra::DEFAULT_INFRA_VERSION;
    use crate::views::test_app::TestApp;
    use crate::views::test_app::TestAppBuilder;
    use editoast_osrdyne_client::OsrdyneClient;
    use editoast_schemas::infra::Electrification;
    use editoast_schemas::infra::Speed;
    use editoast_schemas::infra::SpeedSection;
    use editoast_schemas::infra::SwitchType;
    use editoast_schemas::infra::RAILJSON_VERSION;
    use editoast_schemas::primitives::ObjectType;

    impl TestApp {
        fn delete_infra_request(&self, infra_id: i64) -> axum_test::TestRequest {
            self.delete(format!("/infra/{infra_id}").as_str())
        }
    }

    #[rstest]
    #[serial_test::serial]
    async fn infra_clone_empty() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let request =
            app.post(format!("/infra/{}/clone/?name=cloned_infra", empty_infra.id).as_str());

        let cloned_infra_id: i64 = app.fetch(request).assert_status(StatusCode::OK).json_into();
        let cloned_infra = Infra::retrieve(&mut db_pool.get_ok(), cloned_infra_id)
            .await
            .unwrap()
            .expect("infra was not cloned");
        assert_eq!(cloned_infra.name, "cloned_infra");
    }

    #[derive(QueryableByName)]
    struct Count {
        #[diesel(sql_type = BigInt)]
        nb: i64,
    }

    #[rstest] // Slow test
    #[serial_test::serial]
    async fn infra_clone() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let small_infra_id = small_infra.id;
        let infra_cache = InfraCache::load(&mut db_pool.get_ok(), &small_infra)
            .await
            .unwrap();

        generated_data::refresh_all(db_pool.clone(), small_infra_id, &infra_cache)
            .await
            .unwrap();

        let switch_type = SwitchType {
            id: "test_switch_type".into(),
            ..Default::default()
        }
        .into();
        apply_create_operation(&switch_type, small_infra_id, &mut db_pool.get_ok())
            .await
            .expect("Failed to create switch_type object");

        let req_clone =
            app.post(format!("/infra/{}/clone/?name=cloned_infra", small_infra_id).as_str());

        let cloned_infra_id: i64 = app
            .fetch(req_clone)
            .assert_status(StatusCode::OK)
            .json_into();

        let _cloned_infra = Infra::retrieve(&mut db_pool.get_ok(), cloned_infra_id)
            .await
            .unwrap()
            .expect("infra was not cloned");

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
                .get_result::<Count>(&mut db_pool.get_ok().write().await.deref_mut())
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
        let pool = DbConnectionPoolV2::for_tests_no_transaction();
        let app = TestAppBuilder::new()
            .db_pool(pool)
            .core_client(CoreClient::Mocked(MockingClient::default()))
            .build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        app.fetch(app.delete_infra_request(empty_infra.id))
            .assert_status(StatusCode::NO_CONTENT);

        app.fetch(app.delete_infra_request(empty_infra.id))
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn infra_list() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/infra/");
        app.fetch(request).assert_status(StatusCode::OK);
    }

    #[rstest]
    async fn default_infra_create() {
        let app = TestAppBuilder::default_app();

        let request = app
            .post("/infra")
            .json(&json!({ "name": "create_infra_test" }));
        let infra: Infra = app
            .fetch(request)
            .assert_status(StatusCode::CREATED)
            .json_into();

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
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let req = app.get(format!("/infra/{}", empty_infra.id).as_str());

        app.fetch(req).assert_status(StatusCode::OK);

        empty_infra.delete(&mut db_pool.get_ok()).await.unwrap();

        let req = app.get(format!("/infra/{}", empty_infra.id).as_str());

        app.fetch(req).assert_status(StatusCode::NOT_FOUND);
    }

    #[rstest]
    async fn infra_rename() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let req = app
            .put(format!("/infra/{}", empty_infra.id).as_str())
            .json(&json!({"name": "rename_test"}));

        let infra: Infra = app.fetch(req).assert_status(StatusCode::OK).json_into();

        assert_eq!(infra.name, "rename_test");
    }

    #[derive(Deserialize)]
    struct InfraRefreshedResponse {
        infra_refreshed: Vec<i64>,
    }

    #[rstest]
    async fn infra_refresh() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let req = app.post(format!("/infra/refresh/?infras={}", empty_infra.id).as_str());

        let refreshed_infras: InfraRefreshedResponse =
            app.fetch(req).assert_status(StatusCode::OK).json_into();
        assert_eq!(refreshed_infras.infra_refreshed, vec![empty_infra.id]);
    }

    #[rstest]
    // Slow test
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    #[serial_test::serial]
    async fn infra_refresh_force() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let req =
            app.post(format!("/infra/refresh/?infras={}&force=true", empty_infra.id).as_str());
        let refreshed_infras: InfraRefreshedResponse =
            app.fetch(req).assert_status(StatusCode::OK).json_into();
        assert!(refreshed_infras.infra_refreshed.contains(&empty_infra.id));
    }

    #[rstest]
    async fn infra_get_speed_limit_tags() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let speed_section = SpeedSection {
            speed_limit_by_tag: HashMap::from([("test_tag".into(), Speed(10.))]),
            ..Default::default()
        }
        .into();
        apply_create_operation(&speed_section, empty_infra.id, &mut db_pool.get_ok())
            .await
            .expect("Failed to create speed section object");

        let req = app.get(format!("/infra/{}/speed_limit_tags/", empty_infra.id).as_str());

        let speed_limit_tags: Vec<String> =
            app.fetch(req).assert_status(StatusCode::OK).json_into();

        assert_eq!(speed_limit_tags, vec!["test_tag"]);
    }

    #[rstest]
    async fn infra_get_all_voltages() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let infra_1 = create_empty_infra(&mut db_pool.get_ok()).await;
        let infra_2 = create_empty_infra(&mut db_pool.get_ok()).await;

        // Create electrifications
        let electrification_1 = Electrification {
            id: "test1".into(),
            voltage: "0V".into(),
            track_ranges: vec![],
        }
        .into();
        apply_create_operation(&electrification_1, infra_1.id, &mut db_pool.get_ok())
            .await
            .expect("Failed to create electrification_1 object");

        let electrification_2 = Electrification {
            id: "test2".into(),
            voltage: "1V".into(),
            track_ranges: vec![],
        }
        .into();
        apply_create_operation(&electrification_2, infra_2.id, &mut db_pool.get_ok())
            .await
            .expect("Failed to create electrification_2 object");

        // Create rolling_stock
        let _rolling_stock = create_rolling_stock_with_energy_sources(
            &mut db_pool.get_ok(),
            "other_rolling_stock_infra_get_all_voltages",
        )
        .await;

        let req = app.get("/infra/voltages/");

        let voltages: Vec<String> = app.fetch(req).assert_status(StatusCode::OK).json_into();

        assert!(voltages.len() >= 3);
        assert!(voltages.contains(&String::from("0V")));
        assert!(voltages.contains(&String::from("1V")));
        assert!(voltages.contains(&String::from("25000V")));
    }

    #[rstest]
    #[case(true)]
    #[case(false)]
    async fn infra_get_voltages(#[case] include_rolling_stock_modes: bool) {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        // Create electrification
        let electrification = Electrification {
            id: "test".into(),
            voltage: "0".into(),
            track_ranges: vec![],
        }
        .into();
        apply_create_operation(&electrification, empty_infra.id, &mut db_pool.get_ok())
            .await
            .expect("Failed to create electrification object");

        // Create rolling_stock
        let _rolling_stock = create_rolling_stock_with_energy_sources(
            &mut db_pool.get_ok(),
            "other_rolling_stock_infra_get_voltages",
        )
        .await;

        let req = app.get(
            format!(
                "/infra/{}/voltages/?include_rolling_stock_modes={}",
                empty_infra.id, include_rolling_stock_modes
            )
            .as_str(),
        );

        if !include_rolling_stock_modes {
            let voltages: Vec<String> = app.fetch(req).assert_status(StatusCode::OK).json_into();
            assert_eq!(voltages[0], "0");
            assert_eq!(voltages.len(), 1);
        } else {
            let voltages: Vec<String> = app.fetch(req).assert_status(StatusCode::OK).json_into();
            assert!(voltages.contains(&String::from("25000V")));
            assert!(voltages.len() >= 2);
        }
    }

    #[rstest]
    async fn infra_get_switch_types() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let req = app.get(format!("/infra/{}/switch_types/", empty_infra.id).as_str());

        let switch_types: Vec<SwitchType> =
            app.fetch(req).assert_status(StatusCode::OK).json_into();

        assert_eq!(switch_types.len(), 5);
    }

    #[rstest]
    async fn infra_lock() {
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
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        // Lock infra
        let req = app.post(format!("/infra/{}/lock/", empty_infra.id).as_str());

        app.fetch(req).assert_status(StatusCode::NO_CONTENT);

        // Check lock
        let infra = Infra::retrieve(&mut db_pool.get_ok(), empty_infra.id)
            .await
            .unwrap()
            .expect("infra was not cloned");
        assert!(infra.locked);

        // Unlock infra
        let req = app.post(format!("/infra/{}/unlock/", empty_infra.id).as_str());

        app.fetch(req).assert_status(StatusCode::NO_CONTENT);

        // Check lock
        let infra = Infra::retrieve(&mut db_pool.get_ok(), empty_infra.id)
            .await
            .unwrap()
            .expect("infra was not cloned");
        assert!(!infra.locked);
    }

    #[rstest]
    async fn infra_load_core() {
        let db_pool = DbConnectionPoolV2::for_tests();
        let mut core = MockingClient::new();
        core.stub("/infra_load")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body("{}")
            .finish();

        let app = TestAppBuilder::new()
            .db_pool(db_pool.clone())
            .core_client(core.into())
            .build();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let req = app.post(format!("/infra/{}/load", empty_infra.id).as_str());

        app.fetch(req).assert_status(StatusCode::NO_CONTENT);
    }

    #[rstest]
    async fn infra_status() {
        let db_pool: DbConnectionPoolV2 = DbConnectionPoolV2::for_tests();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let osrdyne_client = OsrdyneClient::mock()
            .with_status(&empty_infra.id.to_string(), WorkerStatus::Ready)
            .build();
        let app = TestAppBuilder::new()
            .db_pool(db_pool)
            .core_client(CoreClient::Mocked(MockingClient::default()))
            .osrdyne_client(osrdyne_client)
            .build();

        let req = app.get(format!("/infra/{}/", empty_infra.id).as_str());
        let response: InfraWithState = app.fetch(req).assert_status(StatusCode::OK).json_into();
        assert_eq!(response.state, InfraState::Cached);
    }
}
