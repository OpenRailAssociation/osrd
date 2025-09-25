use std::sync::Arc;

use anyhow::anyhow;
use core_client::CoreClient;
use core_client::mq_client;
use database::DbConnectionPoolV2;

use crate::views;
use cache;

use super::ValkeyConfig;
use super::openfga_config::OpenfgaConfig;
use super::runserver::CoreArgs;

pub async fn healthcheck_cmd(
    db_pool: Arc<DbConnectionPoolV2>,
    valkey_config: ValkeyConfig,
    core_config: CoreArgs,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let valkey = cache::Client::new(valkey_config.into_cache_config(), "HEALTHCHECK");
    let core_client = CoreClient::new_mq(mq_client::Options {
        uri: core_config.mq_url,
        worker_pool_identifier: core_config.worker_pool_id,
        timeout: core_config.core_timeout,
        single_worker: core_config.core_single_worker,
        num_channels: core_config.core_client_channels_size,
    })
    .await?;
    let regulator = openfga_config.into_regulator(db_pool.clone()).await?;

    views::check_health(
        db_pool,
        valkey.into(),
        core_client.into(),
        regulator.openfga(),
    )
    .await
    .map_err(|e| anyhow!("healthcheck failed: {e}"))?;

    tracing::info!("✅ Healthcheck passed");
    Ok(())
}
