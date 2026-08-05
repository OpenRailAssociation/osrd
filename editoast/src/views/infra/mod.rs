pub(in crate::views) mod attached;
pub(in crate::views) mod auto_fixes;
pub(in crate::views) mod delimited_area;
pub(in crate::views) mod edition;
pub(in crate::views) mod errors;
pub(in crate::views) mod lines;
pub(in crate::views) mod objects;
pub(in crate::views) mod pathfinding;
pub(in crate::views) mod railjson;
pub(in crate::views) mod routes;

use authz::InfraGrant;
use authz::InfraPrivilege;
use authz::v2;
use authz::v2::Authorizer as _;
use authz::v2::Check;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use common::geometry::GeoJsonPoint;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use geos::Geom;
use itertools::Itertools;
use schemas::infra::SwitchType;
use schemas::primitives::Identifier;
use schemas::primitives::NonBlankString;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashSet;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::AuthenticationExt;
use super::pagination::PaginationStats;
use crate::AppState;
use crate::Arc;
use crate::authentication;
use crate::authorizers::SystemAuthorizer;
use crate::authorizers::UserAuthorizer;
use crate::authorizers::impossible;
use crate::error::Result;
use crate::generated_data::InfraGeneratedData as _;
use crate::generated_data::operational_point::OperationalPointLayer;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::infra_cache::InfraCache;
use crate::map;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParams;
use crate::views::params;
use crate::views::path::operational_point_cache::OperationalPointCache;
use authz::Role;
use editoast_models::Infra;
use editoast_models::SwitchTypeModel;
use schemas::infra::OperationalPoint;
use schemas::infra::OperationalPointPart;
use schemas::infra::builtin_node_types_list;
use schemas::train_schedule::OperationalPointReference;

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "infra")]
pub enum InfraApiError {
    /// Couldn't find the infra with the given id
    #[error("Infra '{infra_id}', could not be found")]
    #[editoast_error(status = 404)]
    NotFound { infra_id: i64 },

