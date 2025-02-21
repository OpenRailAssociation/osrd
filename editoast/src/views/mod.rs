mod authz;
mod documents;
pub mod electrical_profiles;
pub mod fonts;
pub mod infra;
mod layers;
mod openapi;
pub mod operational_studies;
pub mod paced_train;
pub mod pagination;
pub mod params;
pub mod path;
pub mod projection;
pub mod projects;
pub mod rolling_stock;
pub mod scenario;
pub mod search;
pub mod speed_limit_tags;
pub mod sprites;
pub mod stdcm_logs;
pub mod stdcm_search_environment;
pub mod study;
pub mod temporary_speed_limits;
pub mod timetable;
pub mod train_schedule;
pub mod work_schedules;

#[cfg(test)]
mod test_app;

use ::core::str;
use std::collections::HashSet;
use std::env;
use std::sync::Arc;

use axum::extract::DefaultBodyLimit;
use axum::extract::FromRef;
use axum::extract::Request;
use axum::middleware::Next;
use axum::response::Response;
use axum::Router;
use axum::ServiceExt;
use axum_tracing_opentelemetry::middleware::OtelAxumLayer;
use chrono::Duration;
use dashmap::DashMap;
use editoast_authz::authorizer::Authorizer;
use editoast_authz::authorizer::UserInfo;
use editoast_authz::BuiltinRole;

use editoast_osrdyne_client::OsrdyneClient;
use futures::TryFutureExt;
pub use openapi::OpenApiRoot;

use axum::extract::Json;
use axum::extract::State;
use editoast_derive::EditoastError;
use editoast_models::db_connection_pool::ping_database;
use editoast_models::DbConnectionPoolV2;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
use tokio::time::timeout;
use tower::Layer as _;
use tower_http::cors::Any;
use tower_http::cors::CorsLayer;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::normalize_path::NormalizePath;
use tower_http::normalize_path::NormalizePathLayer;
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing::warn;
use url::Url;
use utoipa::IntoParams;
use utoipa::ToSchema;

use crate::client::get_app_version;
use crate::core::mq_client;
use crate::core::pathfinding::PathfindingInputError;
use crate::core::pathfinding::PathfindingNotFound;
use crate::core::version::CoreVersionRequest;
use crate::core::AsCoreRequest;
use crate::core::CoreClient;
use crate::core::CoreError;
use crate::core::{self};
use crate::error::InternalError;
use crate::error::Result;
use crate::error::{self};
use crate::generated_data;
use crate::generated_data::speed_limit_tags_config::SpeedLimitTagIds;
use crate::infra_cache::operation;
use crate::infra_cache::InfraCache;
use crate::map::MapLayers;
use crate::models;
use crate::models::auth::PgAuthDriver;
use crate::valkey_utils::ValkeyConfig;
use crate::ValkeyClient;

crate::routes! {
    fn router();
    fn openapi_paths();

    "/health" => health,
    "/version" => version,
    "/version/core" => core_version,

    &authz,
    &documents,
    &electrical_profiles,
    &fonts,
    &infra,
    &layers,
    &paced_train,
    &projects,
    &rolling_stock,
    &search,
    &speed_limit_tags,
    &sprites,
    &stdcm_search_environment,
    &work_schedules,
    &temporary_speed_limits,
    &train_schedule,
    &timetable,
    &path,
    &stdcm_logs,
    &scenario,
}

editoast_common::schemas! {
    Version,
    SimulationSummaryResult,
    InfraIdQueryParam,

    editoast_common::schemas(),
    editoast_schemas::schemas(),
    models::schemas(),
    core::schemas(),
    generated_data::schemas(),

    authz::schemas(),
    documents::schemas(),
    electrical_profiles::schemas(),
    error::schemas(),
    infra::schemas(),
    operation::schemas(),
    operational_studies::schemas(),
    paced_train::schemas(),
    pagination::schemas(),
    path::schemas(),
    projects::schemas(),
    projection::schemas(),
    rolling_stock::schemas(),
    scenario::schemas(),
    scenario::macro_nodes::schemas(),
    search::schemas(),
    stdcm_search_environment::schemas(),
    train_schedule::schemas(),
    timetable::schemas(),
    work_schedules::schemas(),
    stdcm_logs::schemas(),
}

