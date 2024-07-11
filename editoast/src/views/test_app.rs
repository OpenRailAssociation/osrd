//! Exposes [TestApp] and [TestAppBuilder] to ease the setup of the
//! test actix server, database connection pool, and different mocking
//! components.

use std::{ops::Deref, sync::Arc};

use actix_http::Request;
use actix_web::{
    body::{BoxBody, MessageBody},
    dev::{Service, ServiceResponse},
    middleware::NormalizePath,
    test::init_service,
    web::{Data, JsonConfig},
    App, Error,
};
use chashmap::CHashMap;
use editoast_models::db_connection_pool::create_connection_pool;
use editoast_models::DbConnectionPoolV2;
use serde::de::DeserializeOwned;
use tracing::Instrument as _;

use crate::{
    client::{MapLayersConfig, PostgresConfig, RedisConfig},
    core::CoreClient,
    error::InternalError,
    infra_cache::InfraCache,
    map::MapLayers,
    RedisClient,
};

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
    db_pool_v1: bool,
}

impl TestAppBuilder {
    pub fn new() -> Self {
        Self {
            db_pool: None,
            core_client: None,
            db_pool_v1: false,
        }
    }

    pub fn db_pool(mut self, db_pool: DbConnectionPoolV2) -> Self {
        assert!(self.db_pool.is_none());
        assert!(!self.db_pool_v1);
        self.db_pool = Some(db_pool);
        self
    }

    /// For migration purposes, it will be removed when all tests use the V2 version.
    pub fn db_pool_v1(mut self) -> Self {
        assert!(self.db_pool.is_none());
        self.db_pool_v1 = true;
        self
    }

    pub fn core_client(mut self, core_client: CoreClient) -> Self {
        assert!(self.core_client.is_none());
        self.core_client = Some(core_client);
        self
    }

    pub fn default_app(
    ) -> TestApp<impl Service<Request, Response = ServiceResponse<BoxBody>, Error = Error>> {
        let pool = DbConnectionPoolV2::for_tests();
        let core_client = CoreClient::default();
        TestAppBuilder::new()
            .db_pool(pool)
            .core_client(core_client)
            .build()
    }

    pub fn build(
        self,
    ) -> TestApp<impl Service<Request, Response = ServiceResponse<BoxBody>, Error = Error>> {
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

        let json_cfg = JsonConfig::default()
            .limit(250 * 1024 * 1024) // 250MB
            .error_handler(|err, _| InternalError::from(err).into());

        let redis = RedisClient::new(RedisConfig::default()).expect("cannot get redis client");

        let core_client = Data::new(self.core_client.expect(
            "No core client provided to TestAppBuilder, use Default or provide a core client",
        ));
        let ref_core_client = core_client.clone().into_inner();

        let mut app = App::new()
            .wrap(NormalizePath::trim())
            .app_data(json_cfg)
            .app_data(Data::new(redis))
            .app_data(Data::new(CHashMap::<i64, InfraCache>::default()))
            .app_data(Data::new(MapLayers::parse()))
            .app_data(Data::new(MapLayersConfig::default()))
            .app_data(core_client);

        let ref_db_pool = if self.db_pool_v1 {
            let config = PostgresConfig::default();
            let pg_config_url = config.url().expect("cannot get postgres config url");
            let pool = create_connection_pool(pg_config_url, config.pool_size)
                .expect("could not create connection pool for tests");
            app = app.app_data(Data::new(pool));
            None
        } else {
            let pool = self.db_pool.expect("No database connection pool provided to TestAppBuilder, use Default or provide a connection pool");
            let pool = Data::new(pool);
            let ref_db_pool = pool.clone().into_inner();
            app = app.app_data(pool);
            Some(ref_db_pool)
        };

        let service =
            futures::executor::block_on(init_service(app.service(crate::views::routes())));
        TestApp {
            service,
            db_pool: ref_db_pool,
            core_client: ref_core_client,
            tracing_guard,
        }
    }
}

/// Wraps an underlying, fully configured, actix service
///
/// It also holds a reference to the database connection pool and the core client,
/// which can be accessed through the [TestApp] methods.
pub(crate) struct TestApp<S>
where
    S: Service<Request, Response = ServiceResponse<BoxBody>, Error = Error>,
{
    pub(crate) service: S,
    /// A reference to the database connection pool
    ///
    /// The Option<> lasts while the pool V1 is still around.
    db_pool: Option<Arc<DbConnectionPoolV2>>,
    core_client: Arc<CoreClient>,
    #[allow(unused)] // included here to extend its lifetime, not meant to be used in any way
    tracing_guard: tracing::subscriber::DefaultGuard,
}

impl<S> TestApp<S>
where
    S: Service<Request, Response = ServiceResponse<BoxBody>, Error = Error>,
{
    #[allow(dead_code)] // while the pool migration is ongoing
    pub fn core_client(&self) -> Arc<CoreClient> {
        self.core_client.clone()
    }

    pub fn db_pool(&self) -> Arc<DbConnectionPoolV2> {
        self.db_pool
            .as_ref()
            .expect("no DbConnectionPoolV2 setup")
            .clone()
    }

    pub fn fetch(&self, req: Request) -> TestResponse {
        let (method, uri) = (req.method().clone(), req.uri().clone());
        let span = tracing::debug_span!("Request", %method, %uri);
        futures::executor::block_on(
            async move {
                tracing::trace!(request = ?req);
                let response = self.service.call(req).await.unwrap_or_else(|err| {
                    tracing::error!(error = ?err, "Error fetching test request");
                    panic!("could not fetch test request");
                });
                TestResponse::new(response)
            }
            .instrument(span),
        )
    }
}

impl<S> Deref for TestApp<S>
where
    S: Service<Request, Response = ServiceResponse<BoxBody>, Error = Error>,
{
    type Target = S;

    fn deref(&self) -> &Self::Target {
        &self.service
    }
}

impl<S> AsRef<S> for TestApp<S>
where
    S: Service<Request, Response = ServiceResponse<BoxBody>, Error = Error>,
{
    fn as_ref(&self) -> &S {
        &self.service
    }
}

pub struct TestResponse {
    inner: ServiceResponse<BoxBody>,
    log_payload: bool,
}

impl TestResponse {
    #[tracing::instrument(name = "Response", level = "debug", skip(inner), fields(status = ?inner.status()))]
    fn new(inner: ServiceResponse<BoxBody>) -> Self {
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
        self.inner
            .into_body()
            .try_into_bytes()
            .ok()
            .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
            .and_then(|json| serde_json::to_string_pretty(&json).ok())
            .unwrap_or_else(|| "cannot render response body".to_string())
    }

    pub fn assert_status(self, expected_status: actix_http::StatusCode) -> Self {
        let actual_status = self.inner.status();
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
        self.inner
            .into_body()
            .try_into_bytes()
            .expect("cannot extract body out of test response")
            .into()
    }

    #[tracing::instrument(
        name = "Deserialization",
        level = "debug",
        skip(self),
        fields(response_status = ?self.inner.status())
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
