//! Exposes [TestApp] and [TestAppBuilder] to ease the setup of the
//! test actix server, database connection pool, and different mocking
//! components.

use std::collections::HashSet;
use std::sync::Arc;

use axum::Router;
use axum_tracing_opentelemetry::middleware::OtelAxumLayer;
use dashmap::DashMap;
use editoast_authz::subject::UserInfo;
use editoast_authz::Authorizer;
use editoast_authz::BuiltinRole;
use editoast_common::tracing::create_tracing_subscriber;
use editoast_common::tracing::Stream;
use editoast_common::tracing::Telemetry;
use editoast_common::tracing::TracingConfig;
use editoast_models::DbConnectionPoolV2;
use editoast_osrdyne_client::OsrdyneClient;
use futures::executor::block_on;
use futures::future::BoxFuture;
use opentelemetry_sdk::error::OTelSdkResult;
use opentelemetry_sdk::trace::SpanData;
use opentelemetry_sdk::trace::SpanExporter;
use serde::de::DeserializeOwned;
use tower_http::trace::TraceLayer;
use tracing_subscriber::filter::Directive;
use url::Url;

use crate::core::mocking::MockingClient;
use crate::core::CoreClient;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::infra_cache::InfraCache;
use crate::map::MapLayers;
use crate::models::PgAuthDriver;
use crate::valkey_utils::ValkeyConfig;
use crate::AppState;
use crate::ValkeyClient;
use axum_test::TestRequest;
use axum_test::TestServer;

use super::authentication_middleware;
use super::CoreConfig;
use super::OpenfgaConfig;
use super::OsrdyneConfig;
use super::PostgresConfig;
use super::Regulator;
use super::ServerConfig;

// NoopSpanExporter exists in 'opentelemetry-sdk' but is hidden behind
// 'testing' feature which brings with it tons of unneeded dependencies
// like 'async-std'.
#[derive(Debug)]
struct NoopSpanExporter;

impl NoopSpanExporter {
    fn new() -> Self {
        Self
    }
}

impl SpanExporter for NoopSpanExporter {
    fn export(&mut self, _: Vec<SpanData>) -> BoxFuture<'static, OTelSdkResult> {
        Box::pin(std::future::ready(Ok(())))
    }
}

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
    test_name: String,
    db_pool: Option<DbConnectionPoolV2>,
    core_client: Option<CoreClient>,
    osrdyne_client: Option<OsrdyneClient>,
    authorization_model: Option<&'static str>,
    enable_stdcm_logging: bool,
    enable_telemetry: bool,
    telemetry_directives: Vec<Directive>,
}

impl TestAppBuilder {
    pub fn new() -> Self {
        Self {
            test_name: String::from("editoast-test"),
            db_pool: None,
            core_client: None,
            osrdyne_client: None,
            authorization_model: None,
            enable_stdcm_logging: false,
            enable_telemetry: true,
            telemetry_directives: vec![],
        }
    }

    /// Configures the name of the test
    ///
    /// Used to name the OpenFGA store created for the test.
    pub fn test_name(mut self, test_name: String) -> Self {
        self.test_name = test_name;
        self
    }

    pub fn db_pool(mut self, db_pool: DbConnectionPoolV2) -> Self {
        self.db_pool = Some(db_pool);
        self
    }

    pub fn core_client(mut self, core_client: CoreClient) -> Self {
        self.core_client = Some(core_client);
        self
    }

    pub fn osrdyne_client(mut self, osrdyne_client: OsrdyneClient) -> Self {
        self.osrdyne_client = Some(osrdyne_client);
        self
    }

    pub fn enable_authorization(mut self, enable_authorization: bool) -> Self {
        self.authorization_model =
            enable_authorization.then_some(editoast_authz::AUTHORIZATION_MODEL);
        self
    }

    pub fn enable_stdcm_logging(mut self, enable_stdcm_logging: bool) -> Self {
        self.enable_stdcm_logging = enable_stdcm_logging;
        self
    }

