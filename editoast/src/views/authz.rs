use std::collections::HashSet;

use crate::error::Result;
use axum::extract::Path;
use axum::extract::State;
use axum::response::Json;
use axum::Extension;
use editoast_authz::Role;
use editoast_derive::EditoastError;

use super::AppState;
use super::AuthenticationExt;
use super::AuthorizationError;
use super::AuthorizerError;
use super::Regulator;

crate::routes! {
    "/authz/roles" => {
        "/me" => list_current_roles,
        "/{user_id}" => {
            list_user_roles,
            grant_roles,
            strip_roles,
        },
    },
}

editoast_common::schemas! {
    Role,
}

#[derive(serde::Deserialize, utoipa::IntoParams)]
struct UserIdPathParam {
    /// A user ID (not to be mistaken for its identity, cf. editoast user model documentation)
    user_id: i64,
}

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "authz")]
enum AuthzError {
    #[error("Internal error")]
    #[editoast_error(status = 500, no_context)]
    Authorizer(#[from] AuthorizerError),
    #[error("Authorization error")]
    Authz(#[from] AuthorizationError),
}

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "authz")]
enum NoSuchUserError {
    #[error("No user with ID {user_id} found")]
    #[editoast_error(status = 404)]
    NoSuchUser { user_id: i64 },
}

#[derive(serde::Serialize, utoipa::ToSchema)]
struct Roles {
    builtin: HashSet<Role>,
}

#[utoipa::path(
    get, path = "",
    tag = "authz",
    responses(
        (status = 200, description = "List the roles of the issuer of the request", body = inline(Roles)),
    ),
)]
async fn list_current_roles(
    State(AppState { config, .. }): State<AppState>,
    Extension(auth): AuthenticationExt,
) -> Result<Json<Roles>> {
    // This is especially necessary as this endpoint is always queried by the frontend
    // when loading. Making it return 401 results in a blank page.
    // We return `Admin` as when no authorization is enabled, we want everyone to have
    // access to full feature set of OSRD.
    if !config.enable_authorization {
        return Ok(Json(Roles {
            builtin: HashSet::from([Role::Admin]),
        }));
    }
    let authorizer = auth.authorizer()?;
    Ok(Json(Roles {
        builtin: authorizer
            .user_roles()
            .await
            .map_err(AuthzError::Authorizer)?
            .clone(),
    }))
}

async fn check_user_exists(user_id: i64, regulator: &Regulator) -> Result<()> {
    if !regulator
        .user_exists(user_id)
        .await
        .map_err(AuthzError::from)?
    {
        return Err(NoSuchUserError::NoSuchUser { user_id }.into());
    }

    Ok(())
}

#[utoipa::path(
    get, path = "",
    tag = "authz",
    params(UserIdPathParam),
    responses(
        (status = 200, description = "List the roles of a user", body = inline(Roles)),
    ),
)]
async fn list_user_roles(
    Path(UserIdPathParam { user_id }): Path<UserIdPathParam>,
    Extension(auth): AuthenticationExt,
    State(AppState { regulator, .. }): State<AppState>,
) -> Result<Json<Roles>> {
    if !auth
        .check_roles([Role::OperationalStudies].into())
        .await
        .map_err(AuthorizationError::from)?
    {
        return Err(AuthorizationError::Forbidden.into());
    }

    check_user_exists(user_id, &regulator).await?;

    Ok(Json(Roles {
        builtin: regulator
            .user_roles(user_id)
            .await
            .map_err(AuthzError::from)?,
    }))
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct RoleListBody {
    roles: Vec<Role>,
}

#[utoipa::path(
    post, path = "",
    tag = "authz",
    params(UserIdPathParam),
    request_body = inline(RoleListBody),
    responses(
        (status = 204, description = "The roles have been granted successfully"),
    ),
)]
async fn grant_roles(
    Path(UserIdPathParam { user_id }): Path<UserIdPathParam>,
    Extension(auth): AuthenticationExt,
    State(AppState { regulator, .. }): State<AppState>,
    Json(RoleListBody { roles }): Json<RoleListBody>,
) -> Result<impl axum::response::IntoResponse> {
    if !auth
        .check_roles([Role::Admin].into())
        .await
        .map_err(AuthorizationError::from)?
    {
        return Err(AuthorizationError::Forbidden.into());
    }

    check_user_exists(user_id, &regulator).await?;

    regulator
        .grant_user_roles(user_id, HashSet::from_iter(roles))
        .await
        .map_err(AuthzError::from)?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete, path = "",
    tag = "authz",
    params(UserIdPathParam),
    request_body = inline(RoleListBody),
    responses(
        (status = 204, description = "The roles have been removed successfully"),
    ),
)]
async fn strip_roles(
    Path(UserIdPathParam { user_id }): Path<UserIdPathParam>,
    Extension(auth): AuthenticationExt,
    State(AppState { regulator, .. }): State<AppState>,
    Json(RoleListBody { roles }): Json<RoleListBody>,
) -> Result<impl axum::response::IntoResponse> {
    if !auth
        .check_roles([Role::Admin].into())
        .await
        .map_err(AuthorizationError::from)?
    {
        return Err(AuthorizationError::Forbidden.into());
    }

    check_user_exists(user_id, &regulator).await?;

    regulator
        .revoke_user_roles(user_id, HashSet::from_iter(roles))
        .await
        .map_err(AuthzError::from)?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
