use std::sync::Arc;

use anyhow::anyhow;
use editoast_models::DbConnectionPoolV2;

use crate::core::mq_client;
use crate::core::CoreClient;
use crate::views;
use crate::ValkeyClient;

use super::openfga_config::OpenfgaConfig;
use super::runserver::CoreArgs;
use super::ValkeyConfig;

pub async fn healthcheck_cmd(
    db_pool: Arc<DbConnectionPoolV2>,
    valkey_config: ValkeyConfig,
    core_config: CoreArgs,
    openfga_config: OpenfgaConfig,
) -> anyhow::Result<()> {
    let valkey = ValkeyClient::new(valkey_config.into()).unwrap();
    let core_client = CoreClient::new_mq(mq_client::Options {
        uri: core_config.mq_url,
        worker_pool_identifier: String::from("core"),
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
    .map_err(|e| anyhow!("❌ healthcheck failed: {e}"))?;

    tracing::info!("✅ Healthcheck passed");
    Ok(())
}
