//! Exposes [TestApp] and [TestAppBuilder] to ease the setup of the
//! test actix server, database connection pool, and different mocking
//! components.

use std::{sync::Arc, time::Duration};

use axum::Router;
use axum_tracing_opentelemetry::middleware::OtelAxumLayer;
use dashmap::DashMap;
use editoast_models::db_connection_pool::create_connection_pool;
use editoast_models::DbConnectionPoolV2;
use editoast_osrdyne_client::OsrdyneClient;
use serde::de::DeserializeOwned;
use tower_http::trace::TraceLayer;

use crate::{
    client::{MapLayersConfig, PostgresConfig, ValkeyConfig},
    core::{mocking::MockingClient, CoreClient},
    generated_data::speed_limit_tags_config::SpeedLimitTagIds,
    infra_cache::InfraCache,
    map::MapLayers,
    AppState, ValkeyClient,
};
use axum_test::TestRequest;
use axum_test::TestServer;

use super::authentication_middleware;

/// A builder interface for [TestApp]
///
/// It allows configuring some parameters for the app service.
/// Currently it allows setting the database connection pool (v1 or v2) and the core client.
///
/// Use [TestAppBuilder::default_app] to get a default app with a v2 database connection pool
/// and a default core client (mocking disabled).
///
/// The `db_pool_v1` parameter is only relevant while the pool migration is ongoing.
pub(crate) struct TestAppBuilder {
    db_pool: Option<DbConnectionPoolV2>,
    core_client: Option<CoreClient>,
    osrdyne_client: Option<OsrdyneClient>,
    db_pool_v1: bool,
}

impl TestAppBuilder {
    pub fn new() -> Self {
        Self {
            db_pool: None,
            core_client: None,
            osrdyne_client: None,
            db_pool_v1: false,
        }
    }

    pub fn db_pool(mut self, db_pool: DbConnectionPoolV2) -> Self {
        assert!(self.db_pool.is_none());
        assert!(!self.db_pool_v1);
        self.db_pool = Some(db_pool);
        self
    }

    pub fn core_client(mut self, core_client: CoreClient) -> Self {
        assert!(self.core_client.is_none());
        self.core_client = Some(core_client);
        self
    }

    pub fn osrdyne_client(mut self, osrdyne_client: OsrdyneClient) -> Self {
        assert!(self.osrdyne_client.is_none());
        self.osrdyne_client = Some(osrdyne_client);
        self
    }

    pub fn default_app() -> TestApp {
        let pool = DbConnectionPoolV2::for_tests();
        let core_client = CoreClient::Mocked(MockingClient::default());
        TestAppBuilder::new()
            .db_pool(pool)
            .core_client(core_client)
            .build()
    }

    pub fn build(self) -> TestApp {
        let sub = tracing_subscriber::fmt()
            .pretty()
            .with_env_filter(
                tracing_subscriber::EnvFilter::builder()
                    .with_default_directive(tracing_subscriber::filter::LevelFilter::DEBUG.into())
                    .from_env_lossy(),
            )
            .with_span_events(tracing_subscriber::fmt::format::FmtSpan::CLOSE)
            .finish();
        let tracing_guard = tracing::subscriber::set_default(sub);

        // Config valkey
        let valkey = ValkeyClient::new(ValkeyConfig::default())
            .expect("Could not build Valkey client")
            .into();

        // Create both database pools
        let (db_pool_v2, db_pool_v1) = if self.db_pool_v1 {
            let config = PostgresConfig::default();
            let pg_config_url = config.url().expect("cannot get postgres config url");
            let pool = create_connection_pool(pg_config_url, config.pool_size)
                .expect("could not create connection pool for tests");
            let v1 = Arc::new(pool);
            let v2 = futures::executor::block_on(DbConnectionPoolV2::from_pool(v1.clone()));
            (Arc::new(v2), v1)
        } else {
            let db_pool_v2 = self.db_pool.expect(
                "No database pool provided to TestAppBuilder, use Default or provide a database pool"
            );
            let db_pool_v1 = db_pool_v2.pool_v1();
            (Arc::new(db_pool_v2), db_pool_v1)
        };

        // Setup infra cache map
        let infra_caches = DashMap::<i64, InfraCache>::default().into();

        // Load speed limit tag config
        let speed_limit_tag_ids = Arc::new(SpeedLimitTagIds::load());

        // Build Core client
        let core_client = Arc::new(self.core_client.expect(
            "No core client provided to TestAppBuilder, use Default or provide a core client",
        ));

        // Build Osrdyne client
        let osrdyne_client = self
            .osrdyne_client
            .unwrap_or_else(OsrdyneClient::default_mock);
        let osrdyne_client = Arc::new(osrdyne_client);

        let app_state = AppState {
            db_pool_v1,
            db_pool_v2: db_pool_v2.clone(),
            core_client: core_client.clone(),
            osrdyne_client,
            valkey,
            infra_caches,
            map_layers: MapLayers::parse().into(),
            map_layers_config: MapLayersConfig::default().into(),
            speed_limit_tag_ids,
            disable_authorization: true,
            health_check_timeout: Duration::from_millis(500),
        };

        // Configure the axum router
        let router: Router<()> = axum::Router::<AppState>::new()
            .merge(crate::views::router())
            .route_layer(axum::middleware::from_fn_with_state(
                app_state.clone(),
                authentication_middleware,
            ))
            .layer(OtelAxumLayer::default())
            .layer(TraceLayer::new_for_http())
            .with_state(app_state);

        // Run server
        let server = TestServer::new(router).expect("test server should build properly");

        TestApp {
            server,
            db_pool: db_pool_v2,
            core_client,
            tracing_guard,
        }
    }
}

