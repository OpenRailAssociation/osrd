use super::super::Client;
use super::super::Error;
use super::Message;

#[derive(Debug, Default, Clone, serde::Deserialize)]
pub struct Store {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

impl Client {
    #[tracing::instrument(skip(self), err)]
    pub(in crate::client) async fn get_stores(
        &self,
        page_size: Option<usize>,
        continuation: Option<&str>,
    ) -> Result<(Vec<Store>, String), Error> {
        #[derive(serde::Deserialize)]
        struct Response {
            stores: Vec<Store>,
            #[serde(default)]
            continuation_token: String,
        }

        let mut url = self.base_url().join("stores").unwrap();
        if let Some(continuation) = continuation {
            url.query_pairs_mut()
                .append_pair("continuation_token", continuation);
        }
        if let Some(page_size) = page_size {
            url.query_pairs_mut()
                .append_pair("page_size", page_size.to_string().as_str());
        }
        let response = self.inner.get(url).send().await?;

        let Response {
            stores,
            continuation_token,
        } = response.json::<Message<_>>().await?.try_success()?;

        Ok((stores, continuation_token))
    }

    #[tracing::instrument(skip(self), err)]
    pub(in crate::client) async fn post_stores(&self, name: &str) -> Result<Store, Error> {
        #[derive(serde::Serialize)]
        struct Request {
            name: String,
        }

        let request = Request {
            name: name.to_owned(),
        };

        let url = self.base_url().join("stores").unwrap();
        let response = self.inner.post(url).json(&request).send().await?;

        let store = response.json::<Message<_>>().await?.try_success()?;
        Ok(store)
    }

    #[tracing::instrument(skip(self), err)]
    pub(in crate::client) async fn delete_stores(&self, store_id: &str) -> Result<(), Error> {
        let url = self
            .base_url()
            .join(format!("stores/{store_id}").as_str())
            .unwrap();
        let response = self.inner.delete(url).send().await?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(response.json::<Error>().await?)
        }
    }
}
