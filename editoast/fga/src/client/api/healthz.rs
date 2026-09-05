use super::super::Client;
use super::super::Error;
use super::Message;

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
    pub(in crate::client) async fn get_healthz(&self) -> Result<Health, Error> {
        #[derive(serde::Deserialize)]
        struct Response {
            status: Health,
        }

        let url = self.base_url().join("healthz").unwrap();
        let response = self.fetch(self.inner.get(url)).await?;
        let Response { status } = response.json::<Message<_>>().await?.try_success()?;
        Ok(status)
    }
}
