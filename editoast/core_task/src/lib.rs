mod envs;
mod path_properties;

use std::iter;
use std::sync::Arc;

// Crate-level exports
pub use envs::core::CoreEnv;
pub use envs::pathfinding::PathfindingConsist;
pub use envs::pathfinding::PathfindingConstraints;
pub use envs::pathfinding::PathfindingEnv;

use futures::stream;
use itertools::Itertools as _;
use itertools::izip;
use serde::de::DeserializeOwned;
use serde::ser::Serialize;
use tracing::Instrument;

/// Indicates that a Core task can be performed and cached
///
/// This trait is meant to be implemented for [Task] requests.
///
/// Features:
/// - [fn Task::run] that runs a single task
/// - [trait TaskStreamExt] to batch tasks (requires additional [type Task::Context] bounds)
pub trait Task: Sized + Send {
    /// Task output
    type Output: DeserializeOwned + Serialize + Send;
    /// Computation error when running a task for cache misses
    type Error: std::error::Error + Send;
    /// Context required for task
    ///
    /// Additional bounds are required on this to batch tasks, cf. [trait TaskStreamExt].
    type Context: Send;

    /// Number of cache entry read attempts per batch
    ///
    /// Choose this value based on the size of task results and acceptable latency considering all reads hit.
    const CACHE_READS_BATCH_SIZE: usize;

    /// Computes the cache key based on task inputs
    fn key(&self, app_version: &str) -> String;

    /// Computes the task output according to inputs and context
    ///
    /// This function does **not** need to handle any caching concerns.
    fn compute(
        self,
        ctx: Self::Context,
    ) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send;

    /// Retrieves the task result from cache or computes it
    ///
    /// To batch tasks, check out [trait TaskStreamExt].
    ///
    /// # Errors
    ///
    /// Should any caching error occur while reading, the task output is computed.
    /// Cache write errors are ignored. So are serde errors for caching.
    /// All errors are logged.
    #[tracing::instrument(skip_all, err)]
    #[expect(async_fn_in_trait)] // not for public (ie. outside editoast) use, no auto traits bounds to specify on the resulting future
    async fn run(
        self,
        mut vkconn: cache::Connection,
        ctx: Self::Context,
    ) -> Result<Self::Output, Self::Error> {
        let key = self.key(vkconn.app_version());
        match vkconn
            .json_get::<Self::Output, _>(&key)
            .await
            .unwrap_or_else(|e| {
                tracing::error!(?e, key, "cache read error — computing task output");
                None
            }) {
            Some(value) => {
                tracing::trace!(key, "cache hit");
                Ok(value)
            }
            None => {
                tracing::trace!(key, "cache miss");
                let value = self.compute(ctx).await?;
                match serde_json::to_string(&value) {
                    Err(e) => {
                        tracing::error!(
                            ?e,
                            key,
                            "serialization error before cache write — skipping cache write"
                        );
                    }
                    Ok(serialized) => {
                        tokio::spawn(async move {
                            use deadpool_redis::redis::AsyncCommands as _;
                            if let Err(e) = vkconn.set::<_, _, ()>(key.clone(), serialized).await {
                                tracing::error!(?e, key, "cache write error");
                            }
                        });
                    }
                };
                Ok(value)
            }
        }
    }
}

/// A named tuple for a value with a correlation key
pub struct Correlated<CorrelationKey, T> {
    pub correlation_key: CorrelationKey,
    pub data: T,
}

impl<CorrelationKey, T> Correlated<CorrelationKey, T> {
    pub fn new(correlation_key: CorrelationKey, data: T) -> Self {
        Self {
            correlation_key,
            data,
        }
    }
}

impl<CorrelationKey, T> From<Correlated<CorrelationKey, T>> for (CorrelationKey, T) {
    fn from(correlated: Correlated<CorrelationKey, T>) -> Self {
        (correlated.correlation_key, correlated.data)
    }
}

