pub mod middlewares;
pub mod router;

use std::env;
use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;
use axum::ServiceExt;
use axum::extract::DefaultBodyLimit;
use axum::extract::FromRef;
use axum_tracing_opentelemetry::middleware::OtelAxumLayer;
use axum_tracing_opentelemetry::middleware::OtelInResponseLayer;
use chrono::Duration;
use core_client::CoreClient;
use core_client::mq_client;
use dashmap::DashMap;
use database::DbConnectionPoolV2;
use editoast_models::PgAuthDriver;
use editoast_models::map::MapLayers;
use fga::client::Limits;
use object_store::aws::AmazonS3;
use object_store::aws::AmazonS3Builder;
use tokio::sync::RwLock;
use tower::Layer as _;
use tower_http::compression::CompressionLayer;
use tower_http::cors::Any;
use tower_http::cors::CorsLayer;
use tower_http::decompression::RequestDecompressionLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::normalize_path::NormalizePath;
use tower_http::normalize_path::NormalizePathLayer;
use tower_http::trace::TraceLayer;
use tracing::Instrument as _;
use tracing::info;
use tracing::warn;
use url::Url;

use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::infra_cache::InfraCache;
use crate::views::service_router;
use crate::views::timetable;

#[derive(Clone)]
pub struct CoreConfig {
    pub timeout: Duration,
    pub single_worker: bool,
    pub num_channels: usize,
    pub worker_pool_id: String,
}

pub struct OsrdyneConfig {
    pub mq_url: Url,
    pub core: CoreConfig,
}

#[derive(Clone)]
pub struct OpenfgaConfig {
    pub url: Url,
    pub store: String,
    pub max_checks_per_batch_check: u32,
    pub max_tuples_per_write: u64,
}

#[derive(Clone)]
pub struct PostgresConfig {
    pub database_url: Url,
    pub pool_size: usize,
}

pub struct S3Config {
    pub endpoint: Url,
    pub bucket_name: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub region: Option<String>,
}

pub struct ServerConfig {
    pub port: u16,
    pub address: String,
    pub health_check_timeout: Duration,
    pub map_layers_max_zoom: u8,
    pub enable_authorization: bool,
    pub postgres_config: PostgresConfig,
    pub osrdyne_config: OsrdyneConfig,
    pub valkey_config: cache::Config,
    pub openfga_config: OpenfgaConfig,
    pub root_url: Url,
    pub dynamic_assets_path: PathBuf,
    pub app_version: Option<String>,
    pub s3_config: Option<S3Config>,
    pub trains_traffic: Arc<RwLock<timetable::similar_trains::trains_traffic::TrainsTrafficPool>>,
}

pub struct Server {
    app_state: AppState,
    router: NormalizePath<Router>,
}

pub type Regulator = ::authz::Regulator<PgAuthDriver>;

/// The state of the whole Editoast service, available to all handlers
///
/// If only the database is needed, use `State<database::DbConnectionPoolV2>`.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<ServerConfig>,
    pub db_pool: Arc<DbConnectionPoolV2>,
    pub valkey_client: Arc<cache::Client>,
    pub infra_caches: Arc<DashMap<i64, InfraCache>>,
    pub map_layers: Arc<MapLayers>,
    pub speed_limit_tag_ids: Arc<SpeedLimitTagIds>,
    pub core_client: Arc<CoreClient>,
    pub health_check_timeout: Duration,
    pub regulator: Regulator,
    pub trains_traffic: Arc<RwLock<timetable::similar_trains::trains_traffic::TrainsTrafficPool>>,
    pub s3_client: Option<Arc<AmazonS3>>,
}

impl FromRef<AppState> for Arc<DbConnectionPoolV2> {
    fn from_ref(input: &AppState) -> Self {
        input.db_pool.clone()
    }
}

impl FromRef<AppState> for Arc<SpeedLimitTagIds> {
    fn from_ref(input: &AppState) -> Self {
        input.speed_limit_tag_ids.clone()
    }
}

impl FromRef<AppState> for Arc<CoreClient> {
    fn from_ref(input: &AppState) -> Self {
        input.core_client.clone()
    }
}

