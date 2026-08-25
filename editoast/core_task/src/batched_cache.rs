use crate::{Cachable, Correlated, Task};

use itertools::Itertools as _;
use itertools::izip;
use std::sync::Arc;
use tokio_stream::wrappers::UnboundedReceiverStream;

use tracing::Instrument;

/// Writes into the cache in batches
///
/// It opens a channel that will be dropped when the CacheWriter will be dropped
/// This will close the UnboundedReceiverStream in a separate tokio task and finish the work
pub struct Cache {
    pub cache_write_tx: Arc<tokio::sync::mpsc::UnboundedSender<(String, serde_json::Value)>>,
    vk_client: Arc<cache::Client>,
}

impl Cache {
    pub fn new(vk_client: Arc<cache::Client>, cache_write_cache_size: usize) -> Self {
        use futures::StreamExt;
        let (cache_write_tx, cache_write_rx) = tokio::sync::mpsc::unbounded_channel();
        let vk_client_clone = vk_client.clone();
        // 'write_cache' task, writes input key-value pairs to cache, logging errors
        tokio::spawn(
            async move {
                UnboundedReceiverStream::new(cache_write_rx)
                    .chunks(cache_write_cache_size)
                    .for_each(|buffer| async {
                        let mut vkconn = vk_client_clone.get_connection().await.unwrap();
                        if let Err(e) = vkconn.json_set_bulk(buffer).await {
                            tracing::error!(?e, "task stream: cache write failure")
                        }
                    })
                    .await;
            }
            .in_current_span(),
        );

        Self {
            cache_write_tx: Arc::new(cache_write_tx),
            vk_client,
        }
    }

    pub fn batched_write(&self, cache_key: String, serialized: serde_json::Value) {
        self.cache_write_tx.send((cache_key, serialized)).ok();
    }

    /// Fetch data from the valkey cache for a vector cache keys
    ///
    /// Cache misses are returned at None
    pub async fn fetch_by_keys<Input, Output>(
        &self,
        inputs: &[Input],
    ) -> (Vec<Option<Output>>, Vec<String>)
    where
        Input: Cachable + 'static,
        Output: serde::de::DeserializeOwned + Send + Clone + 'static,
    {
        let cache_keys = inputs
            .iter()
            .map(|input| input.key(self.vk_client.app_version()))
            .collect_vec();
        let mut vkconn = self.vk_client.get_connection().await.unwrap();
        match vkconn.json_get_bulk::<_, Output>(&cache_keys).await {
            Ok(cached_values) => (cached_values, cache_keys),
            Err(e) => {
                tracing::error!(?e, "task stream: cache read error — computing task output");
                (vec![None; cache_keys.len()], cache_keys)
            }
        }
    }

    /// Fetch data from the valkey cache for a vector of correlated inputs
    ///
    /// Cache misses are returned at None
    pub async fn fetch<T, CorrelationKey: 'static>(
        &self,
        inputs: Vec<Correlated<CorrelationKey, T>>,
    ) -> impl Iterator<Item = (T, CorrelationKey, String, Option<<T as Task>::Output>)>
    where
        T: Task + 'static + Cachable,
    {
        // We sort the keys so that unit tests can predictably mock redis requests.
        // That's because redis-test doesn't find a matching request in the list, but
        // just pops the first one and asserts.
        #[cfg(test)]
        let inputs = inputs
            .into_iter()
            .map(|input| {
                let key = input.data.key(self.vk_client.app_version());
                (input, key)
            })
            .sorted_by_key(|(_, key)| key.clone())
            .map(|(input, _)| input)
            .collect_vec();

        let (correlation_keys, inputs) = inputs
            .into_iter()
            .map_into()
            .unzip::<_, _, Vec<_>, Vec<_>>();

        let (cached_values, cache_keys) = self.fetch_by_keys(&inputs).await;
        izip!(inputs, correlation_keys, cache_keys, cached_values)
    }
}
