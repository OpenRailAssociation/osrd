use std::collections::HashSet;

use crate::error::Result;
use crate::models::auth::{AuthDriverError, PgAuthDriver};
use axum::extract::Path;
use axum::response::Json;
use axum::Extension;
use editoast_authz::authorizer::Authorizer;
use editoast_authz::BuiltinRole;
use editoast_derive::EditoastError;

use super::{AuthenticationExt, AuthorizationError};

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
    BuiltinRole,
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
    Driver(#[from] AuthDriverError),
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
    builtin: HashSet<BuiltinRole>,
}

#[utoipa::path(
    get, path = "",
    tag = "authz",
    responses(
        (status = 200, description = "List the roles of the issuer of the request", body = inline(Roles)),
    ),
)]
async fn list_current_roles(Extension(auth): AuthenticationExt) -> Result<Json<Roles>> {
    let authorizer = auth.authorizer()?;
    Ok(Json(Roles {
        builtin: authorizer
            .user_builtin_roles(authorizer.user_id())
            .await
            .map_err(AuthzError::from)?,
    }))
}

async fn check_user_exists(
    user_id: i64,
    authorizer: &Authorizer<PgAuthDriver<BuiltinRole>>,
) -> Result<()> {
    if !authorizer
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
) -> Result<Json<Roles>> {
    if !auth
        .check_roles([BuiltinRole::SubjectRead, BuiltinRole::RoleRead].into())
        .await
        .map_err(AuthorizationError::from)?
    {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let authorizer = auth.authorizer()?;
    check_user_exists(user_id, &authorizer).await?;

    Ok(Json(Roles {
        builtin: authorizer
            .user_builtin_roles(user_id)
            .await
            .map_err(AuthzError::from)?,
    }))
}

#[derive(serde::Deserialize, utoipa::ToSchema)]
struct RoleListBody {
    roles: Vec<BuiltinRole>,
}

#[utoipa::path(
    post, path = "",
    tag = "authz",
    params(UserIdPathParam),
    request_body = inline(RoleListBody),
    responses(
        (status = 204, description = "The roles have been granted sucessfully"),
    ),
)]
async fn grant_roles(
    Path(UserIdPathParam { user_id }): Path<UserIdPathParam>,
    Extension(auth): AuthenticationExt,
    Json(RoleListBody { roles }): Json<RoleListBody>,
) -> Result<impl axum::response::IntoResponse> {
    if !auth
        .check_roles([BuiltinRole::SubjectRead, BuiltinRole::RoleWrite].into())
        .await
        .map_err(AuthorizationError::from)?
    {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let mut authorizer = auth.authorizer()?;
    check_user_exists(user_id, &authorizer).await?;

    authorizer
        .grant_roles(user_id, HashSet::from_iter(roles))
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
        (status = 204, description = "The roles have been removed sucessfully"),
    ),
)]
async fn strip_roles(
    Path(UserIdPathParam { user_id }): Path<UserIdPathParam>,
    Extension(auth): AuthenticationExt,
    Json(RoleListBody { roles }): Json<RoleListBody>,
) -> Result<impl axum::response::IntoResponse> {
    if !auth
        .check_roles([BuiltinRole::SubjectRead, BuiltinRole::RoleWrite].into())
        .await
        .map_err(AuthorizationError::from)?
    {
        return Err(AuthorizationError::Unauthorized.into());
    }

    let mut authorizer = auth.authorizer()?;
    check_user_exists(user_id, &authorizer).await?;

    authorizer
        .strip_roles(user_id, HashSet::from_iter(roles))
        .await
        .map_err(AuthzError::from)?;
    Ok(axum::http::StatusCode::NO_CONTENT)
}
