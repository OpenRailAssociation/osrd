use clap::Args;
use url::Url;

use crate::views;

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
