use super::super::Client;
use super::super::Error;
use super::Message;

pub type AuthorizationModel = serde_json::Value;

#[derive(Debug, serde::Deserialize)]
pub struct StoreAuthorizationModel {
    pub id: String,
    pub type_definitions: AuthorizationModel,
}

impl Client {
    #[tracing::instrument(skip(self), err)]
    pub(in crate::client) async fn get_stores_authorization_models(
        &self,
        store_id: &str,
        page_size: Option<usize>,
        continuation: Option<&str>,
    ) -> Result<(Vec<StoreAuthorizationModel>, String), Error> {
        #[derive(serde::Deserialize)]
        struct Response {
            authorization_models: Vec<StoreAuthorizationModel>,
            #[serde(default)]
            continuation_token: String,
        }

        let mut url = self
            .base_url()
            .join(format!("/stores/{store_id}/authorization-models").as_str())
            .unwrap();
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
            authorization_models,
            continuation_token,
        } = response.json::<Message<_>>().await?.try_success()?;

        Ok((authorization_models, continuation_token))
    }

    #[tracing::instrument(skip(self, authorization_model), ret(level = "debug"), err)]
    pub(in crate::client) async fn post_stores_authorization_models(
        &self,
        store_id: &str,
        authorization_model: &AuthorizationModel,
    ) -> Result<String, Error> {
        let url = self
            .base_url()
            .join(format!("stores/{store_id}/authorization-models").as_str())
            .unwrap();
        let response = self
            .inner
            .post(url)
            .json(authorization_model)
            .send()
            .await?;

        #[derive(serde::Deserialize)]
        struct Response {
            authorization_model_id: String,
        }
        let Response {
            authorization_model_id,
        } = response.json::<Message<_>>().await?.try_success()?;

        Ok(authorization_model_id)
    }
}
