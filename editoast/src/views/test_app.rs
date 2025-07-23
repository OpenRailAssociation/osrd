//! Exposes [TestApp] and [TestAppBuilder] to ease the setup of the
//! test axum server, database connection pool, and different mocking
//! components.

use std::collections::HashMap;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Arc;

use authz::InfraGrant;
use authz::Role;
use authz::StorageDriver;
use authz::identity::GroupInfo;
use authz::identity::UserInfo;
use axum::Router;
use axum_test::TestRequest;
use axum_test::TestServer;
use axum_tracing_opentelemetry::middleware::OtelAxumLayer;
use common::tracing::SpanUploading;
use common::tracing::Stream;
use common::tracing::Telemetry;
use common::tracing::TracingConfig;
use common::tracing::create_tracing_subscriber;
use core_client::CoreClient;
use core_client::mocking::MockingClient;
use dashmap::DashMap;
use database::DbConnectionPoolV2;
use fga::client::Limits;
use futures::executor::block_on;
use opentelemetry_sdk::error::OTelSdkResult;
use opentelemetry_sdk::trace::SpanData;
use opentelemetry_sdk::trace::SpanExporter;
use osrdyne_client::OsrdyneClient;
use serde::de::DeserializeOwned;
use tower_http::trace::TraceLayer;
use url::Url;

use crate::AppState;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::infra_cache::InfraCache;
use crate::models::PgAuthDriver;
use crate::views::service_router;
use editoast_models::map::MapLayers;
use fga::client::DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK;
use fga::client::DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE;

use super::CoreConfig;
use super::OpenfgaConfig;
use super::OsrdyneConfig;
use super::PostgresConfig;
use super::Regulator;
use super::ServerConfig;
use super::authentication_middleware;

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
    fn export(&self, _: Vec<SpanData>) -> impl std::future::Future<Output = OTelSdkResult> + Send {
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
    enable_authorization: bool,
    enable_telemetry: bool,
    root_url: Option<Url>,
}

impl TestAppBuilder {
    pub fn new() -> Self {
        Self {
            test_name: String::from("editoast-test"),
            db_pool: None,
            core_client: None,
            osrdyne_client: None,
            enable_authorization: false,
            enable_telemetry: true,
            root_url: None,
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
        self.enable_authorization = enable_authorization;
        self
    }

    pub fn root_url(mut self, root_url: Url) -> Self {
        self.root_url = Some(root_url);
        self
    }

    pub fn default_app() -> TestApp {
        TestAppBuilder::new().build()
    }

    pub fn build(self) -> TestApp {
        // Generate test server config
        let config = ServerConfig {
            app_version: None,
            port: 0,
            address: String::default(),
            health_check_timeout: chrono::Duration::milliseconds(500),
            enable_authorization: self.enable_authorization,
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
                    worker_pool_id: "core".into(),
                },
            },
            valkey_config: cache::Config::NoCache,
            root_url: self
                .root_url
                .unwrap_or_else(|| Url::parse("http://localhost:8090/").unwrap()),
            dynamic_assets_path: PathBuf::from("./assets"),
            openfga_config: OpenfgaConfig {
                url: Url::parse("http://localhost:8091").unwrap(),
                store: self.test_name.clone(),
                max_checks_per_batch_check: DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK,
                max_tuples_per_write: DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE,
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
            directives: vec![],
            span_uploading: SpanUploading::BackgroundBatched,
        };
        let sub = create_tracing_subscriber(
            tracing_config,
            tracing_subscriber::filter::LevelFilter::TRACE,
            NoopSpanExporter::new(),
        );
        let tracing_guard = tracing::subscriber::set_default(sub);

        // Config valkey
        let valkey = cache::Client::new(config.valkey_config.clone(), "TEST_APP").into();

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

        let store_name =
            fga::test_utilities::sanitize_store_name_length(&format!("authz@{}", &self.test_name));
        let fga_connection_settings = fga::client::ConnectionSettings::new(
            Url::parse("http://localhost:8091").unwrap(),
            Limits::default(),
        )
        .reset_store();
        let openfga_authz = block_on(fga::Client::try_new_store(
            &store_name,
            fga_connection_settings.clone(),
        ))
        .expect("Failed creating OpenFGA authorization store");
        if self.enable_authorization {
            let migrations_store_name = fga::test_utilities::sanitize_store_name_length(&format!(
                "migrations@{}",
                self.test_name
            ));
            let openfga_migrations = block_on(fga::Client::try_new_store(
                &migrations_store_name,
                fga_connection_settings,
            ))
            .expect("Failed creating OpenFGA migrations store");
            block_on(fga_migrations::run_migrations(
                openfga_authz.clone(),
                openfga_migrations,
                fga_migrations::TargetMigration::Latest,
            ))
            .expect("OpenFGA authorization model should be updated");
        }
        let driver = PgAuthDriver::new(db_pool_v2.clone());
        let regulator = Regulator::new(openfga_authz.clone(), driver);

        let app_state = AppState {
            db_pool: db_pool_v2.clone(),
            core_client: core_client.clone(),
            osrdyne_client,
            valkey_client: valkey,
            regulator,
            infra_caches,
            map_layers: Arc::new(MapLayers::default()),
            speed_limit_tag_ids,
            health_check_timeout: config.health_check_timeout,
            config: Arc::new(config),
        };

        // Configure the axum router
        let router: Router<()> = axum::Router::<AppState>::new()
            .merge(service_router().router)
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
            test_name: self.test_name,
            server,
            app_state,
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
        $crate::views::test_app::TestAppBuilder::new().test_name(
            stdext::function_name!()
                .split("::")
                .filter(|x| *x != "{{closure}}")
                .collect::<Vec<_>>()
                .join("-"),
        )
    };
}

