use std::sync::Arc;

use axum::extract::State;
use core_client::CoreClient;
use database::DbConnectionPoolV2;
use database::db_connection_pool::ping_database;
use editoast_derive::EditoastError;
use futures::TryFutureExt as _;
use tracing::Instrument as _;
use tracing::info_span;

use crate::AppState;
use crate::error::Result;

#[derive(Debug, thiserror::Error, EditoastError)]
#[editoast_error(base_id = "app_health")]
pub enum AppHealthError {
    #[error("Timeout error")]
    Timeout,
    #[error(transparent)]
    Database(#[from] database::db_connection_pool::PingError),
    #[error(transparent)]
    Valkey(anyhow::Error),
    #[error(transparent)]
    Openfga(anyhow::Error),
    #[error(transparent)]
    Core(#[from] core_client::Error),
}

#[editoast_derive::route]
#[utoipa::path(
    get, path = "",
    responses(
        (status = 200, description = "Check if Editoast is running correctly", body = String)
    )
)]
pub(in crate::views) async fn health(
    State(AppState {
        db_pool,
        valkey_client,
        health_check_timeout,
        core_client,
        regulator,
        ..
    }): State<AppState>,
) -> Result<&'static str> {
    tokio::time::timeout(
        health_check_timeout
            .to_std()
            .expect("timeout should be valid at this point"),
        check_health(db_pool, valkey_client, core_client, regulator.openfga()),
    )
    .await
    .map_err(|_| AppHealthError::Timeout)??;
    Ok("ok")
}

#[tracing::instrument(skip_all)]
pub async fn check_health(
    db_pool: Arc<DbConnectionPoolV2>,
    valkey_client: Arc<cache::Client>,
    core_client: Arc<CoreClient>,
    openfga: &fga::Client,
) -> Result<()> {
    let mut db_connection = db_pool.clone().get().await?;
    let database_ping = ping_database(&mut db_connection).map_err(AppHealthError::Database);
    let openfga_ping = openfga
        .is_healthy()
        .map_err(|err| anyhow::anyhow!("OpenFGA health request failure: {err}"))
        .and_then(|healthy| {
            if !healthy {
                futures::future::err(anyhow::anyhow!("OpenFGA is not healthy"))
            } else {
                futures::future::ok(())
            }
        })
        .map_err(AppHealthError::Openfga);
    let mq_ping = core_client.ping().map_err(AppHealthError::Core);
    let valkey_ping = valkey_client
        .get_connection()
        .map_err(anyhow::Error::from)
        .and_then(|mut vkconn| async move {
            deadpool_redis::redis::AsyncCommands::ping::<()>(&mut vkconn)
                .map_err(anyhow::Error::from)
                .await
        })
        .map_err(AppHealthError::Valkey);
    tokio::try_join!(
        database_ping.instrument(info_span!("database ping")),
        valkey_ping.instrument(info_span!("valkey ping")),
        mq_ping.instrument(info_span!("mq ping")),
        openfga_ping.instrument(info_span!("openfga ping"))
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::views::test_app;

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn health() {
        let app = test_app!().skip_authz().build();
        app.get("/health").await.assert_status_ok();
    }
}
