mod authz;
mod documents;
pub mod electrical_profiles;
pub mod infra;
mod layers;
mod openapi;
pub mod operational_studies;
pub mod pagination;
pub mod params;
pub mod path;
pub mod projects;
pub mod rolling_stock;
pub mod scenario;
pub mod search;
pub mod speed_limit_tags;
pub mod sprites;
pub mod stdcm_search_environment;
pub mod study;
pub mod temporary_speed_limits;
pub mod timetable;
pub mod train_schedule;
pub mod work_schedules;

#[cfg(test)]
mod test_app;

use std::collections::HashSet;
use std::sync::Arc;

use axum::extract::Request;
use axum::middleware::Next;
use axum::response::Response;
use editoast_authz::authorizer::Authorizer;
use editoast_authz::authorizer::UserInfo;
use editoast_authz::BuiltinRole;
use futures::TryFutureExt;
pub use openapi::OpenApiRoot;

use axum::extract::Json;
use axum::extract::State;
use editoast_derive::EditoastError;
use editoast_models::db_connection_pool::ping_database;
use editoast_models::DbConnectionPoolV2;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use tokio::time::timeout;
use utoipa::ToSchema;

use crate::client::get_app_version;
use crate::core::version::CoreVersionRequest;
use crate::core::AsCoreRequest;
use crate::core::{self};
use crate::error::Result;
use crate::error::{self};
use crate::generated_data;
use crate::infra_cache::operation;
use crate::models;
use crate::models::auth::PgAuthDriver;
use crate::AppState;
use crate::ValkeyClient;

crate::routes! {
    pub fn router();
    fn openapi_paths();

    "/health" => health,
    "/version" => version,
    "/version/core" => core_version,

    &authz,
    &documents,
    &electrical_profiles,
    &infra,
    &layers,
    &projects,
    &rolling_stock,
    &search,
    &speed_limit_tags,
    &sprites,
    &stdcm_search_environment,
    &work_schedules,
    &temporary_speed_limits,
    &train_schedule,
    &timetable,
    &path,
    &scenario,
}

editoast_common::schemas! {
    Version,

    editoast_common::schemas(),
    editoast_schemas::schemas(),
    models::schemas(),
    core::schemas(),
    generated_data::schemas(),

    authz::schemas(),
    documents::schemas(),
    electrical_profiles::schemas(),
    error::schemas(),
    infra::schemas(),
    operation::schemas(),
    operational_studies::schemas(),
    pagination::schemas(),
    path::schemas(),
    projects::schemas(),
    rolling_stock::schemas(),
    scenario::schemas(),
    scenario::macro_nodes::schemas(),
    search::schemas(),
    stdcm_search_environment::schemas(),
    train_schedule::schemas(),
    timetable::schemas(),
    work_schedules::schemas(),
}

/// Represents the bundle of information about the issuer of a request
/// that can be extracted form recognized headers.
#[derive(Debug, Clone)]
pub enum Authentication {
    /// The issuer of the request did not provide any authentication information.
    Unauthenticated,
    /// The issuer of the request provided the 'x-remote-user' header, which contains the
    /// identity and name of the user.
    Authenticated(Authorizer<PgAuthDriver<BuiltinRole>>),
    /// The requests comes from a Core instance. All requests are considered safe.
    Core,
}

impl Authentication {
    /// Checks if the issuer of the request has the required roles. Always returns `false` if the
    /// request is unauthenticated.
    pub async fn check_roles(
        &self,
        required_roles: HashSet<BuiltinRole>,
    ) -> Result<bool, <PgAuthDriver<BuiltinRole> as editoast_authz::authorizer::StorageDriver>::Error>
    {
        match self {
            Authentication::Core => Ok(true),
            Authentication::Unauthenticated => Ok(false),
            Authentication::Authenticated(authorizer) => {
                authorizer.check_roles(required_roles).await
            }
        }
    }

    /// Returns the underlying authorizer if the request is authenticated, otherwise returns an
    /// error. If the request comes from Core, this returns false as well as it makes no sense to
    /// have an Authorizer without an authenticated user.
    pub fn authorizer(self) -> Result<Authorizer<PgAuthDriver<BuiltinRole>>, AuthorizationError> {
        match self {
            Authentication::Authenticated(authorizer) => Ok(authorizer),
            Authentication::Unauthenticated | Authentication::Core => {
                Err(AuthorizationError::Unauthenticated)
            }
        }
    }
}

pub type AuthenticationExt = axum::extract::Extension<Authentication>;

