//! Exposes [TestApp] and [TestAppBuilder] to ease the setup of the
//! test actix server, database connection pool, and different mocking
//! components.

use std::{ops::Deref, sync::Arc};

use actix_http::Request;
use actix_web::{
    body::BoxBody,
    dev::{Service, ServiceResponse},
    middleware::NormalizePath,
    test::init_service,
    web::{Data, JsonConfig},
    App, Error,
};
use chashmap::CHashMap;

use crate::{
    client::{MapLayersConfig, PostgresConfig, RedisConfig},
    core::CoreClient,
    error::InternalError,
    infra_cache::InfraCache,
    map::MapLayers,
    modelsv2::{database::connection_pool::create_connection_pool, DbConnectionPoolV2},
    RedisClient,
};

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
        }
    }
}

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
}

impl<S> TestApp<S>
where
    S: Service<Request, Response = ServiceResponse<BoxBody>, Error = Error>,
{
    #[allow(dead_code)]
    pub fn core_client(&self) -> Arc<CoreClient> {
        self.core_client.clone()
    }

    #[allow(dead_code)]
    pub fn db_pool(&self) -> Arc<DbConnectionPoolV2> {
        self.db_pool
            .as_ref()
            .expect("no DbConnectionPoolV2 setup")
            .clone()
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

impl<S, Sref> AsRef<Sref> for TestApp<S>
where
    S: Service<Request, Response = ServiceResponse<BoxBody>, Error = Error>,
    S: AsRef<Sref>,
{
    fn as_ref(&self) -> &Sref {
        self.deref().as_ref()
    }
}
