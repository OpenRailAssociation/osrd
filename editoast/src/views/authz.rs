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
    "/authz" => {
        "/me" => whoami,
        "/roles" => {
            "/me" => list_current_roles,
            "/{user_id}" => {
                list_user_roles,
                grant_roles,
                strip_roles,
            },
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

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
#[cfg_attr(test, derive(serde::Deserialize, PartialEq))]
struct WhoamiResponse {
    id: i64,
    name: String,
    roles: Vec<Role>,
}

#[utoipa::path(
    get,
    path = "",
    tag = "authz",
    responses((
        status = 200,
        description = "Get the info of the current user",
        body = inline(WhoamiResponse),
    ))
)]
async fn whoami(
    State(AppState { config, .. }): State<AppState>,
    Extension(auth): AuthenticationExt,
) -> Result<Json<WhoamiResponse>> {
    // This is especially necessary as this endpoint is always queried by the frontend
    // when loading. Making it return 401 results in a blank page.
    // We return `Admin` as when no authorization is enabled, we want everyone to have
    // access to full feature set of OSRD.
    if !config.enable_authorization {
        return Ok(Json(WhoamiResponse {
            // TODO: don't return -1 and a hardcoded name, return a different schema instead, requires frontend changes
            id: -1,
            name: "OSRD user".to_string(),
            roles: Vec::from([Role::Admin]),
        }));
    }

    let authorizer = auth.authorizer()?;
    let user_roles = authorizer
        .user_roles()
        .await
        .map_err(AuthzError::Authorizer)?;
    Ok(Json(WhoamiResponse {
        id: authorizer.user_id(),
        name: authorizer.user_name().to_owned(),
        roles: user_roles.into_iter().collect(),
    }))
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

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;

    use crate::views::test_app::test_app;
    use crate::views::test_app::TestRequestExt as _;

    use super::*;

    #[tokio::test(flavor = "multi_thread")]
    async fn whoami_test() {
        let app = test_app!().enable_authorization(true).build();
        let user = app
            .user("test", "test")
            .with_roles([Role::OperationalStudies])
            .create();

        let request = app.get("/authz/me").by_user(&user);
        let user_data = app
            .fetch(request)
            .assert_status(StatusCode::OK)
            .json_into::<WhoamiResponse>();

        assert_eq!(
            user_data,
            WhoamiResponse {
                id: user.id,
                name: "test".to_string(),
                roles: vec![Role::OperationalStudies],
            }
        );
    }

    #[tokio::test(flavor = "multi_thread")]
    async fn whoami_authorization_disabled() {
        let app = test_app!().enable_authorization(false).build();
        let user = app.user("test", "test").create();

        let request = app.get("/authz/me").by_user(&user);
        let WhoamiResponse { roles, .. } = app
            .fetch(request)
            .assert_status(StatusCode::OK)
            .json_into::<WhoamiResponse>();

        assert_eq!(roles, vec![Role::Admin]);
    }
}
