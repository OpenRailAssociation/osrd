mod documents;
pub mod electrical_profiles;
pub mod infra;
mod layers;
pub mod light_rolling_stocks;
mod openapi;
pub mod operational_studies;
pub mod pagination;
pub mod params;
pub mod pathfinding;
pub mod projects;
pub mod rolling_stocks;
pub mod scenario;
pub mod search;
mod single_simulation;
pub mod sprites;
pub mod stdcm;
pub mod study;
pub mod timetable;
pub mod train_schedule;
pub mod v2;
pub mod work_schedules;

#[cfg(test)]
mod test_app;

use std::ops::DerefMut as _;
use std::sync::Arc;
use std::time::Duration;

use futures::TryFutureExt;
pub use openapi::OpenApiRoot;

use actix_web::get;
use actix_web::web::Data;
use actix_web::web::Json;
use editoast_derive::EditoastError;
use editoast_models::ping_database;
use editoast_models::DbConnectionPoolV2;
use serde_derive::Deserialize;
use serde_derive::Serialize;
use thiserror::Error;
use tokio::time::timeout;
use utoipa::ToSchema;

use crate::client::get_app_version;
use crate::core::version::CoreVersionRequest;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::core::{self};
use crate::error::Result;
use crate::error::{self};
use crate::generated_data;
use crate::infra_cache::operation;
use crate::models;
use crate::modelsv2;
use crate::RedisClient;

crate::routes! {
    (health, version, core_version),
    (rolling_stocks::routes(), light_rolling_stocks::routes()),
    (pathfinding::routes(), stdcm::routes(), train_schedule::routes()),
    (projects::routes(),timetable::routes(), work_schedules::routes()),
    documents::routes(),
    sprites::routes(),
    search::routes(),
    electrical_profiles::routes(),
    layers::routes(),
    infra::routes(),
    single_simulation::routes(),
    v2::routes()
}

editoast_common::schemas! {
    Version,

    editoast_common::schemas(),
    editoast_schemas::schemas(),
    models::schemas(),
    modelsv2::schemas(),
    core::schemas(),

    documents::schemas(),
    electrical_profiles::schemas(),
    error::schemas(),
    generated_data::schemas(),
    infra::schemas(),
    light_rolling_stocks::schemas(),
    operation::schemas(),
    operational_studies::schemas(),
    pagination::schemas(),
    pathfinding::schemas(),
    projects::schemas(),
    rolling_stocks::schemas(),
    search::schemas(),
    single_simulation::schemas(),
    timetable::schemas(),
    train_schedule::schemas(),
    v2::schemas(),
    work_schedules::schemas(),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "app_health")]
pub enum AppHealthError {
    #[error("Timeout error")]
    Timeout,
    #[error(transparent)]
    Database(#[from] editoast_models::EditoastModelsError),
    #[error(transparent)]
    Redis(#[from] redis::RedisError),
}

#[utoipa::path(
    responses(
        (status = 200, description = "Check if Editoast is running correctly", body = String)
    )
)]
#[get("/health")]
async fn health(
    db_pool: Data<DbConnectionPoolV2>,
    redis_client: Data<RedisClient>,
) -> Result<&'static str> {
    timeout(
        Duration::from_millis(500),
        check_health(db_pool.into_inner(), redis_client.into_inner()),
    )
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
        ping_database(db_connection.deref_mut()).map_err(AppHealthError::Database),
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
    responses(
        (status = 200, description = "Return the service version", body = Version),
    ),
)]
#[get("/version")]
async fn version() -> Json<Version> {
    Json(Version {
        git_describe: get_app_version(),
    })
}

#[utoipa::path(
    responses(
        (status = 200, description = "Return the core service version", body = Version),
    ),
)]
#[get("/version/core")]
async fn core_version(core: Data<CoreClient>) -> Json<Version> {
    let response = CoreVersionRequest {}.fetch(&core).await;
    let response = response.unwrap_or(Version { git_describe: None });
    Json(response)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use actix_http::body::BoxBody;
    use actix_http::Request;
    use actix_http::StatusCode;
    use actix_web::dev::Service;
    use actix_web::dev::ServiceResponse;
    use actix_web::test as actix_test;
    use actix_web::test::call_and_read_body_json;
    use actix_web::test::TestRequest;
    use actix_web::Error;
    use rstest::rstest;

    use super::test_app::TestAppBuilder;
    use crate::core::mocking::MockingClient;
    use crate::core::CoreClient;

    /// Asserts the status code of a simulated response and deserializes its body,
    /// with a nice failure message should the something fail
    #[macro_export]
    macro_rules! assert_status_and_read {
        ($response: ident, $status: expr) => {{
            let (status, body): (_, std::result::Result<serde_json::Value, _>) = (
                $response.status(),
                actix_web::test::try_read_body_json($response).await,
            );
            if let std::result::Result::Ok(body) = body {
                let fmt_body = format!("{}", body);
                assert_eq!(
                    status.as_u16(),
                    $status.as_u16(),
                    "unexpected error response: {}",
                    fmt_body
                );
                match serde_json::from_value(body) {
                    Ok(response) => response,
                    Err(err) => panic!(
                        "cannot deserialize response because '{}': {}",
                        err, fmt_body
                    ),
                }
            } else {
                panic!(
                    "Cannot read response body: {:?}\nGot status code {}",
                    body.unwrap_err(),
                    status
                )
            }
        }};
    }

    /// Checks if the field "type" of the response matches the `type` field of
    /// the `InternalError` derived from the provided error
    ///
    /// The other error fields (message, status_code and context) are ignored.
    #[macro_export]
    macro_rules! assert_response_error_type_match {
        ($response: ident, $error: expr) => {{
            let expected_error: $crate::error::InternalError = $error.into();
            let payload: serde_json::Value = actix_web::test::try_read_body_json($response)
                .await
                .expect("cannot read response body");
            let error_type = payload.get("type").expect("invalid error format");
            assert_eq!(error_type, expected_error.get_type(), "error type mismatch");
        }};
    }

    /// Creates a test client with 1 pg connection and a given [CoreClient]
    pub async fn create_test_service_with_core_client<C: Into<CoreClient>>(
        core: C,
    ) -> impl Service<Request, Response = ServiceResponse<BoxBody>, Error = Error> {
        TestAppBuilder::new()
            .db_pool_v1()
            .core_client(core.into())
            .build()
            .service
    }

    /// Create a test editoast client
    /// This client create a single new connection to the database
    pub async fn create_test_service(
    ) -> impl Service<Request, Response = ServiceResponse<BoxBody>, Error = Error> {
        create_test_service_with_core_client(CoreClient::default()).await
    }

    #[rstest]
    async fn health() {
        let app = TestAppBuilder::default_app();
        let request = TestRequest::get().uri("/health").to_request();
        app.fetch(request).assert_status(StatusCode::OK);
    }

    #[actix_test]
    async fn version() {
        let service = create_test_service().await;
        let request = TestRequest::get().uri("/version").to_request();
        let response: HashMap<String, Option<String>> =
            call_and_read_body_json(&service, request).await;
        assert!(response.contains_key("git_describe"));
    }

    #[actix_test]
    async fn core_version() {
        let mut core = MockingClient::new();
        core.stub("/version")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .body(r#"{"git_describe": ""}"#)
            .finish();
        let app = create_test_service_with_core_client(core).await;
        let request = TestRequest::get().uri("/version/core").to_request();
        let response: HashMap<String, Option<String>> =
            call_and_read_body_json(&app, request).await;
        assert!(response.contains_key("git_describe"));
    }
}
