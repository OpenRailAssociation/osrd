use std::path::PathBuf;

use chrono::Duration;
use clap::Args;
use url::Url;

use crate::views;

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
    #[clap(long, env = "OSRDYNE_API_URL", default_value_t = Url::parse("http://127.0.0.1:4242/").unwrap())]
    osrdyne_api_url: Url,
    /// The timeout to use when performing the healthcheck, in milliseconds
    #[clap(long, env = "EDITOAST_HEALTH_CHECK_TIMEOUT_MS", default_value_t = 1000)]
    health_check_timeout_ms: u64,
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
        osrdyne_api_url,
        health_check_timeout_ms,
        root_url,
        dynamic_assets_path,
    }: RunserverArgs,
    postgres: PostgresConfig,
    valkey_config: ValkeyConfig,
    openfga: OpenfgaConfig,
    app_version: Option<String>,
) -> anyhow::Result<()> {
    let config = views::ServerConfig {
        port,
        address,
        health_check_timeout: Duration::milliseconds(health_check_timeout_ms as i64),
        map_layers_max_zoom: map_layers_config.max_zoom as u8,
        enable_authorization,
        postgres_config: postgres.into(),
        osrdyne_config: views::OsrdyneConfig {
            mq_url,
            osrdyne_api_url,
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
    };

    let server = views::Server::new(config).await?;
    Ok(server.start().await?)
}