pub(crate) use test_app;

/// Wraps an underlying, fully configured, axum service
///
/// It also holds a reference to the database connection pool and the core client,
/// which can be accessed through the [TestApp] methods.
pub(crate) struct TestApp {
    test_name: String,
    server: TestServer,
    app_state: AppState,
    #[expect(unused)] // included here to extend its lifetime, not meant to be used in any way
    tracing_guard: tracing::subscriber::DefaultGuard,
}

impl TestApp {
    pub fn name(&self, resource_name: impl std::fmt::Display) -> String {
        format!("{}_{}", self.test_name, resource_name)
    }

    pub fn db_pool(&self) -> Arc<DbConnectionPoolV2> {
        self.app_state.db_pool.clone()
    }

    pub fn valkey_client(&self) -> Arc<cache::Client> {
        self.app_state.valkey_client.clone()
    }

    pub fn speed_limit_tag_ids(&self) -> Arc<SpeedLimitTagIds> {
        self.app_state.speed_limit_tag_ids.clone()
    }

    pub fn config(&self) -> &ServerConfig {
        &self.app_state.config
    }

    pub fn user(&self, identity: impl ToString, name: impl ToString) -> UserBuilder<'_> {
        UserBuilder::new(
            self,
            UserInfo {
                identity: identity.to_string(),
                name: name.to_string(),
            },
        )
    }

    pub fn group(&self, name: impl ToString) -> GroupBuilder<'_> {
        GroupBuilder::new(
            self,
            GroupInfo {
                name: name.to_string(),
            },
        )
    }

    pub async fn fetch(&self, req: TestRequest) -> TestResponse {
        tracing::trace!(request = ?req);
        let response = req.await;
        TestResponse::new(response)
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

    fn authz_subject(&self, subject_id: i64) -> authz::Subject {
        let mut conn = self.app_state.db_pool.get_ok();
        block_on(async move {
            use editoast_models::prelude::*;

            if editoast_models::User::exists(&mut conn, subject_id)
                .await
                .unwrap()
            {
                authz::Subject::User(authz::User(subject_id))
            } else if editoast_models::Group::exists(&mut conn, subject_id)
                .await
                .unwrap()
            {
                authz::Subject::Group(authz::Group(subject_id))
            } else {
                panic!("Subject with ID '{subject_id}' does not exist");
            }
        })
    }

    pub fn infra_grant(&self, infra_id: i64, subject_id: i64) -> Option<InfraGrant> {
        let regulator = &self.app_state.regulator;
        let subject = self.authz_subject(subject_id);
        block_on(regulator.infra_grant(&subject, &authz::Infra(infra_id)))
            .expect("Infra grant should be fetched successfully")
    }

    pub fn infra_direct_grant(&self, infra_id: i64, subject_id: i64) -> Option<InfraGrant> {
        let regulator = &self.app_state.regulator;
        let subject = self.authz_subject(subject_id);
        block_on(regulator.infra_direct_grant(&subject, &authz::Infra(infra_id)))
            .expect("Infra direct grant should be fetched successfully")
    }

    #[track_caller]
    pub fn assert_infra_grant(
        &self,
        infra_id: i64,
        subject_id: i64,
        expected_grant: Option<InfraGrant>,
    ) {
        let actual_grant = self.infra_grant(infra_id, subject_id);
        pretty_assertions::assert_eq!(
            actual_grant,
            expected_grant,
            "Infra grant for subject '{subject_id}' on infra '{infra_id}' does not match"
        );
    }

    #[track_caller]
    pub fn assert_infra_direct_grant(
        &self,
        infra_id: i64,
        subject_id: i64,
        expected_grant: Option<InfraGrant>,
    ) {
        let actual_grant = self.infra_direct_grant(infra_id, subject_id);
        pretty_assertions::assert_eq!(
            actual_grant,
            expected_grant,
            "Infra direct grant for subject '{subject_id}' on infra '{infra_id}' does not match"
        );
    }
}

