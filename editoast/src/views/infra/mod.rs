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

use authz;
use authz::InfraGrant;
use axum::Extension;
use axum::extract::Json;
use axum::extract::Path;
use axum::extract::Query;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use common::geometry::GeoJsonPoint;
use common::geometry::GeoJsonPointValue;
use database::DbConnection;
use database::DbConnectionPoolV2;
use editoast_derive::EditoastError;
use editoast_models::prelude::*;
use geos::CoordSeq;
use geos::Geom;
use geos::Geometry;
use itertools::Itertools;
use schemas::infra::SwitchType;
use schemas::primitives::Identifier;
use serde::Deserialize;
use serde::Serialize;
use std::collections::HashMap;
use std::collections::HashSet;
use thiserror::Error;
use utoipa::IntoParams;
use utoipa::ToSchema;

use super::Authentication;
use super::AuthenticationExt;
use super::pagination::PaginationStats;
use crate::AppState;
use crate::Arc;
use crate::error::Result;
use crate::generated_data::operational_point::OperationalPointLayer;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::infra_cache::InfraCache;
use crate::map;
use crate::models::Infra;
use crate::models::SwitchTypeModel;
use crate::models::TrackSectionModel;
use crate::views::AuthorizationError;
use crate::views::pagination::PaginatedList as _;
use crate::views::pagination::PaginationQueryParams;
use crate::views::params;
use crate::views::path::path_item_cache::PathItemCache;
use crate::views::path::path_item_cache::retrieve_op_from_ids;
use crate::views::path::path_item_cache::retrieve_op_from_trigrams;
use crate::views::path::path_item_cache::retrieve_op_from_uic;
use authz::Role;
use schemas::infra::OperationalPoint;
use schemas::infra::OperationalPointExtensions;
use schemas::infra::OperationalPointPart;
use schemas::infra::builtin_node_types_list;
use schemas::train_schedule::OperationalPointIdentifier;
use schemas::train_schedule::OperationalPointReference;
use schemas::train_schedule::PathItemLocation;

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
#[editoast_derive::route]
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
        map_layers,
        config,
        ..
    }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Query(query_params): Query<RefreshQueryParams>,
) -> Result<Json<RefreshResponse>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

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
            config.app_version.as_deref(),
        )
        .await?;
    }

    Ok(Json(RefreshResponse { infra_refreshed }))
}