    pub fn enable_telemetry(mut self, enable_telemetry: bool) -> Self {
        self.enable_telemetry = enable_telemetry;
        self
    }

    pub fn with_rust_log_directive(mut self, directive: Directive) -> Self {
        self.telemetry_directives.push(directive);
        self
    }

    pub fn default_app() -> TestApp {
        TestAppBuilder::new().build()
    }

    pub fn build(self) -> TestApp {
        // Generate test server config
        let config = ServerConfig {
            port: 0,
            address: String::default(),
            health_check_timeout: chrono::Duration::milliseconds(500),
            enable_authorization: self.authorization_model.is_some(),
            enable_stdcm_logging: self.enable_stdcm_logging,
            map_layers_max_zoom: 18,
            postgres_config: PostgresConfig {
                database_url: Url::parse("postgres://osrd:password@localhost:5432/osrd").unwrap(),
                pool_size: 32,
            },
            osrdyne_config: OsrdyneConfig {
                mq_url: Url::parse("amqp://osrd:password@127.0.0.1:5672/%2f").unwrap(),
                osrdyne_api_url: Url::parse("http://127.0.0.1:4242/").unwrap(),
                core: CoreConfig {
                    timeout: chrono::Duration::seconds(180),
                    single_worker: false,
                    num_channels: 8,
                },
            },
            valkey_config: ValkeyConfig {
                no_cache: true,
                valkey_url: Url::parse("redis://localhost:6379").unwrap(),
            },
            openfga_config: OpenfgaConfig {
                url: Url::parse("http://localhost:8091").unwrap(),
                store: self.test_name.clone(),
            },
        };

        // Setup tracing
        let telemetry = if self.enable_telemetry {
            Some(Telemetry {
                service_name: "osrd-editoast".into(),
                endpoint: Url::parse("http://localhost:4317").unwrap(),
            })
        } else {
            None
        };
        let tracing_config = TracingConfig {
            stream: Stream::Stdout,
            telemetry,
            directives: self.telemetry_directives,
        };
        let sub = create_tracing_subscriber(
            tracing_config,
            tracing_subscriber::filter::LevelFilter::DEBUG,
            NoopSpanExporter::new(),
        );
        let tracing_guard = tracing::subscriber::set_default(sub);

        // Config valkey
        let valkey = ValkeyClient::new(config.valkey_config.clone())
            .expect("Could not build Valkey client")
            .into();

        // Create database pool
        let db_pool_v2 = Arc::new(self.db_pool.unwrap_or_else(DbConnectionPoolV2::for_tests));

        // Setup infra cache map
        let infra_caches = DashMap::<i64, InfraCache>::default().into();

        // Load speed limit tag config
        let speed_limit_tag_ids = Arc::new(SpeedLimitTagIds::load());

        // Build Core client
        let core_client = Arc::new(
            self.core_client
                .unwrap_or_else(|| CoreClient::Mocked(MockingClient::default())),
        );

        // Build Osrdyne client
        let osrdyne_client = self
            .osrdyne_client
            .unwrap_or_else(OsrdyneClient::default_mock);
        let osrdyne_client = Arc::new(osrdyne_client);

        let store_name = {
            const OPENFGA_STORE_NAME_MIN_LEN: usize = 3;
            const OPENFGA_STORE_NAME_MAX_LEN: usize = 64;
            match self.test_name.clone() {
                name if name.len() < OPENFGA_STORE_NAME_MIN_LEN => {
                    let suffix = "_".repeat(OPENFGA_STORE_NAME_MIN_LEN - name.len());
                    name + suffix.as_str()
                }
                name if name.len() > OPENFGA_STORE_NAME_MAX_LEN => name
                    .chars()
                    .take(OPENFGA_STORE_NAME_MAX_LEN)
                    .collect::<String>(),
                name => name,
            }
        };
        let mut openfga = block_on(fga::Client::try_new_store(
            store_name,
            fga::client::ConnectionSettings::new("localhost".to_owned(), 8091).reset_store(),
        ))
        .expect("OpenFGA should be setup properly for testing");
        if let Some(model) = self.authorization_model {
            let model = fga::compile_model(model);
            block_on(openfga.update_authorization_model(&model))
                .expect("OpenFGA authorization model should be updated");
        }
        let driver = PgAuthDriver::new(db_pool_v2.clone());
        let regulator = Regulator::new(openfga.clone(), driver);

        let app_state = AppState {
            db_pool: db_pool_v2.clone(),
            core_client: core_client.clone(),
            osrdyne_client,
            valkey,
            regulator,
            infra_caches,
            map_layers: Arc::new(MapLayers::default()),
            speed_limit_tag_ids,
            health_check_timeout: config.health_check_timeout,
            config: Arc::new(config),
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
            .with_state(app_state.clone());

        // Run server
        let server = TestServer::new(router).expect("test server should build properly");

        TestApp {
            server,
            app_state,
            authorization_model: self.authorization_model,
            tracing_guard,
        }
    }
}

/// Returns a default [TestAppBuilder] with the [TestAppBuilder::test_name] set to the current test name
///
/// This **has** to be used in the test function directly to ensure that the test name is correctly set.
///
/// The crate `stdext` is required.
macro_rules! test_app {
    () => {
        TestAppBuilder::new().test_name(
            stdext::function_name!()
                .split("::")
                .filter(|x| *x != "{{closure}}")
                .collect::<Vec<_>>()
                .join("-"),
        )
    };
}

pub(crate) use test_app;

/// Wraps an underlying, fully configured, actix service
///
/// It also holds a reference to the database connection pool and the core client,
/// which can be accessed through the [TestApp] methods.
pub(crate) struct TestApp {
    server: TestServer,
    app_state: AppState,
    authorization_model: Option<&'static str>,
    #[allow(unused)] // included here to extend its lifetime, not meant to be used in any way
    tracing_guard: tracing::subscriber::DefaultGuard,
}

impl TestApp {
    pub fn db_pool(&self) -> Arc<DbConnectionPoolV2> {
        self.app_state.db_pool.clone()
    }

