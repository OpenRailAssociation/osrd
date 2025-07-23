use std::sync::Arc;

use crate::models::PgAuthDriver;
use crate::views;
use clap::Args;
use database::DbConnectionPoolV2;
use fga::client::DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK;
use fga::client::DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE;
use url::Url;

#[derive(Args, Debug)]
pub struct OpenfgaConfig {
    #[clap(long, env = "FGA_API_URL", default_value_t = Url::parse("http://localhost:8091").unwrap())]
    pub(super) openfga_url: Url,
    #[clap(long, env = "EDITOAST_OPENFGA_STORE", default_value_t = String::from("osrd-editoast"))]
    pub(super) openfga_store: String,
    #[clap(long, env = "OPENFGA_MAX_CHECKS_PER_BATCH_CHECK", default_value_t = DEFAULT_OPENFGA_MAX_CHECKS_PER_BATCH_CHECK)]
    pub(super) openfga_max_checks_per_batch_check: u32,
    #[clap(long, env = "OPENFGA_MAX_TUPLES_PER_WRITE", default_value_t = DEFAULT_OPENFGA_MAX_TUPLES_PER_WRITE)]
    pub(super) openfga_max_tuples_per_write: u64,
}

impl From<OpenfgaConfig> for views::OpenfgaConfig {
    fn from(
        OpenfgaConfig {
            openfga_url,
            openfga_store,
            openfga_max_checks_per_batch_check,
            openfga_max_tuples_per_write,
        }: OpenfgaConfig,
    ) -> Self {
        views::OpenfgaConfig {
            url: openfga_url,
            store: openfga_store,
            max_checks_per_batch_check: openfga_max_checks_per_batch_check,
            max_tuples_per_write: openfga_max_tuples_per_write,
        }
    }
}

impl OpenfgaConfig {
    pub async fn into_regulator(
        self,
        pool: Arc<DbConnectionPoolV2>,
    ) -> anyhow::Result<views::Regulator> {
        let config: views::OpenfgaConfig = self.into();
        let openfga = {
            tracing::info!(url = %config.url, "connecting to OpenFGA");
            match fga::Client::try_with_store(&config.store, config.as_settings()).await {
                Err(fga::client::InitializationError::NotFound(store)) => {
                    tracing::info!(store, "store not found, creating it");
                    fga::Client::try_new_store(&store, config.as_settings()).await?
                }
                result => result?,
            }
        };
        let driver = PgAuthDriver::new(pool);
        Ok(views::Regulator::new(openfga, driver))
    }
}