    #[error(transparent)]
    #[editoast_error(status = 500)]
    Database(#[from] editoast_models::Error),
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct InfraIdQueryParam {
    pub infra_id: i64,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct RefreshQueryParams {
    #[serde(default)]
    force: bool,
    /// A comma-separated list of infra IDs to refresh
    ///
    /// If not provided, all available infras will be refreshed.
    #[serde(default)]
    #[param(value_type = Vec<u64>)]
    infras: params::List<i64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub(in crate::views) struct RefreshResponse {
    /// The list of infras that were refreshed successfully
    infra_refreshed: Vec<i64>,
}

/// Refresh infra generated geographic layers
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(RefreshQueryParams),
    responses(
        (status = 200, body = inline(RefreshResponse)),
        (status = 404, description = "Invalid infra ID query parameters"),
    )
)]
pub(in crate::views) async fn refresh(
    State(AppState {
        db_pool,
        valkey_client,
        infra_caches,
        config,
        ..
    }): State<AppState>,
    Query(query_params): Query<RefreshQueryParams>,
) -> Result<Json<RefreshResponse>> {
    // Use a transaction to give scope to infra list lock
    let RefreshQueryParams {
        force,
        infras: params::List(infras),
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
    let mut infra_refreshed = vec![];

    for mut infra in infras_list {
        let infra_cache = InfraCache::get_or_load(
            &mut db_pool.get().await?,
            &infra_caches,
            &infra,
            &valkey_client,
            config.app_version.as_deref(),
        )
        .await?;
        if infra.refresh(db_pool.clone(), force, &infra_cache).await? {
            infra_refreshed.push(infra.id);
        }
    }

    let mut conn = valkey_client.clone().get_connection().await?;
    for infra_id in infra_refreshed.iter() {
        map::invalidate_all(&mut conn, *infra_id, config.app_version.as_deref()).await?;
    }

    Ok(Json(RefreshResponse { infra_refreshed }))
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct InfraListResponse {
    #[serde(flatten)]
    stats: PaginationStats,
    results: Vec<Infra>,
}

/// Lists all infras along with their current loading state in Core
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(PaginationQueryParams<1000>),
    responses(
        (status = 200, description = "All infras, paginated", body = inline(InfraListResponse))
    ),
)]
pub(in crate::views) async fn list(
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    Extension(authn): Extension<crate::authentication::State>,
    Query(pagination): Query<PaginationQueryParams<1000>>,
) -> Result<Json<InfraListResponse>> {
    let conn = &mut db_pool.get().await?;
    let default_settings = pagination.into_selection_settings();
    let settings = match authn {
        crate::authentication::State::Skip => default_settings,
        crate::authentication::State::Authenticated { user, roles } => {
            let authorizer =
                UserAuthorizer::new(user, roles.clone(), regulator.openfga(), conn.clone());
            let authorized_infras = authorizer
                .authorize(authz::v2::infra_list(user, InfraPrivilege::CanRead))
                .await?
                .access()
                .await?
                .map_err(|err| match err {
                    Check::SubjectExists(_) => unreachable!("checked above"),
                    _ => AuthorizationError::Forbidden,
                })?;
            match authorized_infras {
                authz::v2::ResourcesList::All => default_settings,
                authz::v2::ResourcesList::Privileged(authorized_infras) => {
                    default_settings.filter(move || {
                        Infra::ID.eq_any(authorized_infras.iter().map(|infra| infra.0).collect())
                    })
                }
            }
        }
    };
    let (infras, stats) =
        Infra::list_paginated(conn, settings.order_by(move || Infra::ID.asc())).await?;
    let response = InfraListResponse {
        stats,
        results: infras,
    };
    Ok(Json(response))
}

#[derive(IntoParams, Deserialize)]
#[allow(unused)]
pub(in crate::views) struct InfraIdParam {
    /// An existing infra ID
    infra_id: i64,
}

/// Retrieve a specific infra
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200, description = "The infra", body = Infra),
        (status = 404, description = "Infra ID not found"),
    ),
)]
pub(in crate::views) async fn get(
    State(AppState { db_pool, .. }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(infra): Path<InfraIdParam>,
) -> Result<Json<Infra>> {
    let infra_id = infra.infra_id;
    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    Ok(Json(infra))
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct InfraCreateForm {
    /// The name to give to the new infra
    pub name: String,
}

impl InfraCreateForm {
    pub fn into_changeset(self) -> Changeset<Infra> {
        Changeset::<Infra>::default()
            .name(self.name)
            .last_railjson_version()
    }
}

/// Creates an empty infra
///
/// The infra may be edited by batch later via the `POST /infra/ID` or `POST /infra/ID/railjson` endpoints.
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "infra",
    request_body = inline(InfraCreateForm),
    responses(
        (status = 201, description = "The created infra", body = Infra),
    ),
)]
pub(in crate::views) async fn create(
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    Extension(authn_state): Extension<authentication::State>,
    Json(infra_form): Json<InfraCreateForm>,
) -> Result<impl IntoResponse> {
    let infra: Changeset<Infra> = infra_form.into_changeset();
    let mut conn = db_pool.get().await?;
    let infra = infra.create(&mut conn).await?;

    if let authentication::State::Authenticated { user, .. } = &authn_state {
        match v2::infra_set_grant(
            authz::Subject::User(*user),
            authz::Infra(infra.id),
            InfraGrant::Owner,
        )
        .authorize(&SystemAuthorizer {
            openfga: regulator.openfga(),
            conn: conn.clone(),
        })
        .await?
        .access()
        .await?
        {
            Ok(()) => {}
            Err(v2::Check::SubjectExists(subject)) => {
                unreachable!("authenticated user should exist: {subject:?}")
            }
            Err(v2::Check::InfraExists(infra)) => {
                unreachable!("infra was just created: {infra:?}")
            }
            Err(
                check @ (v2::Check::HasInfraPrivilege(..)
                | v2::Check::CanAlterSubjectInfraGrant(..)),
            ) => {
                unreachable!("SystemAuthorizer should not reject infra grant checks: {check:?}")
            }
            Err(check) => impossible!(check),
        }
    }

    Ok((StatusCode::CREATED, Json(infra)))
}

#[derive(Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct CloneQuery {
    /// The name of the new infra
    name: String,
}

/// Duplicate an infra
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam, CloneQuery),
    responses(
        (status = 200, description = "The new infra ID", body = u64),
        (status = 404, description = "Infra ID not found"),
    ),
)]
pub(in crate::views) async fn clone(
    Extension(auth): AuthenticationExt,
    Extension(authn_state): Extension<authentication::State>,
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    Query(CloneQuery { name }): Query<CloneQuery>,
) -> Result<Json<i64>> {
    let mut conn = db_pool.get().await?;
    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || InfraApiError::NotFound {
        infra_id,
    })
    .await?;

    // Check user privilege on infra
    auth.clone()
        .check_authorization(async |authorizer| {
            authorizer
                .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
                .await
        })
        .await?;

    let cloned_infra = infra.clone(&mut conn, name).await?;

    if let authentication::State::Authenticated { user, .. } = &authn_state {
        match v2::infra_set_grant(
            authz::Subject::User(*user),
            authz::Infra(cloned_infra.id),
            InfraGrant::Owner,
        )
        .authorize(&SystemAuthorizer {
            openfga: regulator.openfga(),
            conn: conn.clone(),
        })
        .await?
        .access()
        .await?
        {
            Ok(()) => {}
            Err(v2::Check::SubjectExists(subject)) => {
                unreachable!("authenticated user should exist: {subject:?}")
            }
            Err(v2::Check::InfraExists(infra)) => {
                unreachable!("infra was just cloned: {infra:?}")
            }
            Err(
                check @ (v2::Check::HasInfraPrivilege(..)
                | v2::Check::CanAlterSubjectInfraGrant(..)),
            ) => {
                unreachable!("SystemAuthorizer should not reject infra grant checks: {check:?}")
            }
            Err(check) => impossible!(check),
        }
    }

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
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    delete, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 204, description = "The infra has been deleted"),
        (status = 404, description = "Infra ID not found"),
    ),
)]
pub(in crate::views) async fn delete(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
) -> Result<impl IntoResponse> {
    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanDelete)
            .await
    })
    .await?;

    if Infra::fast_delete_static(db_pool.get().await?, infra_id).await? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Ok(StatusCode::NOT_FOUND)
    }
}