    pub fn user(&self, identity: impl ToString, name: impl ToString) -> UserBuilder {
        UserBuilder::new(
            self,
            UserInfo {
                identity: identity.to_string(),
                name: name.to_string(),
            },
        )
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

pub struct UserBuilder<'a> {
    app: &'a TestApp,
    info: UserInfo,
    roles: HashSet<BuiltinRole>,
}

impl<'a> UserBuilder<'a> {
    fn new(app: &'a TestApp, info: UserInfo) -> Self {
        Self {
            app,
            info,
            roles: Default::default(),
        }
    }

    pub fn with_roles(mut self, roles: impl IntoIterator<Item = BuiltinRole>) -> Self {
        self.roles = roles.into_iter().collect();
        self
    }

    pub fn create(self) -> UserInfo {
        let Self { app, info, roles } = self;
        if !roles.is_empty()
            && (app.authorization_model.is_none() || !app.app_state.config.enable_authorization)
        {
            panic!("Authorization must be enabled and a model must be provided to grant a user some roles");
        }
        let regulator = &app.app_state.regulator;
        block_on(async move {
            let authorizer = Authorizer::try_initialize(info.clone(), regulator.clone())
                .await
                .expect("User should be created successfully");
            regulator
                .grant_user_roles(authorizer.user_id(), roles)
                .await
                .expect("roles should be granted successfully");
            info
        })
    }
}

pub trait TestRequestExt {
    fn by_user(self, user: UserInfo) -> Self;
}

impl TestRequestExt for TestRequest {
    fn by_user(self, user: UserInfo) -> Self {
        self.add_header("x-remote-user-identity", user.identity)
            .add_header("x-remote-user-name", user.name)
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
