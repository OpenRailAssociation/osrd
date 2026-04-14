use super::super::Client;
use super::super::RequestFailure;

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(in crate::client) enum Health {
    Unknown,
    Serving,
    NotServing,
    ServiceUnknown,
}

impl Client {
    #[tracing::instrument(skip(self), ret(level = "debug"), err)]
    pub(in crate::client) async fn get_healthz(&self) -> Result<Health, RequestFailure> {
        #[derive(serde::Deserialize)]
        struct Response {
            status: Health,
        }

        let url = self.base_url().join("healthz").unwrap();
        let Response { status } = self.inner.get(url).send().await?.json().await?;
        Ok(status)
    }
}
