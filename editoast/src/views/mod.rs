mod documents;
pub mod electrical_profiles;
pub mod infra;
mod layers;
pub mod light_rolling_stocks;
pub mod openapi;
pub mod pagination;
pub mod params;
pub mod pathfinding;
pub mod projects;
pub mod rolling_stocks;
pub mod scenario;
pub mod search;
pub mod stdcm;
pub mod study;
pub mod timetable;
pub mod train_schedule;

use self::openapi::{merge_path_items, remove_discriminator, OpenApiMerger, Routes};
use crate::client::get_app_version;
use crate::core::version::CoreVersionRequest;
use crate::core::{AsCoreRequest, CoreClient};
use crate::error::Result;
use crate::map::redis_utils::RedisClient;
use crate::{schemas, DbPool};
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{Data, Json};
use actix_web::{get, services};
use diesel::sql_query;
use diesel_async::RunQueryDsl;
use redis::cmd;
use serde_derive::{Deserialize, Serialize};
use utoipa::{OpenApi, ToSchema};

// This function is only temporary while our migration to using utoipa is
// still going
fn routes_v2() -> Routes<impl HttpServiceFactory> {
    crate::routes! {
        health,
        version,
        core_version,
        timetable::routes(),
    }
    routes()
}

pub fn routes() -> impl HttpServiceFactory {
    services![
        routes_v2(),
        search::search,
        infra::routes(),
        layers::routes(),
        electrical_profiles::routes(),
        rolling_stocks::routes(),
        light_rolling_stocks::routes(),
        pathfinding::routes(),
        train_schedule::routes(),
        stdcm::routes(),
    ]
}

schemas! {
    Version,
    &crate::core::infra_state::InfraStateResponse,
    infra::schemas(),
    pagination::schemas(),
    timetable::schemas(),
    crate::map::schemas(),
    crate::schema::schemas(),
    crate::models::schemas(),
}

pub fn study_routes() -> impl HttpServiceFactory {
    services![
        projects::routes(),
        study::routes(),
        scenario::routes(),
        documents::routes(),
    ]
}

#[derive(OpenApi)]
#[openapi(
    info(description = "My Api description"),
    tags(),
    paths(),
    components(responses())
)]
pub struct OpenApiRoot;

impl OpenApiRoot {
    // RTK doesn't support the discriminator: property everywhere utoipa
    // puts it. So we remove it, even though utoipa is correct.
    fn remove_discrimators(openapi: &mut utoipa::openapi::OpenApi) {
        for (_, endpoint) in openapi.paths.paths.iter_mut() {
            for (_, operation) in endpoint.operations.iter_mut() {
                if let Some(request_body) = operation.request_body.as_mut() {
                    for (_, content) in request_body.content.iter_mut() {
                        remove_discriminator(&mut content.schema);
                    }
                }
            }
        }
        if let Some(components) = openapi.components.as_mut() {
            for component in components.schemas.values_mut() {
                remove_discriminator(component);
            }
        }
    }

    pub fn build_openapi() -> serde_json::Value {
        let manual = include_str!("../../openapi_legacy.yaml").to_owned();
        let mut openapi = OpenApiRoot::openapi();

        let routes = routes_v2();
        for (path, path_item) in routes.paths.into_flat_path_list() {
            log::debug!("processing {path}");
            if openapi.paths.paths.contains_key(&path) {
                let existing_path_item = openapi.paths.paths.remove(&path).unwrap();
                let merged = merge_path_items(existing_path_item, path_item);
                openapi.paths.paths.insert(path, merged);
            } else {
                openapi.paths.paths.insert(path, path_item);
            }
        }

        if openapi.components.is_none() {
            openapi.components = Some(Default::default());
        }
        openapi
            .components
            .as_mut()
            .unwrap()
            .schemas
            .extend(schemas());

        Self::remove_discrimators(&mut openapi);

        // Remove the operation_id that defaults to the endpoint function name
        // so that it doesn't override the RTK methods names.
        for (_, endpoint) in openapi.paths.paths.iter_mut() {
            for (_, operation) in endpoint.operations.iter_mut() {
                operation.operation_id = None;
                // By default utoipa adds a tag "crate" to operations that don't have
                // any. That causes problems with RTK tag management.
                match &operation.tags {
                    Some(tags) if tags.len() == 1 && tags.get(0).unwrap() == "crate" => {
                        operation.tags = None;
                    }
                    _ => (),
                }
            }
        }
        let generated = openapi
            .to_json()
            .expect("the openapi should generate properly");
        OpenApiMerger::new(manual, generated)
            .smart_merge()
            .add_trailing_slash_to_paths()
            .finish()
    }
}

