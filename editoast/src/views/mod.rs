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
pub mod timetable;
pub mod train_schedule;
pub mod work_schedules;

#[cfg(test)]
mod test_app;

use std::sync::Arc;
use std::time::Duration;

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
use crate::RedisClient;

crate::routes! {
    pub fn router();
    fn openapi_paths();

    "/health" => health,
    "/version" => version,
    "/version/core" => core_version,

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
    documents::schemas(),
    electrical_profiles::schemas(),
    error::schemas(),
    generated_data::schemas(),
    infra::schemas(),
    operation::schemas(),
    operational_studies::schemas(),
    pagination::schemas(),
    projects::schemas(),
    rolling_stock::schemas(),
    search::schemas(),
    stdcm_search_environment::schemas(),
    work_schedules::schemas(),
    train_schedule::schemas(),
    timetable::schemas(),
    path::schemas(),
    scenario::schemas(),
}

pub type Roles = editoast_authz::roles::RoleConfig<BuiltinRole>;
pub type AuthorizerExt = axum::extract::Extension<Authorizer<PgAuthDriver<BuiltinRole>>>;

async fn make_authorizer(
    headers: &axum::http::HeaderMap,
    roles: Arc<Roles>,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<Authorizer<PgAuthDriver<BuiltinRole>>, AuthorizationError> {
    if roles.is_superuser() {
        return Ok(Authorizer::new_superuser(
            roles,
            PgAuthDriver::<BuiltinRole>::new(db_pool.clone()),
        ));
    }
    let Some(header) = headers.get("x-remote-user") else {
        return Err(AuthorizationError::Unauthenticated);
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
        roles,
        PgAuthDriver::<BuiltinRole>::new(db_pool.clone()),
    )
    .await?;
    Ok(authorizer)
}

pub async fn authorizer_middleware(
    State(AppState {
        db_pool_v2: db_pool,
        role_config,
        ..
    }): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response> {
    let headers = req.headers();
    let authorizer = make_authorizer(headers, role_config.clone(), db_pool).await?;
    req.extensions_mut().insert(authorizer);
    Ok(next.run(req).await)
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "authorization")]
pub enum AuthorizationError {
    #[error("Unauthenticated")]
    #[editoast_error(status = 401)]
    Unauthenticated,
    #[error("Unauthorized")]
    #[editoast_error(status = 401)]
    Unauthorized,
    #[error(transparent)]
    #[editoast_error(status = 500)]
    AuthError(
        #[from] <PgAuthDriver<BuiltinRole> as editoast_authz::authorizer::StorageDriver>::Error,
    ),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "app_health")]
pub enum AppHealthError {
    #[error("Timeout error")]
    Timeout,
    #[error(transparent)]
    Database(#[from] editoast_models::db_connection_pool::PingError),
    #[error(transparent)]
    Redis(#[from] redis::RedisError),
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
        redis,
        ..
    }): State<AppState>,
) -> Result<&'static str> {
    timeout(Duration::from_millis(500), check_health(db_pool, redis))
        .await
        .map_err(|_| AppHealthError::Timeout)??;
    Ok("ok")
}

async fn check_health(
    db_pool: Arc<DbConnectionPoolV2>,
    redis_client: Arc<RedisClient>,
) -> Result<()> {
    let mut db_connection = db_pool.clone().get().await?;
    tokio::try_join!(
        ping_database(&mut db_connection).map_err(AppHealthError::Database),
        redis_client.ping_redis().map_err(|e| e.into())
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
            .body(r#"{"git_describe": ""}"#)
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
