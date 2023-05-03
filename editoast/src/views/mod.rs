mod documents;
pub mod electrical_profiles;
pub mod infra;
mod layers;
pub mod light_rolling_stocks;
pub mod pagination;
pub mod params;
pub mod pathfinding;
pub mod projects;
pub mod rolling_stocks;
pub mod scenario;
pub mod search;
pub mod study;
pub mod timetable;
pub mod train_schedule;

use crate::client::get_app_version;
use crate::error::Result;
use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{block, Data, Json};
use actix_web::{get, services};
use diesel::{sql_query, RunQueryDsl};
use redis::{cmd, Client};
use serde_json::{json, Value as JsonValue};

pub fn routes() -> impl HttpServiceFactory {
    services![
        health,
        version,
        search::search,
        infra::routes(),
        layers::routes(),
        electrical_profiles::routes(),
        timetable::routes(),
        rolling_stocks::routes(),
        light_rolling_stocks::routes(),
        pathfinding::routes()
    ]
}

pub fn study_routes() -> impl HttpServiceFactory {
    services![
        projects::routes(),
        study::routes(),
        scenario::routes(),
        documents::routes(),
    ]
}

#[get("/health")]
async fn health(db_pool: Data<DbPool>, redis_client: Data<Client>) -> Result<&'static str> {
    block::<_, Result<_>>(move || {
        let mut conn = db_pool.get()?;
        sql_query("SELECT 1").execute(&mut conn)?;
        Ok(())
    })
    .await
    .unwrap()?;

    let mut conn = redis_client.get_tokio_connection_manager().await?;
    cmd("PING").query_async::<_, ()>(&mut conn).await.unwrap();
    Ok("ok")
}

#[get("/version")]
async fn version() -> Json<JsonValue> {
    Json(json!({ "git_describe": get_app_version() }))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::client::{MapLayersConfig, PostgresConfig, RedisConfig};
    use crate::core::CoreClient;
    use crate::infra_cache::InfraCache;
    use crate::map::MapLayers;

    use super::{routes, study_routes};
    use actix_http::body::BoxBody;
    use actix_http::Request;
    use actix_web::dev::{Service, ServiceResponse};
    use actix_web::middleware::NormalizePath;
    use actix_web::test as actix_test;
    use actix_web::test::{call_and_read_body_json, call_service, init_service, TestRequest};
    use actix_web::web::{Data, JsonConfig};
    use actix_web::{App, Error};
    use chashmap::CHashMap;
    use diesel::r2d2::{ConnectionManager, Pool};
    use diesel::PgConnection;

    /// Asserts the status code of a simulated response and deserailizes its body,
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
    pub async fn create_test_service_with_core_client(
        core: CoreClient,
    ) -> impl Service<Request, Response = ServiceResponse<BoxBody>, Error = Error> {
        let pg_config = PostgresConfig::default();
        let manager = ConnectionManager::<PgConnection>::new(pg_config.url());
        let pool = Pool::builder()
            .max_size(1)
            .build(manager)
            .expect("Failed to create pool.");
        let redis = redis::Client::open(RedisConfig::default().redis_url).unwrap();

        // Custom Json extractor configuration
        let json_cfg = JsonConfig::default()
            .limit(250 * 1024 * 1024) // 250MB
            .error_handler(|err, _| err.into());

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
}