#[derive(Debug, Deserialize, ToSchema)]
struct ListId {
    ids: HashSet<i64>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub struct InfraIdQueryParam {
    infra_id: i64,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(tag = "status", rename_all = "snake_case")]
enum SimulationSummaryResult {
    /// Minimal information on a simulation's result
    Success {
        /// Length of a path in mm
        length: u64,
        /// Travel time in ms
        time: u64,
        /// Total energy consumption of a train in kWh
        energy_consumption: f64,
        /// Final simulation time for each train schedule path item.
        /// The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path)
        path_item_times_final: Vec<u64>,
        /// Provisional simulation time for each train schedule path item.
        /// The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path)
        path_item_times_provisional: Vec<u64>,
        /// Base simulation time for each train schedule path item.
        /// The first value is always `0` (beginning of the path) and the last one, the total time of the simulation (end of the path)
        path_item_times_base: Vec<u64>,
    },
    /// Pathfinding not found
    PathfindingNotFound(PathfindingNotFound),
    /// An error has occurred during pathfinding
    PathfindingFailure { core_error: InternalError },
    /// An error has occurred during computing
    SimulationFailed { error_type: String },
    /// InputError
    PathfindingInputError(PathfindingInputError),
}

/// Represents the bundle of information about the issuer of a request
/// that can be extracted form recognized headers.
#[derive(Debug, Clone)]
pub enum Authentication {
    /// The issuer of the request did not provide any authentication information.
    Unauthenticated,
    /// The issuer of the request provided the 'x-remote-user-identity' header.
    Authenticated(Authorizer<PgAuthDriver<BuiltinRole>>),
    /// The requests comes from a trusted service (like core). All requests are considered safe.
    SkipAuthorization,
}

impl Authentication {
    /// Checks if the issuer of the request has the required roles. Always returns `false` if the
    /// request is unauthenticated.
    pub async fn check_roles(
        &self,
        required_roles: HashSet<BuiltinRole>,
    ) -> Result<bool, <PgAuthDriver<BuiltinRole> as editoast_authz::authorizer::StorageDriver>::Error>
    {
        match self {
            Authentication::SkipAuthorization => Ok(true),
            Authentication::Unauthenticated => Ok(false),
            Authentication::Authenticated(authorizer) => {
                authorizer.check_roles(required_roles).await
            }
        }
    }

    /// Returns the underlying authorizer if the request is authenticated, otherwise returns an
    /// error. If the request comes from Core, this returns false as well as it makes no sense to
    /// have an Authorizer without an authenticated user.
    pub fn authorizer(self) -> Result<Authorizer<PgAuthDriver<BuiltinRole>>, AuthorizationError> {
        match self {
            Authentication::Authenticated(authorizer) => Ok(authorizer),
            Authentication::Unauthenticated | Authentication::SkipAuthorization => {
                Err(AuthorizationError::Unauthorized)
            }
        }
    }
}

pub type AuthenticationExt = axum::extract::Extension<Authentication>;

async fn authenticate(
    enable_authorization: bool,
    headers: &axum::http::HeaderMap,
    db_pool: Arc<DbConnectionPoolV2>,
) -> Result<Authentication, AuthorizationError> {
    if !enable_authorization {
        return Ok(Authentication::Authenticated(Authorizer::new_superuser(
            PgAuthDriver::<BuiltinRole>::new(db_pool),
        )));
    }
    let Some(identity) = headers.get("x-remote-user-identity") else {
        if headers.contains_key("x-osrd-skip-authz") {
            return Ok(Authentication::SkipAuthorization);
        }
        return Ok(Authentication::Unauthenticated);
    };
    let identity = str::from_utf8(identity.as_bytes())
        .expect("unexpected non-utf8 characters in x-remote-user-identity");

    let name = match headers.get("x-remote-user-name") {
        Some(name) => str::from_utf8(name.as_bytes())
            .expect("unexpected non-utf8 characters in x-remote-user-name"),
        None => "",
    };

    let authorizer = Authorizer::try_initialize(
        UserInfo {
            identity: identity.to_owned(),
            name: name.to_owned(),
        },
        PgAuthDriver::<BuiltinRole>::new(db_pool),
    )
    .await?;
    Ok(Authentication::Authenticated(authorizer))
}

async fn authentication_middleware(
    State(AppState {
        db_pool, config, ..
    }): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response> {
    let headers = req.headers();
    let authorizer = authenticate(config.enable_authorization, headers, db_pool).await?;
    req.extensions_mut().insert(authorizer);
    Ok(next.run(req).await)
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "authz")]
pub enum AuthorizationError {
    #[error("Unauthorized — user must be authenticated")]
    #[editoast_error(status = 401)]
    Unauthorized,
    #[error("Forbidden — user has insufficient privileges")]
    #[editoast_error(status = 403)]
    Forbidden,
    #[error(transparent)]
    #[editoast_error(status = 500)]
    AuthError(
        #[from] <PgAuthDriver<BuiltinRole> as editoast_authz::authorizer::StorageDriver>::Error,
    ),
    #[error(transparent)]
    #[editoast_error(status = 500)]
    DbError(#[from] editoast_models::db_connection_pool::DatabasePoolError),
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "app_health")]
pub enum AppHealthError {
    #[error("Timeout error")]
    Timeout,
    #[error(transparent)]
    Database(#[from] editoast_models::db_connection_pool::PingError),
    #[error(transparent)]
    Valkey(anyhow::Error),
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error(transparent)]
    Openfga(anyhow::Error),
}

#[utoipa::path(
    get, path = "",
    responses(
        (status = 200, description = "Check if Editoast is running correctly", body = String)
    )
)]
async fn health(
    State(AppState {
        db_pool,
        valkey,
        health_check_timeout,
        core_client,
        openfga,
        ..
    }): State<AppState>,
) -> Result<&'static str> {
    timeout(
        health_check_timeout
            .to_std()
            .expect("timeout should be valid at this point"),
        check_health(db_pool, valkey, core_client, openfga),
    )
    .await
    .map_err(|_| AppHealthError::Timeout)??;
    Ok("ok")
}