/// Wraps an underlying, fully configured, actix service
///
/// It also holds a reference to the database connection pool and the core client,
/// which can be accessed through the [TestApp] methods.
pub(crate) struct TestApp {
    server: TestServer,
    db_pool: Arc<DbConnectionPoolV2>,
    core_client: Arc<CoreClient>,
    #[allow(unused)] // included here to extend its lifetime, not meant to be used in any way
    tracing_guard: tracing::subscriber::DefaultGuard,
}

impl TestApp {
    #[allow(dead_code)] // while the pool migration is ongoing
    pub fn core_client(&self) -> Arc<CoreClient> {
        self.core_client.clone()
    }

    pub fn db_pool(&self) -> Arc<DbConnectionPoolV2> {
        self.db_pool.clone()
    }

    pub fn fetch(&self, req: TestRequest) -> TestResponse {
        futures::executor::block_on(async move {
            tracing::trace!(request = ?req);
            let response = req.await;
            TestResponse::new(response)
        })
    }

    pub fn get(&self, path: &str) -> TestRequest {
        self.server.get(&trim_path(path))
    }
    pub fn post(&self, path: &str) -> TestRequest {
        self.server.post(&trim_path(path))
    }
    pub fn put(&self, path: &str) -> TestRequest {
        self.server.put(&trim_path(path))
    }
    pub fn patch(&self, path: &str) -> TestRequest {
        self.server.patch(&trim_path(path))
    }
    pub fn delete(&self, path: &str) -> TestRequest {
        self.server.delete(&trim_path(path))
    }
}

// For technical reasons, we had a hard time trying to configure the normalizing layer
// in the test server. Since we have control over the paths configured in our unit tests,
// doing this manually is probably a good enough solution for now.
fn trim_path(path: &str) -> String {
    if let Some(path) = path.strip_suffix('/') {
        path.to_owned()
    } else if path.contains("/?") {
        path.replace("/?", "?")
    } else {
        path.to_owned()
    }
}

pub struct TestResponse {
    inner: axum_test::TestResponse,
    log_payload: bool,
}

impl TestResponse {
    #[tracing::instrument(name = "Response", level = "debug", skip(inner), fields(status = ?inner.status_code()))]
    fn new(inner: axum_test::TestResponse) -> Self {
        tracing::trace!(response = ?inner);
        Self {
            inner,
            log_payload: true,
        }
    }

    #[allow(unused)]
    pub fn log_payload(mut self, log_payload: bool) -> Self {
        self.log_payload = log_payload;
        self
    }

    fn render_response_lossy(self) -> String {
        if !self.log_payload {
            return "payload logging disabled".to_string();
        }
        let bytes = self.inner.into_bytes();
        serde_json::from_slice::<serde_json::Value>(&bytes)
            .ok()
            .and_then(|json| serde_json::to_string_pretty(&json).ok())
            .unwrap_or_else(|| "cannot render response body".to_string())
    }

    pub fn assert_status(self, expected_status: axum::http::StatusCode) -> Self {
        let actual_status = self.inner.status_code();
        if actual_status != expected_status {
            let body = self.render_response_lossy();
            pretty_assertions::assert_eq!(
                actual_status,
                expected_status,
                "unexpected status code body={body}"
            );
            unreachable!("should have already panicked")
        } else {
            self
        }
    }

    pub fn bytes(self) -> Vec<u8> {
        self.inner.into_bytes().into()
    }

    pub fn content_type(&self) -> String {
        self.inner
            .header("Content-Type")
            .to_str()
            .expect("Content-Type header should be valid UTF-8")
            .to_string()
    }

    #[tracing::instrument(
        name = "Deserialization",
        level = "debug",
        skip(self),
        fields(response_status = ?self.inner.status_code())
    )]
    pub fn json_into<T: DeserializeOwned>(self) -> T {
        let body = self.bytes();
        serde_json::from_slice(body.as_ref()).unwrap_or_else(|err| {
            tracing::error!(error = ?err, "Error deserializing test response into the desired type");
            let actual: serde_json::Value =
                serde_json::from_slice(body.as_ref()).unwrap_or_else(|err| {
                    tracing::error!(
                        error = ?err,
                        ?body,
                        "Failed to deserialize test response body into JSON"
                    );
                    panic!("could not deserialize test response into JSON");
                });
            let pretty = serde_json::to_string_pretty(&actual).unwrap();
            tracing::error!(body = %pretty, "Actual JSON value");
            panic!("could not deserialize test request");
        })
    }
}
