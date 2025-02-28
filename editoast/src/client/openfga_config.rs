use std::sync::Arc;

use crate::models::auth::PgAuthDriver;
use crate::views;
use clap::Args;
use editoast_models::DbConnectionPoolV2;
use url::Url;

#[derive(Args, Debug)]
pub struct OpenfgaConfig {
    #[clap(long, env = "EDITOAST_OPENFGA_URL", default_value_t = Url::parse("http://localhost:8091").unwrap())]
    pub(super) openfga_url: Url,
    #[clap(long, env = "EDITOAST_OPENFGA_STORE", default_value_t = String::from("osrd-editoast"))]
    pub(super) openfga_store: String,
}

impl From<OpenfgaConfig> for views::OpenfgaConfig {
    fn from(
        OpenfgaConfig {
            openfga_url,
            openfga_store,
        }: OpenfgaConfig,
    ) -> Self {
        views::OpenfgaConfig {
            url: openfga_url,
            store: openfga_store,
        }
    }
}

impl OpenfgaConfig {
    pub async fn into_regulator(
        self,
        pool: Arc<DbConnectionPoolV2>,
    ) -> anyhow::Result<views::Regulator> {
        let config: views::OpenfgaConfig = self.into();
        let mut openfga = {
            tracing::info!(url = %config.url, "connecting to OpenFGA");
            match fga::Client::try_with_store(config.store.clone(), config.try_as_settings()?).await
            {
                Err(fga::client::InitializationError::NotFound(store)) => {
                    tracing::info!(store, "store not found, creating it");
                    fga::Client::try_new_store(store, config.try_as_settings()?).await?
                }
                result => result?,
            }
        };
        editoast_authz::ensure_latest_authorization_model(&mut openfga).await?;
        let driver = PgAuthDriver::new(pool);
        Ok(views::Regulator::new(openfga, driver))
    }
}