pub async fn check_health(
    db_pool: Arc<DbConnectionPoolV2>,
    valkey_client: Arc<ValkeyClient>,
    core_client: Arc<CoreClient>,
    openfga: fga::Client,
) -> Result<()> {
    let mut db_connection = db_pool.clone().get().await?;
    let openfga_ping = async move {
        openfga
            .is_healthy()
            .await
            .map_err(|err| {
                AppHealthError::Openfga(anyhow::anyhow!("OpenFGA health request failure: {err}"))
            })
            .and_then(|healthy| {
                if !healthy {
                    Err(AppHealthError::Openfga(anyhow::anyhow!(
                        "OpenFGA is not healthy"
                    )))
                } else {
                    Ok(())
                }
            })
    };
    tokio::try_join!(
        ping_database(&mut db_connection).map_err(AppHealthError::Database),
        valkey_client.ping_valkey().map_err(AppHealthError::Valkey),
        core_client.ping().map_err(AppHealthError::Core),
        openfga_ping
    )?;
    Ok(())
}

#[derive(ToSchema, Serialize, Deserialize)]
pub struct Version {
    #[schema(required)] // Options are by default not required, but this one is
    git_describe: Option<String>,
}

#[utoipa::path(
    get, path = "",
    responses(
        (status = 200, description = "Return the service version", body = Version),
    ),
)]
async fn version() -> Json<Version> {
    Json(Version {
        git_describe: get_app_version(),
    })
}

#[utoipa::path(
    get, path = "",
    responses(
        (status = 200, description = "Return the core service version", body = Version),
    ),
)]
async fn core_version(State(core): State<Arc<CoreClient>>) -> Json<Version> {
    let response = CoreVersionRequest {}.fetch(&core).await;
    let response = response.unwrap_or(Version { git_describe: None });
    Json(response)
}

#[derive(Clone)]
pub struct CoreConfig {
    pub timeout: Duration,
    pub single_worker: bool,
    pub num_channels: usize,
}

pub struct OsrdyneConfig {
    pub mq_url: Url,
    pub osrdyne_api_url: Url,
    pub core: CoreConfig,
}

pub struct OpenfgaConfig {
    pub url: Url,
    pub store: String,
}

#[derive(Clone)]
pub struct PostgresConfig {
    pub database_url: Url,
    pub pool_size: usize,
}

pub struct ServerConfig {
    pub port: u16,
    pub address: String,
    pub health_check_timeout: Duration,
    pub map_layers_max_zoom: u8,
    pub enable_authorization: bool,
    pub enable_stdcm_logging: bool,
    pub postgres_config: PostgresConfig,
    pub osrdyne_config: OsrdyneConfig,
    pub valkey_config: ValkeyConfig,
    pub openfga_config: OpenfgaConfig,
}

pub struct Server {
    app_state: AppState,
    router: NormalizePath<Router>,
}

/// The state of the whole Editoast service, available to all handlers
///
/// If only the database is needed, use `State<editoast_models::DbConnectionPoolV2>`.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<ServerConfig>,
    pub db_pool: Arc<DbConnectionPoolV2>,
    pub valkey: Arc<ValkeyClient>,
    pub infra_caches: Arc<DashMap<i64, InfraCache>>,
    pub map_layers: Arc<MapLayers>,
    pub speed_limit_tag_ids: Arc<SpeedLimitTagIds>,
    pub core_client: Arc<CoreClient>,
    pub osrdyne_client: Arc<OsrdyneClient>,
    pub health_check_timeout: Duration,
    pub openfga: fga::Client,
}