#[derive(Serialize, Deserialize, ToSchema)]
pub(in crate::views) struct InfraPatchForm {
    /// The new name to give the infra
    pub name: String,
}

impl InfraPatchForm {
    pub fn into_changeset(self) -> Changeset<Infra> {
        Infra::changeset().name(self.name)
    }
}

/// Rename an infra
#[editoast_derive::route(authz::Role::OperationalStudies)]
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
pub(in crate::views) async fn put(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Path(infra): Path<i64>,
    Json(patch): Json<InfraPatchForm>,
) -> Result<Json<Infra>> {
    let infra_cs: Changeset<Infra> = patch.into_changeset();
    let infra = infra_cs
        .update_or_fail(&mut db_pool.get().await?, infra, || {
            InfraApiError::NotFound { infra_id: infra }
        })
        .await?;
    Ok(Json(infra))
}

/// Return the railjson list of switch types
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200, description = "A list of switch types", body = Vec<SwitchType>),
        (status = 404, description = "The infra was not found"),
    )
)]
pub(in crate::views) async fn get_switch_types(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    Extension(auth): AuthenticationExt,
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
) -> Result<Json<Vec<SwitchType>>> {
    let mut conn = db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || InfraApiError::NotFound {
        infra_id,
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let selection_settings =
        SelectionSettings::new().filter(move || SwitchTypeModel::INFRA_ID.eq(infra.id));
    let switch_types_model = SwitchTypeModel::list(&mut conn, selection_settings).await?;

    let extended_switch_types = switch_types_model
        .into_iter()
        .map(SwitchType::from)
        .collect_vec();

    let builtin_switch_types = builtin_node_types_list();

    let union_switch_types = extended_switch_types
        .into_iter()
        .chain(builtin_switch_types)
        .collect_vec();

    Ok(Json(union_switch_types))
}

/// Returns the set of speed limit tags for a given infra
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 200, description = "List all speed limit tags", body = Vec<String>,  example = json!(["freight", "heavy_load"])),
        (status = 404, description = "The infra was not found"),
    )
)]
pub(in crate::views) async fn get_speed_limit_tags(
    Extension(auth): AuthenticationExt,
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
    State(builtin_tags): State<Arc<SpeedLimitTagIds>>,
) -> Result<Json<HashSet<String>>> {
    let mut conn = db_pool.get().await?;

    let infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || InfraApiError::NotFound {
        infra_id,
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let infra_tags = infra.get_speed_limit_tags(&mut conn).await?;
    let union_tags: HashSet<String> = infra_tags
        .into_iter()
        .map(|el| el.tag)
        .chain(builtin_tags.0.clone())
        .collect();
    Ok(Json(union_tags))
}

#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub(in crate::views) struct GetVoltagesQueryParams {
    #[serde(default)]
    include_rolling_stock_modes: bool,
}

/// Returns the set of voltages for a given infra and/or rolling_stocks modes.
/// If include_rolling_stocks_modes is true, it returns also rolling_stocks modes.
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tag = "infra",
    params(InfraIdParam, GetVoltagesQueryParams),
    responses(
        (status = 200,  description = "Voltages list", body = Vec<String>, example = json!(["750V", "1500V", "2500.5V"])),
        (status = 404, description = "The infra was not found",),
    )
)]
pub(in crate::views) async fn get_voltages(
    Extension(auth): AuthenticationExt,
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    Query(param): Query<GetVoltagesQueryParams>,
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
) -> Result<Json<Vec<String>>> {
    let include_rolling_stock_modes = param.include_rolling_stock_modes;
    let infra = Infra::retrieve_or_fail(db_pool.get().await?, infra_id, || {
        InfraApiError::NotFound { infra_id }
    })
    .await?;

    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;

    let voltages = infra
        .get_voltages(&mut db_pool.get().await?, include_rolling_stock_modes)
        .await?;
    Ok(Json(voltages.into_iter().map(|el| el.voltage).collect()))
}

/// Returns the set of voltages for all infras and rolling_stocks modes.
#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    tags = ["infra", "rolling_stock"],
    responses(
        (status = 200,  description = "Voltages list", body = Vec<String>, example = json!(["750V", "1500V", "2500.5V"])),
        (status = 404, description = "The infra was not found",),
    )
)]
pub(in crate::views) async fn get_all_voltages(
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
) -> Result<Json<Vec<String>>> {
    let voltages = Infra::get_all_voltages(&mut db_pool.get().await?).await?;
    Ok(Json(voltages.into_iter().map(|el| el.voltage).collect()))
}

