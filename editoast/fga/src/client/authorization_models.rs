use futures::stream;
use tracing::Instrument;

use super::Client;
use super::Continuation;
use super::RequestFailure;

pub use super::api::authorization_models::AuthorizationModel;
pub use super::api::authorization_models::StoreAuthorizationModel;

impl Client {
    pub fn authorization_models(
        &self,
    ) -> impl stream::TryStream<Ok = StoreAuthorizationModel, Error = RequestFailure> + '_ {
        Continuation::stream(move |continuation| {
            async move {
                let (models, continuation_str) = self
                    .get_stores_authorization_models(&self.store.id, None, continuation.as_option())
                    .await?;
                Ok((models, Continuation::from(continuation_str)))
            }
            .in_current_span()
        })
    }

    pub async fn latest_authorization_model(
        &self,
    ) -> Result<Option<StoreAuthorizationModel>, RequestFailure> {
        let models = &mut self
            .get_stores_authorization_models(&self.store.id, Some(1), None)
            .await?
            .0;
        debug_assert!(models.len() <= 1);
        Ok(models.pop())
    }

    #[tracing::instrument(skip(self), err)]
    pub async fn actualize_authorization_model(&mut self) -> Result<(), RequestFailure> {
        self.authorization_model_id = self
            .latest_authorization_model()
            .await?
            .map(|model| model.id);
        tracing::debug!(
            id = self.authorization_model_id,
            "set client authorization model ID"
        );
        Ok(())
    }

    /// Pushes a new authorization model into OpenFGA and configures the client to use it from now on
    pub async fn update_authorization_model(
        &mut self,
        authorization_model: &AuthorizationModel,
    ) -> Result<String, RequestFailure> {
        let model_id = self
            .post_stores_authorization_models(&self.store.id, authorization_model)
            .await?;
        self.actualize_authorization_model().await?;
        Ok(model_id)
    }
}

#[cfg(test)]
mod tests {
    use crate::client::setup_tracing;
    use crate::compile_model;
    use crate::test_client;

    const MODEL: &str = include_str!("../../tests/model.fga");

    #[tokio::test(flavor = "multi_thread", worker_threads = 1)]
    async fn persisted_auth_model_id_in_client() {
        setup_tracing();
        let model = compile_model(MODEL);
        let mut client = test_client!();
        assert_eq!(client.authorization_model_id, None);
        let id = client.update_authorization_model(&model).await.unwrap();
        assert_eq!(client.authorization_model_id, Some(id));
    }
}