#[utoipa::path(
    responses(
        (status = 200, description = "Check if Editoast is running correctly", body = String)
    )
)]
#[get("/health")]
async fn health(db_pool: Data<DbPool>, redis_client: Data<RedisClient>) -> Result<&'static str> {
    let mut conn = db_pool.get().await?;
    sql_query("SELECT 1").execute(&mut conn).await?;

    let mut conn = redis_client.get_connection().await?;
    cmd("PING").query_async::<_, ()>(&mut conn).await.unwrap();
    Ok("ok")
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

    use crate::client::{MapLayersConfig, PostgresConfig, RedisConfig};
    use crate::core::mocking::MockingClient;
    use crate::core::CoreClient;
    use crate::infra_cache::InfraCache;
    use crate::map::redis_utils::RedisClient;
    use crate::map::MapLayers;

    use super::{routes, study_routes, OpenApiRoot};
    use actix_http::body::BoxBody;
    use actix_http::{Request, StatusCode};
    use actix_web::dev::{Service, ServiceResponse};
    use actix_web::middleware::NormalizePath;
    use actix_web::test as actix_test;
    use actix_web::test::{call_and_read_body_json, call_service, init_service, TestRequest};
    use actix_web::web::{Data, JsonConfig};
    use actix_web::{App, Error};
    use chashmap::CHashMap;
    use diesel_async::pooled_connection::deadpool::Pool;
    use diesel_async::pooled_connection::AsyncDieselConnectionManager as ConnectionManager;
    use diesel_async::AsyncPgConnection as PgConnection;

    /// Asserts the status code of a simulated response and deserializes its body,
    /// with a nice failure message should the something fail
    #[macro_export]
    macro_rules! assert_status_and_read {
        ($response: ident, $status: expr) => {{
            let (status, body): (_, serde_json::Value) = (
                $response.status(),
                actix_web::test::read_body_json($response).await,
            );
            let fmt_body = format!("{}", body);
            assert_eq!(status, $status, "unexpected error response: {}", fmt_body);
            match serde_json::from_value(body) {
                Ok(response) => response,
                Err(err) => panic!(
                    "cannot deserialize response because '{}': {}",
                    err, fmt_body
                ),
            }
        }};
    }

    /// Checks if the field "type" of the response matches the `type` field of
    /// the `InternalError` derived from the provided error
    ///
    /// The other error fields (message, status_code and context) are ignored.
    #[macro_export]
    macro_rules! assert_editoast_error_type {
        ($response: ident, $error: expr) => {{
            let expected_error: $crate::error::InternalError = $error.into();
            let payload: serde_json::Value = actix_web::test::read_body_json($response).await;
            let error_type = payload.get("type").expect("invalid error format");
            assert_eq!(error_type, expected_error.get_type(), "error type mismatch");
        }};
    }

    /// Creates a test client with 1 pg connection and a given [CoreClient]
    pub async fn create_test_service_with_core_client<C: Into<CoreClient>>(
        core: C,
    ) -> impl Service<Request, Response = ServiceResponse<BoxBody>, Error = Error> {
        let pg_config = PostgresConfig::default();
        let manager = ConnectionManager::<PgConnection>::new(pg_config.url());
        let pool = Pool::builder(manager)
            .build()
            .expect("Failed to create pool.");
        let redis = RedisClient::new(RedisConfig::default());

        // Custom Json extractor configuration
        let json_cfg = JsonConfig::default()
            .limit(250 * 1024 * 1024) // 250MB
            .error_handler(|err, _| err.into());

        let core: CoreClient = core.into();
        let app = App::new()
            .wrap(NormalizePath::trim())
            .app_data(json_cfg)
            .app_data(Data::new(pool))
            .app_data(Data::new(redis))
            .app_data(Data::new(CHashMap::<i64, InfraCache>::default()))
            .app_data(Data::new(MapLayers::parse()))
            .app_data(Data::new(MapLayersConfig::default()))
            .app_data(Data::new(core))
            .service((routes(), study_routes()));
        init_service(app).await
    }

    /// Create a test editoast client
    /// This client create a single new connection to the database
    pub async fn create_test_service(
    ) -> impl Service<Request, Response = ServiceResponse<BoxBody>, Error = Error> {
        create_test_service_with_core_client(CoreClient::default()).await
    }

    #[actix_test]
    async fn health() {
        let service = create_test_service().await;
        let request = TestRequest::get().uri("/health").to_request();
        let response = call_service(&service, request).await;
        assert!(response.status().is_success());
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

    #[test]
    fn openapi_merge_goes_well() {
        let _ = OpenApiRoot::build_openapi(); // panics if something is wrong
    }
}