#[derive(Serialize, ToSchema)]
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
    State(AppState { db_pool, .. }): State<AppState>,
    Extension(auth): AuthenticationExt,
    Query(pagination): Query<PaginationQueryParams<1000>>,
) -> Result<Json<InfraListResponse>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let conn = &mut db_pool.get().await?;

    let default_settings = pagination.into_selection_settings();
    let settings = match auth.list_authorized_infra().await? {
        authz::Authorization::Granted(infras) => default_settings
            .filter(move || Infra::ID.eq_any(infras.iter().map(|infra| infra.0).collect())),
        authz::Authorization::Bypassed => default_settings,
        authz::Authorization::Denied { reason } => {
            unreachable!("user is authenticated at this point: {reason}")
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
    // check user roles
    let has_role = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await?;
    if !has_role {
        return Err(AuthorizationError::Forbidden.into());
    }

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

impl From<InfraCreateForm> for Changeset<Infra> {
    fn from(infra: InfraCreateForm) -> Self {
        Self::default().name(infra.name).last_railjson_version()
    }
}

/// Creates an empty infra
///
/// The infra may be edited by batch later via the `POST /infra/ID` or `POST /infra/ID/railjson` endpoints.
#[editoast_derive::route]
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
    Extension(auth): AuthenticationExt,
    Json(infra_form): Json<InfraCreateForm>,
) -> Result<impl IntoResponse> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

    let infra: Changeset<Infra> = infra_form.into();
    let infra = infra.create(&mut db_pool.get().await?).await?;

    // Assign OWNER to the user on the infra if authz is enabled
    // NOTE: we use the regulator here instead of the one in the authorizer to bypass the checks on grant_infra_owner
    if let Authentication::Authenticated(authorizer) = auth {
        regulator
            .give_infra_grant_unchecked(
                &authz::Subject::User(authz::User(authorizer.user_id())),
                &authz::Infra(infra.id),
                InfraGrant::Owner,
            )
            .await?;
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
#[editoast_derive::route]
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
    Path(InfraIdParam { infra_id }): Path<InfraIdParam>,
    State(AppState {
        db_pool, regulator, ..
    }): State<AppState>,
    Query(CloneQuery { name }): Query<CloneQuery>,
) -> Result<Json<i64>> {
    // check user roles
    let has_role = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !has_role {
        return Err(AuthorizationError::Forbidden.into());
    }

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

    // Assign OWNER to the user on the infra if authz is enabled
    // NOTE: we use the regulator here instead of the one in the authorizer to bypass the checks on grant_infra_owner
    if let Authentication::Authenticated(authorizer) = auth {
        regulator
            .give_infra_grant_unchecked(
                &authz::Subject::User(authz::User(authorizer.user_id())),
                &authz::Infra(cloned_infra.id),
                InfraGrant::Owner,
            )
            .await?;
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
#[editoast_derive::route]
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
    // Check user roles
    let has_role = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !has_role {
        return Err(AuthorizationError::Forbidden.into());
    }

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

impl From<InfraPatchForm> for Changeset<Infra> {
    fn from(patch: InfraPatchForm) -> Self {
        Infra::changeset().name(patch.name)
    }
}

/// Rename an infra
#[editoast_derive::route]
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
    Extension(auth): AuthenticationExt,
    Path(infra): Path<i64>,
    Json(patch): Json<InfraPatchForm>,
) -> Result<Json<Infra>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
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
    // Check user roles
    let has_role = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await?;
    if !has_role {
        return Err(AuthorizationError::Forbidden.into());
    }

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
    // Check user roles
    let has_role = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await?;
    if !has_role {
        return Err(AuthorizationError::Forbidden.into());
    }

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
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

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
    Extension(auth): AuthenticationExt,
) -> Result<Json<Vec<String>>> {
    let authorized = auth
        .check_roles([authz::Role::OperationalStudies, authz::Role::Stdcm].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }

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
#[editoast_derive::route]
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
    // Check user roles
    let has_role = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await?;
    if !has_role {
        return Err(AuthorizationError::Forbidden.into());
    }

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
#[editoast_derive::route]
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
    // Check user roles
    let has_role = auth
        .check_roles([authz::Role::OperationalStudies].into())
        .await?;
    if !has_role {
        return Err(AuthorizationError::Forbidden.into());
    }

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
    geo: Option<GeoJsonPoint>,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
struct RelatedOperationalPoint {
    #[schema(inline)]
    id: Identifier,
    parts: Vec<RelatedOperationalPointPart>,
    #[serde(default)]
    #[schema(inline)]
    extensions: OperationalPointExtensions,
    #[serde(default)]
    weight: Option<u8>,
    geo: Option<GeoJsonPoint>,
}

#[derive(Serialize, ToSchema)]
#[cfg_attr(test, derive(Deserialize))]
pub(in crate::views) struct MatchOperationalPointsResponse {
    related_operational_points: Vec<Vec<RelatedOperationalPoint>>,
    track_names: HashMap<Identifier, Option<String>>,
}

#[editoast_derive::route]
#[utoipa::path(
    post, path = "",
    tag = "infra",
    params(InfraIdParam),
    request_body = inline(MatchOperationalPointsForm),
    responses(
        (status = 200, description = "
Take a list of operational point references and return for each of them the list of operational
points that they match on a given infrastructure and a mapping between the track indentifiers of
the returned operational points parts their related track name.
If an input OperationalPointReference contains a track reference, that track reference is also
used to filter out operational points that match the input operational point identifier but do
not match the input track reference (i.e. operational points which do not have any part that
matches the input track reference).
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
    let authorized = auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::AuthError)?;
    if !authorized {
        return Err(AuthorizationError::Forbidden.into());
    }
    auth.check_authorization(async |authorizer| {
        authorizer
            .authorize_infra(&authz::Infra(infra_id), authz::InfraPrivilege::CanRead)
            .await
    })
    .await?;
    let mut operational_points: Vec<Vec<OperationalPoint>> = vec![];
    let mut conn = db_pool.get().await?;
    let path_item_locations = operational_point_references
        .iter()
        .map(|op_ref| PathItemLocation::OperationalPointReference(op_ref.clone()))
        .collect::<Vec<_>>();
    let path_item_cache = PathItemCache::load(
        &mut conn,
        infra_id,
        &path_item_locations.iter().collect::<Vec<_>>(),
    )
    .await?;
    for operational_point_reference in operational_point_references {
        // Retrieve related OPs based on the input operational point identifier:
        let mut related_operational_points = match operational_point_reference.reference {
            OperationalPointIdentifier::OperationalPointId {
                ref operational_point,
            } => retrieve_op_from_ids(
                &mut conn,
                infra_id,
                std::slice::from_ref(&operational_point.0),
            )
            .await?
            .into_values()
            .map(|op_model| op_model.schema)
            .collect::<Vec<_>>(),
            OperationalPointIdentifier::OperationalPointDescription {
                ref trigram,
                secondary_code,
            } => retrieve_op_from_trigrams(&mut conn, infra_id, std::slice::from_ref(&trigram.0))
                .await?
                .into_iter()
                .flat_map(|(_, op_models)| op_models)
                .map(|op_model| op_model.schema)
                .filter(|op| match secondary_code.as_ref() {
                    Some(secondary_code) => op
                        .extensions
                        .sncf
                        .as_ref()
                        .is_some_and(|ext| &ext.ch == secondary_code),
                    None => true,
                })
                .collect::<Vec<_>>(),
            OperationalPointIdentifier::OperationalPointUic {
                uic,
                secondary_code,
            } => retrieve_op_from_uic(&mut conn, infra_id, &[uic])
                .await?
                .into_iter()
                .flat_map(|(_, op_models)| op_models)
                .map(|op_model| op_model.schema)
                .filter(|op| match secondary_code.as_ref() {
                    Some(secondary_code) => op
                        .extensions
                        .sncf
                        .as_ref()
                        .is_some_and(|ext| &ext.ch == secondary_code),
                    None => true,
                })
                .collect::<Vec<_>>(),
        };
        // Filter OPs according to the input `TrackReference` if provided:
        related_operational_points = related_operational_points
            .into_iter()
            .filter(|op| {
                !path_item_cache
                    .track_reference_filter(
                        op.track_offset(),
                        &operational_point_reference.track_reference,
                    )
                    .is_empty()
            })
            .collect_vec();
        // Add the operational point reference related operational points to the response:
        operational_points.push(related_operational_points);
    }
    let related_operational_points =
        populate_op_geo(&mut conn, infra_id, &operational_points).await?;
    let track_names = find_track_names(
        db_pool,
        infra_id,
        &operational_points.iter().flatten().collect::<Vec<_>>(),
    )
    .await?;
    Ok(Json(MatchOperationalPointsResponse {
        related_operational_points,
        track_names,
    }))
}

/// Take a list of [OperationalPoint] and return a mapping between the identifiers of the tracks
/// contained in their operational point parts of the name of the tracks (if any).
async fn find_track_names(
    db_pool: Arc<DbConnectionPoolV2>,
    infra_id: i64,
    operational_points: &[&OperationalPoint],
) -> Result<HashMap<Identifier, Option<String>>> {
    let track_ids: Vec<(i64, String)> = operational_points
        .iter()
        .flat_map(|op| &op.parts)
        .map(|part| (infra_id, part.track.to_string()))
        .collect::<Vec<_>>();
    let (tracks, _): (Vec<_>, _) =
        TrackSectionModel::retrieve_batch(&mut db_pool.get().await?, track_ids).await?;
    Ok(HashMap::from_iter(tracks.into_iter().map(
        |TrackSectionModel { schema: track, .. }| {
            (
                track.id.clone(),
                track
                    .extensions
                    .sncf
                    .map(|sncf_ext| sncf_ext.track_name.to_string()),
            )
        },
    )))
}

fn compute_operational_point_geo(points: &[GeoJsonPoint]) -> Option<GeoJsonPoint> {
    if points.is_empty() {
        return None;
    } else if points.len() == 1 {
        return Some(points[0].clone());
    }
    let geo_points = points
        .iter()
        .map(|geojson_point| {
            let GeoJsonPoint::Point(GeoJsonPointValue(xy)) = geojson_point;
            let coords = CoordSeq::new_from_vec(&[xy]).expect("invalid point coords");
            Geometry::create_point(coords).expect("invalid point geometry")
        })
        .collect();
    let center = Geometry::create_multipoint(geo_points)
        .expect("invalid multi-point geometry")
        .get_centroid()
        .expect("failed to get centroid")
        .get_coord_seq()
        .expect("invalid centroid coords");
    Some(GeoJsonPoint::Point(GeoJsonPointValue(vec![
        center
            .get_x(0)
            .expect("failed to get centroid X coordinate"),
        center
            .get_y(0)
            .expect("failed to get centroid Y coordinate"),
    ])))
}

fn build_related_operational_point(
    op: &OperationalPoint,
    geo_points: Option<&Vec<GeoJsonPoint>>,
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
        extensions: op.extensions.clone(),
        weight: op.weight,
        geo: geo_points.and_then(|points| compute_operational_point_geo(points)),
    }
}

async fn populate_op_geo(
    conn: &mut DbConnection,
    infra_id: i64,
    operational_points: &[Vec<OperationalPoint>],
) -> Result<Vec<Vec<RelatedOperationalPoint>>> {
    let op_ids = operational_points
        .iter()
        .flatten()
        .map(|op| op.id.as_str())
        .collect_vec();
    let geo_points = OperationalPointLayer::get(conn, infra_id, &op_ids).await?;

    Ok(operational_points
        .iter()
        .map(|ops| {
            ops.iter()
                .map(|op| build_related_operational_point(op, geo_points.get(op.id.as_str())))
                .collect_vec()
        })
        .collect_vec())
}

#[cfg(test)]
pub mod tests {
    use axum::http::StatusCode;
    use common::geometry::GeoJsonPointValue;
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
    use schemas::train_schedule::TrackReference;
    use serde_json::json;
    use std::ops::DerefMut;
    use strum::IntoEnumIterator;

    use super::*;
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
    use schemas::train_schedule::OperationalPointIdentifier;

    impl TestApp {
        fn delete_infra_request(&self, infra_id: i64) -> axum_test::TestRequest {
            self.delete(format!("/infra/{infra_id}").as_str())
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_clone_empty() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let request =
            app.post(format!("/infra/{}/clone/?name=cloned_infra", empty_infra.id).as_str());

        let cloned_infra_id: i64 = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        let cloned_infra = Infra::retrieve(db_pool.get_ok(), cloned_infra_id)
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

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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
            app.post(format!("/infra/{small_infra_id}/clone/?name=cloned_infra").as_str());

        let cloned_infra_id: i64 = app
            .fetch(req_clone)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let _cloned_infra = Infra::retrieve(db_pool.get_ok(), cloned_infra_id)
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
            assert!(val[0] > 0);
            // check that we have the same number of objects in each table for both infras
            assert_eq!(val[0], val[1]);
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_delete() {
        let pool = DbConnectionPoolV2::for_tests();
        let app = TestAppBuilder::new()
            .db_pool(pool)
            .core_client(CoreClient::Mocked(MockingClient::default()))
            .build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        app.fetch(app.delete_infra_request(empty_infra.id))
            .await
            .assert_status(StatusCode::NO_CONTENT);

        app.fetch(app.delete_infra_request(empty_infra.id))
            .await
            .assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_list() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/infra/");
        app.fetch(request).await.assert_status(StatusCode::OK);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn default_infra_create() {
        let app = TestAppBuilder::default_app();

        let request = app
            .post("/infra")
            .json(&json!({ "name": "create_infra_test" }));
        let infra: Infra = app
            .fetch(request)
            .await
            .assert_status(StatusCode::CREATED)
            .json_into();

        assert_eq!(infra.name, "create_infra_test");
        assert_eq!(infra.railjson_version, RAILJSON_VERSION);
        assert_eq!(infra.version, DEFAULT_INFRA_VERSION);
        assert_eq!(infra.generated_version, None);
        assert!(!infra.locked);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_get() {
        let core_client = CoreClient::Mocked(MockingClient::default());

        let app = TestAppBuilder::new().core_client(core_client).build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let req = app.get(format!("/infra/{}", empty_infra.id).as_str());

        app.fetch(req).await.assert_status(StatusCode::OK);

        empty_infra.delete(&mut db_pool.get_ok()).await.unwrap();

        let req = app.get(format!("/infra/{}", empty_infra.id).as_str());

        app.fetch(req).await.assert_status(StatusCode::NOT_FOUND);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_rename() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let req = app
            .put(format!("/infra/{}", empty_infra.id).as_str())
            .json(&json!({"name": "rename_test"}));

        let infra: Infra = app
            .fetch(req)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(infra.name, "rename_test");
    }

    #[derive(Deserialize)]
    struct InfraRefreshedResponse {
        infra_refreshed: Vec<i64>,
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_refresh() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let req = app.post(format!("/infra/refresh/?infras={}", empty_infra.id).as_str());

        let refreshed_infras: InfraRefreshedResponse = app
            .fetch(req)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert_eq!(refreshed_infras.infra_refreshed, vec![empty_infra.id]);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    // Slow test
    // PostgreSQL deadlock can happen in this test, see section `Deadlock` of [DbConnectionPoolV2::get] for more information
    async fn infra_refresh_force() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let req =
            app.post(format!("/infra/refresh/?infras={}&force=true", empty_infra.id).as_str());
        let refreshed_infras: InfraRefreshedResponse = app
            .fetch(req)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        assert!(refreshed_infras.infra_refreshed.contains(&empty_infra.id));
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_get_speed_limit_tags() {
        let app = TestAppBuilder::default_app();
        let builtin_tags = app.speed_limit_tag_ids();
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

        let mut speed_limit_tags: Vec<String> = app
            .fetch(req)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        let mut test_tags = builtin_tags.0.clone();
        test_tags.push("test_tag".to_string());

        assert_eq!(speed_limit_tags.sort(), test_tags.sort());
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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

        let voltages: Vec<String> = app
            .fetch(req)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert!(voltages.len() >= 3);
        assert!(voltages.contains(&String::from("0V")));
        assert!(voltages.contains(&String::from("1V")));
        assert!(voltages.contains(&String::from("25000V")));
    }

    #[rstest]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    #[case(true)]
    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
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
            let voltages: Vec<String> = app
                .fetch(req)
                .await
                .assert_status(StatusCode::OK)
                .json_into();
            assert_eq!(voltages[0], "0");
            assert_eq!(voltages.len(), 1);
        } else {
            let voltages: Vec<String> = app
                .fetch(req)
                .await
                .assert_status(StatusCode::OK)
                .json_into();
            assert!(voltages.contains(&String::from("25000V")));
            assert!(voltages.len() >= 2);
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_get_switch_types() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        let req = app.get(format!("/infra/{}/switch_types/", empty_infra.id).as_str());

        let switch_types: Vec<SwitchType> = app
            .fetch(req)
            .await
            .assert_status(StatusCode::OK)
            .json_into();

        assert_eq!(switch_types.len(), 5);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn infra_lock() {
        let core_client = CoreClient::Mocked(MockingClient::default());

        let app = TestAppBuilder::new().core_client(core_client).build();
        let db_pool = app.db_pool();
        let empty_infra = create_empty_infra(&mut db_pool.get_ok()).await;

        // Lock infra
        let req = app.post(format!("/infra/{}/lock/", empty_infra.id).as_str());

        app.fetch(req).await.assert_status(StatusCode::NO_CONTENT);

        // Check lock
        let infra = Infra::retrieve(db_pool.get_ok(), empty_infra.id)
            .await
            .unwrap()
            .expect("infra was not cloned");
        assert!(infra.locked);

        // Unlock infra
        let req = app.post(format!("/infra/{}/unlock/", empty_infra.id).as_str());

        app.fetch(req).await.assert_status(StatusCode::NO_CONTENT);

        // Check lock
        let infra = Infra::retrieve(db_pool.get_ok(), empty_infra.id)
            .await
            .unwrap()
            .expect("infra was not cloned");
        assert!(!infra.locked);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn match_operational_points() {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let mut infra = create_small_infra(&mut db_pool.get_ok()).await;
        let infra_cache = InfraCache::load(&mut db_pool.get_ok(), &infra)
            .await
            .unwrap();
        infra
            .refresh(db_pool.clone(), false, &infra_cache)
            .await
            .unwrap();
        let operational_point_references = vec![
            OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointId {
                    operational_point: ("West_station").into(),
                },
                track_reference: None,
            },
            OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointDescription {
                    trigram: "MES".into(),
                    secondary_code: Some("BV".into()),
                },
                track_reference: Some(TrackReference::Name {
                    track_name: "V1".into(),
                }),
            },
            OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointUic {
                    uic: 8,
                    secondary_code: None,
                },
                track_reference: Some(TrackReference::Id {
                    track_id: "TH1".into(),
                }),
            },
        ];
        let request = app
            .post(format!("/infra/{}/match_operational_points", infra.id).as_str())
            .json(&json!({"operational_point_references": operational_point_references}));
        let response: MatchOperationalPointsResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        let response_op_identifiers = response
            .related_operational_points
            .iter()
            .map(|op_ref| op_ref.iter().map(|op| op.id.as_str()).collect::<Vec<_>>())
            .collect_vec();
        let expected_identifiers = [vec!["West_station"], vec!["Mid_East_station"], vec![]];
        assert_eq!(response_op_identifiers, expected_identifiers);
        assert_eq!(
            response.related_operational_points[0][0].geo,
            Some(GeoJsonPoint::Point(GeoJsonPointValue(vec!(
                -0.3907884613333333,
                49.4999,
            ))))
        );
        assert_eq!(
            response.related_operational_points[0][0].parts[1].geo,
            Some(GeoJsonPoint::Point(GeoJsonPointValue(vec!(
                -0.392307692,
                49.4999,
            ))))
        );
        let expected_track_names: HashMap<Identifier, Option<String>> = HashMap::from([
            ("TA0".into(), Some("V1".to_string())),
            ("TA1".into(), Some("V2".to_string())),
            ("TA2".into(), Some("A".to_string())),
            ("TD0".into(), Some("V1".to_string())),
            ("TD1".into(), Some("V2".to_string())),
        ]);
        assert_eq!(response.track_names, expected_track_names);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn match_operational_point_input_with_incompatible_op_id_and_track_reference_gets_filtered_out()
     {
        let app = TestAppBuilder::default_app();
        let db_pool = app.db_pool();
        let infra = create_small_infra(&mut db_pool.get_ok()).await;
        let operational_point_references = vec![
            OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointDescription {
                    trigram: "MES".into(),
                    secondary_code: None,
                },
                track_reference: Some(TrackReference::Name {
                    track_name: "does_not_exist".into(),
                }),
            },
            OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointUic {
                    uic: 8,
                    secondary_code: None,
                },
                track_reference: Some(TrackReference::Id {
                    track_id: "does_not_exist".into(),
                }),
            },
            OperationalPointReference {
                reference: OperationalPointIdentifier::OperationalPointDescription {
                    trigram: "MES".into(),
                    secondary_code: Some("PAUL".into()),
                },
                track_reference: None,
            },
        ];
        let request = app
            .post(format!("/infra/{}/match_operational_points", infra.id).as_str())
            .json(&json!({"operational_point_references": operational_point_references}));
        let response: MatchOperationalPointsResponse = app
            .fetch(request)
            .await
            .assert_status(StatusCode::OK)
            .json_into();
        let response_op_identifiers = response
            .related_operational_points
            .iter()
            .map(|op_ref| op_ref.iter().map(|op| op.id.as_str()).collect::<Vec<_>>())
            .collect::<Vec<_>>();
        let expected_identifiers: [Vec<&str>; 3] = [vec![], vec![], vec![]];
        assert_eq!(response_op_identifiers, expected_identifiers);
    }
}