impl AppState {
    #[tracing::instrument(skip_all, level = "info", err, name = "AppState initialization")]
    async fn init(config: ServerConfig) -> anyhow::Result<Self> {
        #[tracing::instrument(skip_all, level = "info", err, name = "PostgreSQL connection")]
        async fn connect_db(
            PostgresConfig {
                database_url,
                pool_size,
            }: PostgresConfig,
        ) -> anyhow::Result<Arc<DbConnectionPoolV2>> {
            let pool = DbConnectionPoolV2::try_initialize(database_url, pool_size).await?;
            Ok(Arc::new(pool))
        }
        let db_pool_fut =
            tokio::spawn(connect_db(config.postgres_config.clone()).in_current_span());

        #[tracing::instrument(skip_all, level = "info", err, name = "Core client connection")]
        async fn connect_core_client(
            CoreConfig {
                timeout,
                single_worker,
                num_channels,
                worker_pool_id,
            }: CoreConfig,
            mq_url: Url,
        ) -> anyhow::Result<Arc<CoreClient>> {
            let options = mq_client::Options {
                uri: mq_url,
                worker_pool_identifier: worker_pool_id,
                timeout: timeout.num_seconds() as u64,
                single_worker,
                num_channels,
            };
            let client = CoreClient::new_mq(options).await?;
            Ok(Arc::new(client))
        }
        let core_client_fut = tokio::spawn(
            connect_core_client(
                config.osrdyne_config.core.clone(),
                config.osrdyne_config.mq_url.clone(),
            )
            .in_current_span(),
        );

        #[tracing::instrument(skip_all, level = "info", err, name = "OpenFGA connection")]
        async fn connect_openfga(openfga_config: OpenfgaConfig) -> anyhow::Result<fga::Client> {
            let openfga = {
                tracing::info!(url = %openfga_config.url, "connecting to OpenFGA");
                match fga::Client::try_with_store(
                    &openfga_config.store,
                    openfga_config.as_settings(),
                )
                .await
                {
                    Err(fga::client::InitializationError::NotFound(store)) => {
                        tracing::info!(store, "store not found, creating it");
                        fga::Client::try_new_store(&store, openfga_config.as_settings()).await?
                    }
                    result => result?,
                }
            };
            tracing::info!(url = %openfga_config.url, "connected to OpenFGA");
            Ok(openfga)
        }
        let openfga_fut =
            tokio::spawn(connect_openfga(config.openfga_config.clone()).in_current_span());

        // Synchronous operations
        let infra_caches = DashMap::<i64, InfraCache>::default().into();
        let speed_limit_tag_ids = Arc::new(SpeedLimitTagIds::load());
        let valkey_client = Arc::new(cache::Client::new(
            config.valkey_config.clone(),
            config.app_version.as_deref().unwrap_or("NO_APP_VERSION"),
        ));

        let s3_client = build_s3_client(&config.s3_config);

        let (db_pool, core_client, openfga) = tokio::try_join!(
            async { db_pool_fut.await? },
            async { core_client_fut.await? },
            async { openfga_fut.await? },
        )?;

        Ok(Self {
            regulator: Regulator::new(openfga, PgAuthDriver::new(db_pool.clone())),
            valkey_client,
            db_pool,
            infra_caches,
            core_client,
            map_layers: Arc::new(MapLayers::default()),
            speed_limit_tag_ids,
            health_check_timeout: config.health_check_timeout,
            trains_traffic: config.trains_traffic.clone(),
            s3_client,
            config: Arc::new(config),
        })
    }
}

fn build_s3_client(optional_config: &Option<S3Config>) -> Option<Arc<AmazonS3>> {
    let config = optional_config.as_ref()?;
    let bucket = config.bucket_name.clone();
    let mut builder = AmazonS3Builder::new()
        .with_bucket_name(bucket)
        .with_virtual_hosted_style_request(false)
        .with_allow_http(true)
        .with_endpoint(config.endpoint.as_str())
        .with_access_key_id(config.access_key_id.clone())
        .with_secret_access_key(config.secret_access_key.clone());
    if let Some(region) = &config.region {
        builder = builder.with_region(region)
    }
    match builder.build() {
        Ok(client) => Some(Arc::new(client)),
        Err(e) => {
            warn!("Failed to build S3 client: {e}");
            None
        }
    }
}

impl Server {
    #[tracing::instrument(skip_all, err, level = "info", name = "server initialization")]
    pub async fn new(config: ServerConfig) -> anyhow::Result<Self> {
        info!("Building server...");
        let app_state_fut = tokio::spawn(AppState::init(config).in_current_span());
        let router =
            tracing::debug_span!("router initialization").in_scope(|| service_router().router);
        let app_state = app_state_fut.await??;

        // Custom Bytes and String extractor configuration
        let request_payload_limit = RequestBodyLimitLayer::new(250 * 1024 * 1024); // 250MiB

        // Build CORS layer
        let cors = {
            let allowed_origin = env::var("OSRD_ALLOWED_ORIGIN").ok();
            match allowed_origin {
                Some(origin) => CorsLayer::new()
                    .allow_methods(Any)
                    .allow_headers(Any)
                    .allow_origin(
                        origin
                            .parse::<axum::http::header::HeaderValue>()
                            .expect("invalid allowed origin"),
                    ),
                None => CorsLayer::new()
                    .allow_methods(Any)
                    .allow_headers(Any)
                    .allow_origin(Any),
            }
        };

        // Configure the axum router
        let router: Router<()> = axum::Router::<AppState>::new()
            .merge(router)
            .route_layer(axum::middleware::from_fn_with_state(
                app_state.clone(),
                middlewares::authentication_middleware,
            ))
            .route_layer(axum::middleware::from_fn_with_state(
                app_state.clone(),
                middlewares::authentication_validation_middleware,
            ))
            .route_layer(axum::middleware::from_fn_with_state(
                app_state.clone(),
                middlewares::authentication_extraction_middleware,
            ))
            .layer(OtelInResponseLayer)
            .layer(OtelAxumLayer::default())
            .layer(RequestDecompressionLayer::new())
            .layer(CompressionLayer::new())
            .layer(DefaultBodyLimit::disable())
            .layer(request_payload_limit)
            .layer(cors)
            .layer(TraceLayer::new_for_http())
            .with_state(app_state.clone());
        let normalizing_router = NormalizePathLayer::trim_trailing_slash().layer(router);

        Ok(Self {
            app_state,
            router: normalizing_router,
        })
    }

    pub async fn start(self) -> std::io::Result<()> {
        let Self { app_state, router } = self;
        let ServerConfig {
            address,
            port,
            enable_authorization,
            ..
        } = app_state.config.as_ref();

        if !*enable_authorization {
            warn!("authorization disabled — all role and permission checks are bypassed");
        }

        info!("Running server...");
        let service = ServiceExt::<axum::extract::Request>::into_make_service(router);
        let listener = tokio::net::TcpListener::bind((address.as_str(), *port)).await?;
        axum::serve(listener, service).await
    }
}

impl OpenfgaConfig {
    pub fn as_settings(&self) -> fga::client::ConnectionSettings {
        fga::client::ConnectionSettings::new(
            self.url.clone(),
            Limits {
                max_checks_per_batch_check: self.max_checks_per_batch_check,
                max_tuples_per_write: self.max_tuples_per_write,
            },
        )
    }
}