async fn authenticate(
    disable_authorization: bool,
    headers: &axum::http::HeaderMap,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<Authentication, AuthorizationError> {
    if disable_authorization {
        return Ok(Authentication::Authenticated(Authorizer::new_superuser(
            PgAuthDriver::<BuiltinRole>::new(db_pool),
        )));
    }
    let Some(header) = headers.get("x-remote-user") else {
        if headers.contains_key("x-osrd-core") {
            return Ok(Authentication::Core);
        }
        return Ok(Authentication::Unauthenticated);
    };
    let (identity, name) = header
        .to_str()
        .expect("unexpected non-ascii characters in x-remote-user")
        .split_once('/') // FIXME: the gateway should inject two headers instead
        .expect("odd x-remote-user format");
    let authorizer = Authorizer::try_initialize(
        UserInfo {
            identity: identity.to_owned(),
            name: name.to_owned(),
        },
        PgAuthDriver::<BuiltinRole>::new(db_pool),
    )
    .await?;
    Ok(Authentication::Authenticated(authorizer))
}

pub async fn authentication_middleware(
    State(AppState {
        db_pool_v2: db_pool,
        disable_authorization,
        ..
    }): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response> {
    let headers = req.headers();
    let authorizer = authenticate(disable_authorization, headers, db_pool).await?;
    req.extensions_mut().insert(authorizer);
    Ok(next.run(req).await)
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "authz")]
pub enum AuthorizationError {
    #[error("Unauthenticated")]
    #[editoast_error(status = 401)]
    Unauthenticated,
    #[error("Unauthorized")]
    #[editoast_error(status = 403)]
    Unauthorized,
    #[error(transparent)]
    #[editoast_error(status = 500)]
    AuthError(
        #[from] <PgAuthDriver<BuiltinRole> as editoast_authz::authorizer::StorageDriver>::Error,
    ),
    #[error(transparent)]
    #[editoast_error(status = 500)]
    DbError(#[from] editoast_models::db_connection_pool::DatabasePoolError),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "app_health")]
pub enum AppHealthError {
    #[error("Timeout error")]
    Timeout,
    #[error(transparent)]
    Database(#[from] editoast_models::db_connection_pool::PingError),
    #[error(transparent)]
    Valkey(#[from] redis::RedisError),
}

#[utoipa::path(
    get, path = "",
    responses(
        (status = 200, description = "Check if Editoast is running correctly", body = String)
    )
)]
async fn health(
    State(AppState {
        db_pool_v2: db_pool,
        valkey,
        health_check_timeout,
        ..
    }): State<AppState>,
) -> Result<&'static str> {
    timeout(health_check_timeout, check_health(db_pool, valkey))
        .await
        .map_err(|_| AppHealthError::Timeout)??;
    Ok("ok")
}

pub async fn check_health(
    db_pool: Arc<DbConnectionPoolV2>,
    valkey_client: Arc<ValkeyClient>,
) -> Result<()> {
    let mut db_connection = db_pool.clone().get().await?;
    tokio::try_join!(
        ping_database(&mut db_connection).map_err(AppHealthError::Database),
        valkey_client.ping_valkey().map_err(|e| e.into())
    )?;
    Ok(())
}

#[derive(ToSchema, Serialize, Deserialize)]
pub struct Version {
    #[schema(required)] // Options are by default not required, but this one is
    git_describe: Option<String>,
}

#[utoipa::path(
    get, path = "",
    responses(
        (status = 200, description = "Return the service version", body = Version),
    ),
)]
async fn version() -> Json<Version> {
    Json(Version {
        git_describe: get_app_version(),
    })
}

#[utoipa::path(
    get, path = "",
    responses(
        (status = 200, description = "Return the core service version", body = Version),
    ),
)]
async fn core_version(app_state: State<AppState>) -> Json<Version> {
    let core = app_state.core_client.clone();
    let response = CoreVersionRequest {}.fetch(&core).await;
    let response = response.unwrap_or(Version { git_describe: None });
    Json(response)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use axum::http::StatusCode;
    use editoast_models::DbConnectionPoolV2;
    use rstest::rstest;
    use serde_json::json;

    use super::test_app::TestAppBuilder;
    use crate::core::mocking::MockingClient;

    #[rstest]
    async fn health() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/health");
        app.fetch(request).assert_status(StatusCode::OK);
    }

    #[rstest]
    async fn version() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/version");
        let response: HashMap<String, Option<String>> = app.fetch(request).json_into();
        assert!(response.contains_key("git_describe"));
    }

    #[rstest]
    async fn core_version() {
        let mut core = MockingClient::new();
        core.stub("/version")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(json!({"git_describe": ""}))
            .finish();
        let app = TestAppBuilder::new()
            .core_client(core.into())
            .db_pool(DbConnectionPoolV2::for_tests())
            .build();
        let request = app.get("/version/core");
        let response: HashMap<String, Option<String>> = app.fetch(request).json_into();
        assert!(response.contains_key("git_describe"));
    }
}
