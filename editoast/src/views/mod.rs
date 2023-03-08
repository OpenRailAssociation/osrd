mod documents;
pub mod electrical_profiles;
mod infra;
mod layers;
pub mod light_rolling_stocks;
pub mod pagination;
pub mod params;
pub mod rolling_stocks;
pub mod search;

use crate::DbPool;
use actix_web::dev::HttpServiceFactory;
use actix_web::web::{block, Data, Json};
use actix_web::{get, services};
use diesel::{sql_query, RunQueryDsl};
use redis::{cmd, Client};
use serde_json::{json, Value as JsonValue};
use std::env;

pub fn routes() -> impl HttpServiceFactory {
    services![
        health,
        version,
        search::search,
        infra::routes(),
        layers::routes(),
        electrical_profiles::routes(),
        documents::routes(),
        rolling_stocks::routes(),
        light_rolling_stocks::routes(),
    ]
}

#[get("/health")]
async fn health(db_pool: Data<DbPool>, redis_client: Data<Client>) -> &'static str {
    block(move || {
        let mut conn = db_pool.get().expect("Failed to get DB connection");
        sql_query("SELECT 1").execute(&mut conn).unwrap();
    })
    .await
    .unwrap();

    let mut conn = redis_client.get_tokio_connection_manager().await.unwrap();
    cmd("PING").query_async::<_, ()>(&mut conn).await.unwrap();
    "ok"
}

#[get("/version")]
async fn version() -> Json<JsonValue> {
    let describe = env::var("OSRD_GIT_DESCRIBE").ok();
    Json(json!({ "git_describe": describe }))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::client::{MapLayersConfig, PostgresConfig, RedisConfig};
    use crate::infra_cache::InfraCache;
    use crate::map::MapLayers;

    use super::routes;
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

    /// Create a test editoast client
    /// This client create a single new connection to the database
    pub async fn create_test_service(
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
            .service(routes());
        init_service(app).await
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
