use super::Client;
use super::RequestFailure;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(super) enum Health {
    Unknown,
    Serving,
    NotServing,
    ServiceUnknown,
}

impl Client {
    #[tracing::instrument(skip(self), ret(level = "debug"), err)]
    pub(super) async fn get_healthz(&self) -> Result<Health, RequestFailure> {
        #[derive(serde::Deserialize)]
        struct Response {
            status: Health,
        }

        let url = self.base_url().join("healthz").unwrap();
        let Response { status } = self.inner.get(url).send().await?.json().await?;
        Ok(status)
    }
}