async fn set_locked(mut conn: DbConnection, infra_id: i64, locked: bool) -> Result<()> {
    let mut infra = Infra::retrieve_or_fail(conn.clone(), infra_id, || InfraApiError::NotFound {
        infra_id,
    })
    .await?;

    infra.locked = locked;
    infra.save(&mut conn).await?;
    Ok(())
}

/// Lock an infra
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 204, description = "The infra was locked successfully"),
        (status = 404, description = "The infra was not found",),
    )
)]
pub(in crate::views) async fn lock(
    Extension(auth): AuthenticationExt,
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
) -> Result<impl IntoResponse> {
    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanWrite)
            .await
    })
    .await?;

    set_locked(db_pool.get().await?, infra_id, true).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Unlock an infra
#[editoast_derive::route(authz::Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    responses(
        (status = 204, description = "The infra was unlocked successfully"),
        (status = 404, description = "The infra was not found",),
    )
)]
pub(in crate::views) async fn unlock(
    Extension(auth): AuthenticationExt,
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    State(db_pool): State<Arc<DbConnectionPoolV2>>,
) -> Result<impl IntoResponse> {
    // Check user privilege on infra
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanWrite)
            .await
    })
    .await?;

    set_locked(db_pool.get().await?, infra_id, false).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize, ToSchema)]
