use std::future;

use futures::TryStreamExt as _;
use futures::stream;
use tracing::Instrument;

use super::Client;
use super::ConnectionSettings;
use super::Continuation;
use super::InitializationError;
use super::RequestFailure;

pub use super::api::stores::Store;

impl Client {
    #[tracing::instrument(err)]
    pub async fn try_with_store(
        store_name: &str,
        settings: ConnectionSettings,
    ) -> Result<Self, InitializationError> {
        let mut client = Self {
            store: Store::default(),
            authorization_model_id: None,
            settings,
            inner: reqwest::Client::new(),
        };

        client.store = client
            .find_store(store_name)
            .await?
            .ok_or_else(|| InitializationError::NotFound(store_name.to_string()))?;
        client.actualize_authorization_model().await?;

        Ok(client)
    }

    #[tracing::instrument(err)]
    pub async fn try_new_store(
        store_name: &str,
        settings: ConnectionSettings,
    ) -> Result<Self, InitializationError> {
        let mut client = Self {
            store: Store::default(),
            authorization_model_id: None,
            settings,
            inner: reqwest::Client::new(),
        };
        if client.settings.reset_store
            && let Some(store) = client.find_store(store_name).await?
        {
            tracing::debug!(old = ?store, "removing old store for reset");
            client.delete_stores(&store.id).await?;
        }
        client.store = client.post_stores(store_name).await?;
        Ok(client)
    }

    pub fn stores(&self) -> impl stream::TryStream<Ok = Store, Error = RequestFailure> + '_ {
        Continuation::stream(move |continuation| {
            async move {
                let (stores, continuation_str) =
                    self.get_stores(None, continuation.as_option()).await?;
                Ok((stores, Continuation::from(continuation_str)))
            }
            .in_current_span()
        })
    }

    #[tracing::instrument(skip(self), err)]
    pub async fn find_store(&self, store_name: &str) -> Result<Option<Store>, RequestFailure> {
        let stream = self
            .stores()
            .try_filter(|Store { name, .. }| future::ready(name == store_name));
        futures::pin_mut!(stream);
        let store = stream.try_next().await?.into_iter().next_back();
        Ok(store)
    }

    pub fn store(&self) -> &Store {
        &self.store
    }
}

#[cfg(test)]
mod tests {
    use crate::client::Client;
    use crate::client::InitializationError;
    use crate::client::setup_tracing;
    use crate::test_client;
    use crate::test_utilities::connection_settings;

    #[tokio::test]
    async fn test_try_init_not_found() {
        setup_tracing();
        let result = Client::try_with_store("nonexistent_store", connection_settings()).await;

        match result {
            Err(InitializationError::NotFound(store_name)) => {
                assert_eq!(store_name, "nonexistent_store");
            }
            _ => panic!("Expected InitializationError::NotFound"),
        }
    }

    #[tokio::test]
    async fn create_store_with_reset() {
        setup_tracing();
        let client = test_client!();
        assert_eq!(
            client.store.name,
            "fga-client-stores-tests-create_store_with_reset"
        );
    }
}
