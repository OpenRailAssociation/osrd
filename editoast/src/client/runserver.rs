use std::path::PathBuf;
use std::sync::Arc;

use chrono::Duration;
use clap::Args;
use tokio::sync::RwLock;
use tracing::Instrument;
use url::Url;

use crate::client::trains_traffic;
use crate::views;
use crate::views::timetable::similar_trains::trains_traffic::TrainsTrafficPool;

use super::PostgresConfig;
use super::ValkeyConfig;
use super::openfga_config::OpenfgaConfig;

#[derive(Args, Debug, Clone)]
struct MapLayersConfig {
    #[arg(long, env, default_value_t = 18)]
    max_zoom: u64,
}

#[derive(Args, Debug)]
pub struct CoreArgs {
    #[clap(long, env = "OSRD_MQ_URL", default_value_t = Url::parse("amqp://osrd:password@127.0.0.1:5672/%2f").unwrap())]
    pub(super) mq_url: Url,
    #[clap(long, env = "EDITOAST_CORE_TIMEOUT", default_value_t = 180)]
    pub(super) core_timeout: u64,
    #[clap(long, env = "EDITOAST_CORE_SINGLE_WORKER", default_value_t = false)]
    pub(super) core_single_worker: bool,
    #[clap(long, env = "CORE_CLIENT_CHANNELS_SIZE", default_value_t = 8)]
    pub(super) core_client_channels_size: usize,
    #[clap(long, env = "EDITOAST_CORE_WORKER_POOL_ID", default_value_t = String::from("core"))]
    pub(super) worker_pool_id: String,
}

#[derive(Args, Debug)]
pub struct S3Args {
    #[clap(long, env = "AWS_ENDPOINT_URL_S3")]
    pub endpoint: Option<Url>,
    #[clap(long, env = "AWS_BUCKET_NAME")]
    pub bucket_name: Option<String>,
    #[clap(long, env = "AWS_ACCESS_KEY_ID")]
    pub access_key_id: Option<String>,
    #[clap(long, env = "AWS_SECRET_ACCESS_KEY")]
    pub secret_access_key: Option<String>,
}

#[derive(Args, Debug)]
#[command(about, long_about = "Launch the server")]
pub struct RunserverArgs {
    #[clap(long, env = "ROOT_URL", default_value_t = Url::parse("http://localhost:8090").unwrap())]
    root_url: Url,
    #[clap(long, env = "DYNAMIC_ASSETS_PATH", default_value = "./assets")]
    dynamic_assets_path: PathBuf,
    #[command(flatten)]
    map_layers_config: MapLayersConfig,
    #[arg(long, env = "EDITOAST_PORT", default_value_t = 8090)]
    port: u16,
    #[arg(long, env = "EDITOAST_ADDRESS", default_value_t = String::from("0.0.0.0"))]
    address: String,
    #[command(flatten)]
    core: CoreArgs,
    /// If this option is set to false, any role and permission check will be bypassed. Even if no user is
    /// provided by the request headers of if the provided user doesn't have the required privileges.
    #[clap(long, env = "EDITOAST_ENABLE_AUTHORIZATION", default_value_t = true)]
    enable_authorization: bool,
    /// The timeout to use when performing the healthcheck, in milliseconds
    #[clap(long, env = "EDITOAST_HEALTH_CHECK_TIMEOUT_MS", default_value_t = 1000)]
    health_check_timeout_ms: u64,
    #[clap(long, env = "EDITOAST_TRAINS_TRAFFIC_PATH")]
    trains_traffic_path: Option<PathBuf>,
    #[command(flatten)]
    s3: S3Args,
}

/// Create and run the server
pub async fn runserver(
    RunserverArgs {
        map_layers_config,
        port,
        address,
        core:
            CoreArgs {
                mq_url,
                core_timeout,
                core_single_worker,
                core_client_channels_size,
                worker_pool_id,
            },
        enable_authorization,
        health_check_timeout_ms,
        root_url,
        dynamic_assets_path,
        trains_traffic_path,
        s3,
    }: RunserverArgs,
    postgres: PostgresConfig,
    valkey_config: ValkeyConfig,
    openfga: OpenfgaConfig,
    app_version: Option<String>,
) -> anyhow::Result<()> {
    let trains_traffic = Arc::new(RwLock::new(TrainsTrafficPool::new()));
    if let Some(traffic_file) = trains_traffic_path.clone() {
        tokio::spawn({
            let trains_traffic = Arc::clone(&trains_traffic);
            async move { trains_traffic::import_trains_traffic(trains_traffic, traffic_file).await }
        }.in_current_span());
    }
    let config = views::ServerConfig {
        port,
        address,
        health_check_timeout: Duration::milliseconds(health_check_timeout_ms as i64),
        map_layers_max_zoom: map_layers_config.max_zoom as u8,
        enable_authorization,
        postgres_config: postgres.into(),
        osrdyne_config: views::OsrdyneConfig {
            mq_url,
            core: views::CoreConfig {
                timeout: Duration::seconds(core_timeout as i64),
                single_worker: core_single_worker,
                num_channels: core_client_channels_size,
                worker_pool_id,
            },
        },
        valkey_config: valkey_config.into_cache_config(),
        openfga_config: openfga.into(),
        root_url,
        dynamic_assets_path,
        app_version,
        trains_traffic,
        s3_config: build_s3_config(s3),
    };

    let server = views::Server::new(config).await?;
    Ok(server.start().await?)
}

fn build_s3_config(s3: S3Args) -> Option<views::S3Config> {
    Some(views::S3Config {
        endpoint: s3.endpoint?,
        bucket_name: s3.bucket_name?,
        access_key_id: s3.access_key_id?,
        secret_access_key: s3.secret_access_key?,
    })
}