pub struct UserBuilder<'a> {
    app: &'a TestApp,
    info: UserInfo,
    roles: HashSet<Role>,
    infras_grant: HashMap<i64, InfraGrant>,
}

pub struct GroupBuilder<'a> {
    app: &'a TestApp,
    info: GroupInfo,
    roles: HashSet<Role>,
    members: HashSet<&'a authz::identity::User>,
    infras_grant: HashMap<i64, InfraGrant>,
}

impl<'a> UserBuilder<'a> {
    fn new(app: &'a TestApp, info: UserInfo) -> Self {
        Self {
            app,
            info,
            roles: Default::default(),
            infras_grant: HashMap::default(),
        }
    }

    pub fn with_roles(mut self, roles: impl IntoIterator<Item = Role>) -> Self {
        self.roles = roles.into_iter().collect();
        self
    }

    pub fn with_infra_grant(mut self, infra_id: i64, grant: InfraGrant) -> Self {
        self.infras_grant.insert(infra_id, grant);
        self
    }

    pub async fn create(self) -> authz::identity::User {
        let Self {
            app,
            info,
            roles,
            infras_grant,
        } = self;

        if !roles.is_empty() && !app.app_state.config.enable_authorization {
            panic!(
                "Authorization must be enabled and a model must be provided to grant a user some roles"
            );
        }
        let regulator = &app.app_state.regulator;

        let user = regulator
            .driver()
            .ensure_user(&info.clone())
            .await
            .expect("User should be created successfully");
        if app.app_state.config.enable_authorization {
            regulator
                .grant_user_roles(&authz::User(user.id), roles)
                .await
                .expect("roles should be granted successfully");

            for (infra_id, grant) in infras_grant.into_iter() {
                regulator
                    .give_infra_grant_unchecked(
                        &authz::Subject::User(authz::User(user.id)),
                        &authz::Infra(infra_id),
                        grant,
                    )
                    .await
                    .expect("Infra grant should be given successfully")
            }
        }
        user
    }
}

impl<'a> GroupBuilder<'a> {
    fn new(app: &'a TestApp, info: GroupInfo) -> Self {
        Self {
            app,
            info,
            roles: Default::default(),
            members: Default::default(),
            infras_grant: HashMap::default(),
        }
    }

    #[expect(unused)]
    pub fn with_roles(mut self, roles: impl IntoIterator<Item = Role>) -> Self {
        self.roles = roles.into_iter().collect();
        self
    }

    pub fn with_members(
        mut self,
        members: impl IntoIterator<Item = &'a authz::identity::User>,
    ) -> Self {
        self.members.extend(members);
        self
    }

    pub fn with_infra_grant(mut self, infra_id: i64, grant: InfraGrant) -> Self {
        self.infras_grant.insert(infra_id, grant);
        self
    }

    pub async fn create(self) -> authz::identity::Group {
        let Self {
            app,
            info,
            roles,
            members,
            infras_grant,
        } = self;
        let authz_disabled = !app.app_state.config.enable_authorization;
        if !roles.is_empty() && authz_disabled {
            panic!(
                "Authorization must be enabled and a model must be provided to grant a group some roles"
            );
        }
        let regulator = &app.app_state.regulator;

        let id = regulator
            .driver()
            .ensure_group(&info)
            .await
            .expect("Group should be created successfully");
        let group = authz::identity::Group { id, info };
        if !authz_disabled {
            let group_auth = authz::Group(group.id);
            regulator
                .grant_group_roles(&group_auth, roles)
                .await
                .expect("roles should be granted successfully");

            regulator
                .add_members(
                    &group_auth,
                    members
                        .into_iter()
                        .map(|authz::identity::User { id, .. }| authz::User(*id))
                        .collect(),
                )
                .await
                .expect("members should be added successfully");

            let subject = authz::Subject::Group(group_auth);
            for (infra_id, grant) in infras_grant.into_iter() {
                regulator
                    .give_infra_grant_unchecked(&subject, &authz::Infra(infra_id), grant)
                    .await
                    .expect("Infra grant should be given successfully")
            }
        }
        group
    }
}

pub trait TestRequestExt {
    fn by_user(self, user: &impl AsRef<UserInfo>) -> Self;
}

impl TestRequestExt for TestRequest {
    fn by_user(self, user: &impl AsRef<UserInfo>) -> Self {
        let UserInfo { identity, name } = user.as_ref();
        self.add_header("x-remote-user-identity", identity)
            .add_header("x-remote-user-name", name)
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

    #[track_caller]
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

    #[track_caller]
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

    #[track_caller]
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
    #[track_caller]
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