impl FromRef<AppState> for DbConnectionPoolV2 {
    fn from_ref(input: &AppState) -> Self {
        (*input.db_pool).clone()
    }
}

impl FromRef<AppState> for Arc<CoreClient> {
    fn from_ref(input: &AppState) -> Self {
        input.core_client.clone()
    }
}

impl AppState {
    async fn init(config: ServerConfig) -> anyhow::Result<Self> {
        info!("Building application state...");

        // Config database
        let valkey = ValkeyClient::new(config.valkey_config.clone())?.into();

        // Create database pool
        let db_pool = {
            let PostgresConfig {
                database_url,
                pool_size,
            } = config.postgres_config.clone();
            let pool = DbConnectionPoolV2::try_initialize(database_url, pool_size).await?;
            Arc::new(pool)
        };

        // Setup infra cache map
        let infra_caches = DashMap::<i64, InfraCache>::default().into();

        // Static list of configured speed-limit tag ids
        let speed_limit_tag_ids = Arc::new(SpeedLimitTagIds::load());

        // Build Core client
        let core_client = {
            let CoreConfig {
                timeout,
                single_worker,
                num_channels,
            } = config.osrdyne_config.core.clone();
            let options = mq_client::Options {
                uri: config.osrdyne_config.mq_url.clone(),
                worker_pool_identifier: "core".to_owned(),
                timeout: timeout.num_seconds() as u64,
                single_worker,
                num_channels,
            };
            CoreClient::new_mq(options).await?.into()
        };

        let osrdyne_client = Arc::new(OsrdyneClient::new(
            config.osrdyne_config.osrdyne_api_url.clone(),
        ));

        let openfga = {
            tracing::info!(url = %config.openfga_config.url, "connecting to OpenFGA");
            match fga::Client::try_with_store(
                config.openfga_config.store.clone(),
                config.openfga_config.try_as_settings()?,
            )
            .await
            {
                Err(fga::client::InitializationError::NotFound(store)) => {
                    tracing::info!(store, "store not found, creating it");
                    fga::Client::try_new_store(store, config.openfga_config.try_as_settings()?)
                        .await?
                }
                result => result?,
            }
        };
        tracing::info!(url = %config.openfga_config.url, "connected to OpenFGA");

        Ok(Self {
            valkey,
            db_pool,
            infra_caches,
            core_client,
            osrdyne_client,
            openfga,
            map_layers: Arc::new(MapLayers::default()),
            speed_limit_tag_ids,
            health_check_timeout: config.health_check_timeout,
            config: Arc::new(config),
        })
    }
}

impl Server {
    pub async fn new(config: ServerConfig) -> anyhow::Result<Self> {
        info!("Building server...");
        let app_state = AppState::init(config).await?;

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
            .merge(router())
            .route_layer(axum::middleware::from_fn_with_state(
                app_state.clone(),
                authentication_middleware,
            ))
            .layer(OtelAxumLayer::default())
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
    pub fn try_as_settings(&self) -> anyhow::Result<fga::client::ConnectionSettings> {
        let address = self
            .url
            .host_str()
            .ok_or_else(|| anyhow::anyhow!("Configured OpenFGA URL doesn't have a host part"))?;
        let port = self
            .url
            .port()
            .ok_or_else(|| anyhow::anyhow!("Configured OpenFGA URL doesn't have a port part"))?;
        Ok(fga::client::ConnectionSettings::new(
            address.to_owned(),
            port,
        ))
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use axum::http::StatusCode;
    use editoast_models::DbConnectionPoolV2;
    use rstest::rstest;
    use serde_json::json;

    use super::test_app::TestAppBuilder;
    use crate::core::mocking::MockingClient;

    #[rstest]
    async fn health() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/health");
        app.fetch(request).assert_status(StatusCode::OK);
    }

    #[rstest]
    async fn version() {
        let app = TestAppBuilder::default_app();
        let request = app.get("/version");
        let response: HashMap<String, Option<String>> = app.fetch(request).json_into();
        assert!(response.contains_key("git_describe"));
    }

    #[rstest]
    async fn core_version() {
        let mut core = MockingClient::new();
        core.stub("/version")
            .method(reqwest::Method::POST)
            .response(StatusCode::OK)
            .json(json!({"git_describe": ""}))
            .finish();
        let app = TestAppBuilder::new()
            .core_client(core.into())
            .db_pool(DbConnectionPoolV2::for_tests())
            .build();
        let request = app.get("/version/core");
        let response: HashMap<String, Option<String>> = app.fetch(request).json_into();
        assert!(response.contains_key("git_describe"));
    }
}