/// Extends streams to provide [TaskStreamExt::run]
///
/// The stream must contain [Correlated] task requests. In practice, the `CorrelationKey`
/// is the `Train` generic parameter of task environments.
///
/// Differs from [Task::run] as it operates on a stream of inputs instead of a single one.
pub trait TaskStreamExt<T, CorrelationKey>
where
    CorrelationKey: Send + 'static,
    T: Task + 'static,
    T::Context: Clone + Send + Sync,
    Self: stream::Stream<Item = Correlated<CorrelationKey, T>> + Send + 'static,
{
    /// Returns a stream of task results fetched from cache or computed concurrently
    ///
    /// The order of the results is not the same as the order of inputs.
    fn run(
        self,
        vkconn: cache::Connection,
        ctx: T::Context,
    ) -> impl stream::TryStream<Ok = Correlated<CorrelationKey, T::Output>, Error = T::Error> + Send;
}

impl<T, InputStream, CorrelationKey> TaskStreamExt<T, CorrelationKey> for InputStream
where
    CorrelationKey: Send + 'static,
    T: Task + 'static,
    T::Context: Clone + Send + Sync,
    InputStream: stream::Stream<Item = Correlated<CorrelationKey, T>> + Send + 'static,
{
    #[tracing::instrument(skip_all)]
    fn run(
        self,
        vkconn: cache::Connection,
        ctx: <T as Task>::Context,
    ) -> impl stream::TryStream<
        Ok = Correlated<CorrelationKey, <T as Task>::Output>,
        Error = <T as Task>::Error,
    > + Send {
        use stream::StreamExt as _;

        /* The implementation spawns several Tokio tasks which interact in the following way:
         *
         *                      [task]
         *                      not_a_task
         *                      (comment)
         *                                                                                            compute ------------> [write_cache]
         *                                                +-------> [chunk_processing] ------+
         *                                                |                                  |           ^                        |
         *                                                |                                  |           |(cache miss)            v
         *                                                |                                  |
         * requests stream ----------> [cache_read] ------+-------> [chunk_processing] ------+----> [aggregation]---------> result_stream
         * (self, function                                |                                  |                   (cache hit)
         *     input)                                     |                                  |
         *                                                |                                  |
         *                                                +--------> ... --------------------+
         *                                  (spawns several tasks
         *                                   via for_each_concurrent)
         */

        // shared to several tasks
        let vkconn = Arc::new(tokio::sync::Mutex::new(vkconn));

        let (cache_write_tx, mut cache_write_rx) =
            tokio::sync::mpsc::unbounded_channel::<(String, String)>();
        {
            let vkconn = vkconn.clone();
            // 'write_cache' task, writes input key-value pairs to cache, logging errors
            tokio::spawn(
                async move {
                    use deadpool_redis::redis::AsyncCommands as _;
                    while let Some((key, serialized_value)) = cache_write_rx.recv().await {
                        if let Err(e) = vkconn
                            .lock()
                            .await
                            .set::<_, _, ()>(key.clone(), serialized_value)
                            .await
                        {
                            tracing::error!(?e, key, "task stream: cache write failure")
                        }
                    }
                }
                .in_current_span(),
            );
        }

        let (cache_read_tx, mut cache_read_rx) = tokio::sync::mpsc::unbounded_channel::<(
            T, // input
            CorrelationKey,
            String,            // cache key
            Option<T::Output>, // maybe a cached task output
        )>();
        {
            // 'cache_read' task, consumes input stream (self), chunks cache reads,
            // processes each chunk in a dedicated task 'chunk_processing' (spawned by for_each_concurrent),
            // and sends a bunch of data to the 'aggregation' task
            tokio::spawn(
                self.chunks(T::CACHE_READS_BATCH_SIZE)
                    .zip(stream::iter(iter::repeat(vkconn.clone())))
                    .zip(stream::iter(iter::repeat(cache_read_tx)))
                    .for_each_concurrent(None, async move |((inputs, vkconn), cache_read_tx)| {
                        let mut vk = vkconn.lock().await;

                        // We sort the keys so that unit tests can predictably mock redis requests.
                        // That's because redis-test doesn't find a matching request in the list, but
                        // just pops the first one and asserts.
                        #[cfg(test)]
                        let inputs = inputs
                            .into_iter()
                            .map(|input| {
                                let key = input.data.key(vk.app_version());
                                (input, key)
                            })
                            .sorted_by_key(|(_, key)| key.clone())
                            .map(|(input, _)| input)
                            .collect_vec();

                        let (correlation_keys, inputs) = inputs
                            .into_iter()
                            .map_into()
                            .unzip::<_, _, Vec<_>, Vec<_>>();
                        let cache_keys = inputs
                            .iter()
                            .map(|input| input.key(vk.app_version()))
                            .collect_vec();

                        // we have to clone because of json_get_bulk's API x Rust 2024 new rules
                        let keys = cache_keys.clone();

                        // Fetch from valkey or compute and write to valkey
                        match vk.json_get_bulk::<T::Output, _>(keys.as_slice()).await {
                            Ok(cached_values) => {
                                for (value, correlation, key, input) in
                                    izip!(cached_values, correlation_keys, cache_keys, inputs)
                                {
                                    cache_read_tx.send((input, correlation, key, value)).ok();
                                }
                            }
                            Err(e) => {
                                tracing::error!(
                                    ?e,
                                    "task stream: cache read error — computing task output"
                                );
                                for (key, correlation, input) in
                                    izip!(cache_keys, correlation_keys, inputs)
                                {
                                    cache_read_tx.send((input, correlation, key, None)).ok();
                                }
                            }
                        };
                    }),
            );
        }

        let (results_tx, results_rx) = futures::channel::mpsc::unbounded::<
            Result<Correlated<CorrelationKey, T::Output>, T::Error>,
        >();
        {
            // 'aggregation' task, receives requests and potential cached task outputs. If cached,
            // directly send the value to the result stream, otherwise compute the value (send a request to Core),
            // send it to the 'write_cache' task and to the result stream.
            tokio::spawn(async move {
                while let Some((input, correlation_key, cache_key, cache_entry)) =
                    cache_read_rx.recv().await
                {
                    if let Some(cached_value) = cache_entry {
                        results_tx
                            .unbounded_send(Ok(Correlated::new(correlation_key, cached_value)))
                            .ok();
                    } else {
                        match input.compute(ctx.clone()).await {
                            Ok(value) => {
                                #[cfg(not(test))]
                                let serialized = serde_json::to_string(&value).unwrap();
                                #[cfg(test)]
                                let serialized = {
                                    let mut serialized = serde_json::to_value(&value).unwrap();
                                    serialized.sort_all_objects();
                                    serialized.to_string()
                                };
                                cache_write_tx.send((cache_key, serialized)).ok();
                                results_tx
                                    .unbounded_send(Ok(Correlated::new(correlation_key, value)))
                                    .ok();
                            }
                            Err(err) => {
                                results_tx.unbounded_send(Err(err)).ok();
                            }
                        };
                    }
                }
            });
        }

        // The receiver implements Stream
        results_rx
    }
}

#[cfg(test)]
/// Builds an `MGET` mocked command with sorted keys and ordered JSON keys for determinism
fn mock_mget(mut values: Vec<(String, Option<serde_json::Value>)>) -> cache::MockCmd {
    values.sort_by_key(|(k, _)| k.clone());
    let (keys, values): (Vec<_>, Vec<_>) = values.into_iter().unzip();
    cache::MockCmd::new(
        deadpool_redis::redis::cmd("MGET").arg(keys),
        Ok(deadpool_redis::redis::Value::Array(
            values
                .into_iter()
                .map(|v| match v {
                    Some(mut v) => {
                        v.sort_all_objects();
                        deadpool_redis::redis::Value::SimpleString(v.to_string())
                    }
                    None => deadpool_redis::redis::Value::Nil,
                })
                .collect(),
        )),
    )
}