#[cfg_attr(test, derive(Serialize))]
pub(in crate::views) struct MatchOperationalPointsForm {
    operational_point_references: Vec<OperationalPointReference>,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct RelatedOperationalPointPart {
    #[serde(flatten)]
    part: OperationalPointPart,
    #[schema(value_type = Option<GeoJsonPoint>)]
    geo: Option<geos::geojson::Geometry>,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct RelatedOperationalPoint {
    #[schema(inline)]
    id: Identifier,
    parts: Vec<RelatedOperationalPointPart>,
    #[serde(default)]
    weight: Option<u8>,
    #[schema(value_type = Option<GeoJsonPoint>)]
    geo: Option<geos::geojson::Geometry>,
    #[schema(inline)]
    pub name: NonBlankString,
    pub uic: Option<u32>,
    #[schema(inline)]
    pub plc: Option<NonBlankString>,
    #[schema(inline)]
    pub country_code: NonBlankString,
    #[schema(inline)]
    pub main_code: NonBlankString,
    #[schema(inline)]
    pub secondary_code: Option<NonBlankString>,
    pub is_passenger_station: bool,
    #[schema(inline)]
    pub secondary_name: Option<NonBlankString>,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct MatchOperationalPointsResponse {
    related_operational_points: Vec<Option<RelatedOperationalPoint>>,
}

#[editoast_derive::route(Role::OperationalStudies)]
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    request_body = inline(MatchOperationalPointsForm),
    responses(
        (status = 200, description = "
Take a list of operational point references and return for each of them the
operational point that it matches on a given infrastructure.
", body = inline(MatchOperationalPointsResponse))
    ),
)]
pub(in crate::views) async fn match_operational_points(
    State(AppState { db_pool, .. }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    Json(MatchOperationalPointsForm {
        operational_point_references,
    }): Json<MatchOperationalPointsForm>,
) -> Result<Json<MatchOperationalPointsResponse>> {
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;
    let mut conn = db_pool.get().await?;
    let op_cache = OperationalPointCache::load_from_operational_points(
        conn.clone(),
        infra_id,
        &operational_point_references,
    )
    .await?;

    let operational_points: Vec<Option<&OperationalPoint>> = operational_point_references
        .into_iter()
        // Retrieve related OP based on the input operational point identifier:
        .map(|operational_point_reference| op_cache.get_reference(operational_point_reference))
        .collect_vec();
    let related_operational_points =
        populate_op_geo(&mut conn, infra_id, &operational_points).await?;

    Ok(Json(MatchOperationalPointsResponse {
        related_operational_points,
    }))
}

fn compute_operational_point_geo(
    points: &[geos::geojson::Geometry],
) -> Option<geos::geojson::Geometry> {
    if points.is_empty() {
        return None;
    } else if points.len() == 1 {
        return Some(points[0].clone());
    }
    let geo_points = points
        .iter()
        .map(|geojson_point| {
            geos::Geometry::try_from(geojson_point).expect("invalid point geometry")
        })
        .collect();
    let center = geos::Geometry::create_multipoint(geo_points)
        .expect("invalid multi-point geometry")
        .get_centroid()
        .expect("failed to get centroid");
    Some(
        center
            .try_into()
            .expect("failed to convert centroid to geojson"),
    )
}

fn build_related_operational_point(
    op: &OperationalPoint,
    geo_points: Option<&Vec<geos::geojson::Geometry>>,
) -> RelatedOperationalPoint {
    RelatedOperationalPoint {
        id: op.id.clone(),
        parts: op
            .parts
            .iter()
            .enumerate()
            .map(|(i, part)| RelatedOperationalPointPart {
                part: part.clone(),
                geo: geo_points.and_then(|points| points.get(i).cloned()),
            })
            .collect(),
        weight: op.weight,
        geo: geo_points.and_then(|points| compute_operational_point_geo(points)),
        name: op.name.clone(),
        uic: op.uic,
        plc: op.plc.clone(),
        country_code: op.country_code.clone(),
        main_code: op.main_code.clone(),
        secondary_code: op.secondary_code.clone(),
        is_passenger_station: op.is_passenger_station,
        secondary_name: op.secondary_name.clone(),
    }
}

async fn populate_op_geo(
    conn: &mut DbConnection,
    infra_id: i64,
    operational_points: &[Option<&OperationalPoint>],
) -> Result<Vec<Option<RelatedOperationalPoint>>> {
    let op_ids = operational_points
        .iter()
        .filter_map(|opt_op| opt_op.map(|op| op.id.as_str()))
        .collect_vec();
    let geo_points = OperationalPointLayer::get(conn, infra_id, &op_ids).await?;

    Ok(operational_points
        .iter()
        .map(|opt_op| {
            opt_op.map(|op| build_related_operational_point(op, geo_points.get(op.id.as_str())))
        })
        .collect_vec())
}

#[cfg(test)]
pub mod tests {
    use axum::http::StatusCode;
    use core_client::CoreClient;
    use core_client::mocking::MockingClient;
    use diesel::sql_query;
    use diesel::sql_types::BigInt;
    use diesel_async::RunQueryDsl;
    use pretty_assertions::assert_eq;
    use rstest::rstest;
    use schemas::infra::Electrification;
    use schemas::infra::RAILJSON_VERSION;
    use schemas::infra::Speed;
    use schemas::infra::SpeedSection;
    use schemas::infra::SwitchType;
    use schemas::primitives::ObjectType;
    use serde_json::json;
    use std::collections::HashMap;
    use std::ops::DerefMut;
    use strum::IntoEnumIterator;

    use super::*;
    use crate::fixtures::create_empty_infra;
    use crate::fixtures::create_rolling_stock_with_energy_sources;
    use crate::fixtures::create_small_infra;
    use crate::generated_data;
    use crate::infra_cache::operation::create::apply_create_operation;
    use crate::views::test_app;
    use crate::views::test_app::TestRequestExt as _;
    use editoast_models::infra::DEFAULT_INFRA_VERSION;
    use editoast_models::infra_objects::get_geometry_layer_table;
    use editoast_models::infra_objects::get_table;
    use schemas::train_schedule::OperationalPointReference;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_clone_empty() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("thomas", "Thomas")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        let cloned_infra_id: i64 = app
            .post(format!("/infra/{}/clone/?name=cloned_infra", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        let cloned_infra = Infra::retrieve(db_pool.get_ok(), cloned_infra_id)
            .await
            .unwrap()
            .expect("infra was not cloned");
        assert_eq!(cloned_infra.name, "cloned_infra");
        app.assert_infra_grant(cloned_infra_id, user.id, Some(InfraGrant::Owner));
    }

    #[derive(QueryableByName)]
    struct Count {
        #[diesel(sql_type = BigInt)]
        nb: i64,
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_clone() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let small_infra = create_small_infra(&mut db_pool.get_ok()).await;
        let small_infra_id = small_infra.id;
        let user = app
            .user("thomas", "Thomas")
            .with_roles([Role::OperationalStudies])
            .with_infra_grant(small_infra_id, InfraGrant::Reader)
            .create()
            .await;
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

        let cloned_infra_id: i64 = app
            .post(format!("/infra/{small_infra_id}/clone/?name=cloned_infra").as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        let _cloned_infra = Infra::retrieve(db_pool.get_ok(), cloned_infra_id)
            .await
            .unwrap()
            .expect("infra was not cloned");
        app.assert_infra_grant(cloned_infra_id, user.id, Some(InfraGrant::Owner));

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
                    "SELECT COUNT (*) as nb from {table} where infra_id = $1"
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
            // TODO: add level_crossing on small_infra and adapt railjson
            // assert!(val[0] > 0);
            // check that we have the same number of objects in each table for both infras
            assert_eq!(val[0], val[1]);
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_delete() {
        let pool = DbConnectionPoolV2::for_tests();
        let app = test_app!()
            .db_pool(pool)
            .core_client(CoreClient::Mocked(MockingClient::default()))
            .build();
        let db_pool = app.db_pool();
        let infra_id = create_empty_infra(&mut db_pool.get_ok()).await.id;

        let user = app
            .user("user", "User")
            .with_infra_grant(infra_id, InfraGrant::Owner)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        app.delete(&format!("/infra/{infra_id}"))
            .by_user(user.as_ref())
            .await
            .assert_status_no_content();

        app.delete(&format!("/infra/{infra_id}"))
            .by_user(user.as_ref())
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_list() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_granted = create_small_infra(&mut db_pool.get_ok()).await;
        let _ = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(infra_granted.id, InfraGrant::Reader)
            .create()
            .await;
        let InfraListResponse {
            results: infras, ..
        } = app
            .get("/infra/")
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        assert_eq!(
            infras.iter().map(|infra| infra.id).collect_vec(),
            vec![infra_granted.id]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_list_filters_authorized_infras() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let infra_no_grant = create_small_infra(&mut db_pool.get_ok()).await;

        // Regular user with the correct roles should see only the infra he is associated with:
        let user = app
            .user("user_identity", "user_name")
            .with_infra_grant(infra.id, InfraGrant::Reader)
            .create()
            .await;
        let response: InfraListResponse = app
            .get("/infra/")
            .by_user(user.as_ref())
            .await
            .assert_status(StatusCode::OK)
            .json();
        assert_eq!(
            response.results.iter().map(|infra| infra.id).collect_vec(),
            vec![infra.id]
        );

        // An admin should see all the infras:
        let admin = app
            .user("admin", "admin")
            .with_roles([Role::Admin])
            .create()
            .await;
        let response: InfraListResponse = app
            .get("/infra/")
            .by_user(admin.as_ref())
            .await
            .assert_status(StatusCode::OK)
            .json();
        assert_eq!(
            response.results.iter().map(|infra| infra.id).collect_vec(),
            vec![infra.id, infra_no_grant.id]
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_list_impersonated_user() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_no_grant = create_small_infra(&mut db_pool.get_ok()).await;
        let infra_impersonated = create_small_infra(&mut db_pool.get_ok()).await;
        let impersonator = app
            .user("impersonator_identity", "impersonator_name")
            .with_roles([Role::Admin])
            .create()
            .await;
        let impersonated = app
            .user("impersonated_identity", "impersonated_name")
            .with_infra_grant(infra_impersonated.id, InfraGrant::Reader)
            .create()
            .await;

        let request_normal = app.get("/infra/").by_user(impersonator.as_ref());
        let request_impersonate = app
            .get("/infra/")
            .by_user(impersonator.as_ref())
            .impersonate(impersonated.as_ref());

        // The impersonator is admin and should see all the infras by default:
        let InfraListResponse {
            results: infras, ..
        } = request_normal.await.assert_status(StatusCode::OK).json();
        let infra_ids = infras.iter().map(|infra| infra.id).collect_vec();
        assert_eq!(infra_ids, vec![infra_no_grant.id, infra_impersonated.id]);

        // When impersonating, the impersonator should only see infras `impersonated` has access to:
        let InfraListResponse {
            results: infras, ..
        } = request_impersonate
            .await
            .assert_status(StatusCode::OK)
            .json();
        let infra_ids = infras.iter().map(|infra| infra.id).collect_vec();
        assert_eq!(infra_ids, vec![infra_impersonated.id]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn default_infra_create() {
        let app = test_app!().build();
        let user = app
            .user("thomas", "Thomas")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        let infra: Infra = app
            .post("/infra")
            .by_user(user.as_ref())
            .json(&json!({ "name": "create_infra_test" }))
            .await
            .assert_status(StatusCode::CREATED)
            .json();

        assert_eq!(infra.name, "create_infra_test");
        assert_eq!(infra.railjson_version, RAILJSON_VERSION);
        assert_eq!(infra.version, DEFAULT_INFRA_VERSION);
        assert_eq!(infra.generated_version, None);
        assert!(!infra.locked);
        app.assert_infra_grant(infra.id, user.id, Some(InfraGrant::Owner));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_get() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_id = create_empty_infra(&mut db_pool.get_ok()).await.id;
        let user = app
            .user("user", "User")
            .with_infra_grant(infra_id, InfraGrant::Reader)
            .create()
            .await;

        let infra: Infra = app
            .get(format!("/infra/{}", infra_id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        infra.delete(&mut db_pool.get_ok()).await.unwrap();

        app.get(format!("/infra/{}", infra_id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_not_found();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_rename() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_id = create_empty_infra(&mut db_pool.get_ok()).await.id;
        let user = app
            .user("user", "User")
            .with_infra_grant(infra_id, InfraGrant::Writer)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;
        let infra: Infra = app
            .put(format!("/infra/{}", infra_id).as_str())
            .json(&json!({"name": "rename_test"}))
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        assert_eq!(infra.id, infra.id);
        assert_eq!(infra.name, "rename_test");
    }

    #[derive(Deserialize)]
    struct InfraRefreshedResponse {
        infra_refreshed: Vec<i64>,
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_refresh() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_id = create_empty_infra(&mut db_pool.get_ok()).await.id;
        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        let refreshed_infras: InfraRefreshedResponse = app
            .post(format!("/infra/refresh/?infras={}", infra_id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        assert_eq!(refreshed_infras.infra_refreshed, vec![infra_id]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_refresh_force() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_id = create_empty_infra(&mut db_pool.get_ok()).await.id;
        let user = app
            .user("user", "User")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        // First call to refresh after creation, the infra should be refreshed
        let refreshed_infras: InfraRefreshedResponse = app
            .post(format!("/infra/refresh/?infras={}", infra_id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        assert_eq!(refreshed_infras.infra_refreshed, vec![infra_id]);
        // Second refresh call, nothing to refresh
        let refreshed_infras: InfraRefreshedResponse = app
            .post(format!("/infra/refresh/?infras={}", infra_id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        assert_eq!(refreshed_infras.infra_refreshed, Vec::<i64>::new());
        // Third call with the force option enabled, the infra should be refreshed
        let refreshed_infras: InfraRefreshedResponse = app
            .post(format!("/infra/refresh/?infras={}&force=true", infra_id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        assert_eq!(refreshed_infras.infra_refreshed, vec![infra_id]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_get_speed_limit_tags() {
        let app = test_app!().build();
        let builtin_tags = app.speed_limit_tag_ids();
        let db_pool = app.db_pool();
        let infra_id = create_empty_infra(&mut db_pool.get_ok()).await.id;
        let user = app
            .user("user", "User")
            .with_infra_grant(infra_id, InfraGrant::Reader)
            .create()
            .await;

        let speed_section = SpeedSection {
            speed_limit_by_tag: HashMap::from([("test_tag".into(), Speed(10.))]),
            ..Default::default()
        }
        .into();
        apply_create_operation(&speed_section, infra_id, &mut db_pool.get_ok())
            .await
            .expect("Failed to create speed section object");

        let mut speed_limit_tags: Vec<String> = app
            .get(format!("/infra/{}/speed_limit_tags/", infra_id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        let mut test_tags = builtin_tags.0.clone();
        test_tags.push("test_tag".to_string());

        assert_eq!(speed_limit_tags.sort(), test_tags.sort());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_get_speed_limit_tags_needs_reader_grant() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_id = create_empty_infra(&mut db_pool.get_ok()).await.id;
        let user_reader = app
            .user("alice", "Alice")
            .with_infra_grant(infra_id, InfraGrant::Reader)
            .create()
            .await;
        let user_no_grant = app.user("bob", "Bob").create().await;
        app.get(format!("/infra/{}/speed_limit_tags/", infra_id).as_str())
            .by_user(user_no_grant.as_ref())
            .await
            .assert_status_forbidden();
        app.get(format!("/infra/{}/speed_limit_tags/", infra_id).as_str())
            .by_user(user_reader.as_ref())
            .await
            .assert_status_ok();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_get_all_voltages() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_1 = create_empty_infra(&mut db_pool.get_ok()).await;
        let infra_2 = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app.user("user", "User").create().await;

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

        // Create a rolling stock with a 25000V mode
        let _ = create_rolling_stock_with_energy_sources(
            &mut db_pool.get_ok(),
            "other_rolling_stock_infra_get_all_voltages",
        )
        .await;

        let mut voltages: Vec<String> = app
            .get("/infra/voltages/")
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        voltages.sort();
        assert_eq!(&voltages, &["0V", "1V", "25000V"]);
    }

    #[rstest]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(true)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(false)]
    async fn infra_get_voltages(#[case] include_rolling_stock_modes: bool) {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        let electrification = Electrification {
            id: "test".into(),
            voltage: "0".into(),
            track_ranges: vec![],
        }
        .into();
        apply_create_operation(&electrification, empty_infra.id, &mut db_pool.get_ok())
            .await
            .expect("Failed to create electrification object");

        // Create a rolling stock with a 25000V mode
        let _ = create_rolling_stock_with_energy_sources(
            &mut db_pool.get_ok(),
            "other_rolling_stock_infra_get_voltages",
        )
        .await;

        let mut voltages: Vec<String> = app
            .get(
                format!(
                    "/infra/{}/voltages/?include_rolling_stock_modes={}",
                    empty_infra.id, include_rolling_stock_modes
                )
                .as_str(),
            )
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        voltages.sort();

        if !include_rolling_stock_modes {
            assert_eq!(&voltages, &["0"]);
        } else {
            assert_eq!(&voltages, &["0", "25000V"]);
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_get_voltages_needs_reader_grant() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_id = create_empty_infra(&mut db_pool.get_ok()).await.id;

        let user_no_grant = app.user("alice", "Alice").create().await;
        let user_reader = app
            .user("bob", "Bob")
            .with_infra_grant(infra_id, InfraGrant::Reader)
            .create()
            .await;

        app.get(format!("/infra/{infra_id}/voltages/",).as_str())
            .by_user(user_no_grant.as_ref())
            .await
            .assert_status_forbidden();
        app.get(format!("/infra/{infra_id}/voltages/",).as_str())
            .by_user(user_reader.as_ref())
            .await
            .assert_status_ok();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_get_switch_types() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(empty_infra.id, InfraGrant::Reader)
            .create()
            .await;

        let switch_types: Vec<SwitchType> = app
            .get(format!("/infra/{}/switch_types/", empty_infra.id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();

        assert_eq!(switch_types.len(), 5);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_lock() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_id = create_empty_infra(&mut db_pool.get_ok()).await.id;
        let user = app
            .user("user", "User")
            .with_infra_grant(infra_id, InfraGrant::Writer)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        // Lock infra
        app.post(format!("/infra/{}/lock/", infra_id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_no_content();

        // Check lock
        let infra = Infra::retrieve(db_pool.get_ok(), infra_id)
            .await
            .unwrap()
            .expect("infra was not cloned");
        assert!(infra.locked);

        // Unlock infra
        app.post(format!("/infra/{}/unlock/", infra_id).as_str())
            .by_user(user.as_ref())
            .await
            .assert_status_no_content();

        // Check lock
        let infra = Infra::retrieve(db_pool.get_ok(), infra_id)
            .await
            .unwrap()
            .expect("infra was not cloned");
        assert!(!infra.locked);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_lock_requires_writer_grant_and_operational_studies() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra_id = create_empty_infra(&mut db_pool.get_ok()).await.id;
        let user_missing_writer = app
            .user("alice", "Alice")
            .with_infra_grant(infra_id, InfraGrant::Reader)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;
        let user_missing_operational_studies = app
            .user("bob", "Bob")
            .with_infra_grant(infra_id, InfraGrant::Reader)
            .create()
            .await;
        app.post(format!("/infra/{infra_id}/lock/").as_str())
            .by_user(user_missing_writer.as_ref())
            .await
            .assert_status_forbidden();
        app.post(format!("/infra/{infra_id}/lock/").as_str())
            .by_user(user_missing_operational_studies.as_ref())
            .await
            .assert_status_forbidden();
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn match_operational_points() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let mut infra = create_small_infra(&mut db_pool.get_ok()).await;
        let infra_cache = InfraCache::load(&mut db_pool.get_ok(), &infra)
            .await
            .unwrap();
        let user = app
            .user("user", "User")
            .with_infra_grant(infra.id, InfraGrant::Reader)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;

        infra
            .refresh(db_pool.clone(), false, &infra_cache)
            .await
            .unwrap();
        let operational_point_references = vec![
            OperationalPointReference::Id {
                operational_point: ("West_station").into(),
            },
            OperationalPointReference::Trigram {
                trigram: "MES".into(),
                secondary_code: Some("BV".into()),
            },
            OperationalPointReference::Uic {
                uic: 8755,
                secondary_code: None,
            },
        ];
        let response: MatchOperationalPointsResponse = app
            .post(format!("/infra/{}/match_operational_points", infra.id).as_str())
            .json(&json!({
                "operational_point_references": operational_point_references,
            }))
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        let response_op_identifiers = response
            .related_operational_points
            .iter()
            .map(|opt_op| opt_op.as_ref().map(|op| op.id.as_str()))
            .collect_vec();
        let expected_identifiers: [Option<&str>; 3] =
            [Some("West_station"), Some("Mid_East_station"), None];
        assert_eq!(response_op_identifiers, expected_identifiers);
        assert_eq!(
            response.related_operational_points[0].as_ref().unwrap().geo,
            Some(geos::geojson::Geometry::new(geos::geojson::Value::Point(
                vec![-0.3907884636666667, 49.4999],
            )))
        );
        assert_eq!(
            response.related_operational_points[0]
                .as_ref()
                .unwrap()
                .parts[1]
                .geo,
            Some(geos::geojson::Geometry::new(geos::geojson::Value::Point(
                vec![-0.392307692, 49.4999],
            )))
        );
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn match_operational_point_input_with_incompatible_op_id_gets_filtered_out() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user = app
            .user("user", "User")
            .with_infra_grant(infra.id, InfraGrant::Reader)
            .with_roles([Role::OperationalStudies])
            .create()
            .await;
        let operational_point_references = vec![
            OperationalPointReference::Uic {
                uic: 8,
                secondary_code: None,
            },
            OperationalPointReference::Trigram {
                trigram: "MES".into(),
                secondary_code: Some("PAUL".into()),
            },
        ];
        let response: MatchOperationalPointsResponse = app
            .post(format!("/infra/{}/match_operational_points", infra.id).as_str())
            .json(&json!({
                "operational_point_references": operational_point_references,
            }))
            .by_user(user.as_ref())
            .await
            .assert_status_ok()
            .json();
        let response_op_identifiers = response
            .related_operational_points
            .iter()
            .map(|opt_op| opt_op.as_ref().map(|op| op.id.as_str()))
            .collect_vec();
        let expected_identifiers: [Option<&str>; 2] = [None, None];
        assert_eq!(response_op_identifiers, expected_identifiers);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn match_operational_points_requires_reader_and_operational_studies() {
        let app = test_app!().build();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let user_no_grant = app
            .user("alice", "Alice")
            .with_roles([Role::OperationalStudies])
            .create()
            .await;
        let user_no_role = app
            .user("bob", "Bob")
            .with_infra_grant(infra.id, InfraGrant::Reader)
            .create()
            .await;
        app.post(format!("/infra/{}/match_operational_points", infra.id).as_str())
            .json(&json!({"operational_point_references": []}))
            .by_user(user_no_grant.as_ref())
            .await
            .assert_status_forbidden();
        app.post(format!("/infra/{}/match_operational_points", infra.id).as_str())
            .json(&json!({"operational_point_references": []}))
            .by_user(user_no_role.as_ref())
            .await
            .assert_status_forbidden();
    }
}
