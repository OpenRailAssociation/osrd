mod envs;
mod path_properties;

use std::hash::Hash;
use std::sync::Arc;

// Crate-level exports
pub use envs::TrainSet;
pub use envs::core::CoreEnv;
pub use envs::pathfinding::PathItemAlternatives;
pub use envs::pathfinding::PathfindingConsist;
pub use envs::pathfinding::PathfindingConstraints;
pub use envs::pathfinding::PathfindingEnv;
pub use envs::pathfinding::PathfindingTrain;
pub use envs::simulation::ScheduleItem;
pub use envs::simulation::SimulationConsist;
pub use envs::simulation::SimulationEnv;
pub use envs::simulation::SimulationOutput;
pub use envs::simulation::SimulationTrain;
pub use envs::simulation::SimulationTrainParameters;

use futures::stream;
use itertools::Itertools as _;
use itertools::izip;
use serde::de::DeserializeOwned;
use serde::ser::Serialize;
use tracing::Instrument;

/// Interface required by [SimulationEnv] and friends for [Correlated] keys
///
/// A unique identifier to represent a train in environments.
pub trait TrainKey: Clone + Hash + Eq + Send + Sync {}
impl<T> TrainKey for T where T: Clone + Hash + Eq + Send + Sync {}

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
        vk_client: Arc<cache::Client>,
        ctx: Self::Context,
    ) -> Result<Self::Output, Self::Error> {
        let key = vk_client.app_version().to_string();
        let cache_entry = {
            match vk_client.get_connection().await {
                Ok(mut vkconn) => vkconn
                    .json_get::<Self::Output, _>(&key)
                    .await
                    .map_err(|e| e.into()),
                Err(e) => Err(e),
            }
        };
        match cache_entry.unwrap_or_else(|e| {
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
                        tokio::spawn(
                            async move {
                                use deadpool_redis::redis::AsyncCommands as _;
                                let mut vkconn = vk_client.get_connection().await.unwrap();
                                if let Err(e) = vkconn.set::<_, _, ()>(&key, serialized).await {
                                    tracing::error!(?e, key, "cache write error");
                                }
                            }
                            .in_current_span(),
                        );
                    }
                };
                Ok(value)
            }
        }
    }
}

/// A named tuple for a value with a correlation key
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
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
        vk_client: Arc<cache::Client>,
        ctx: T::Context,
    ) -> impl stream::Stream<
        Item = Correlated<CorrelationKey, Result<<T as Task>::Output, <T as Task>::Error>>,
    > + Send;
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
        vk_client: Arc<cache::Client>,
        ctx: <T as Task>::Context,
    ) -> impl stream::Stream<
        Item = Correlated<CorrelationKey, Result<<T as Task>::Output, <T as Task>::Error>>,
    > + Send {
        use stream::StreamExt as _;

        /* The implementation spawns several Tokio tasks which interact in the following way:
         *
         *                      [task]
         *                      not_a_task
         *                      (comment)
         *                                                                                            compute ---------+--> [write_cache]
         *                                                +-------> [chunk_processing] ------+           ^             |
         *                                                |                                  |           |             +----------+
         *                                                |                                  |           | (cache miss)           |
         *                                                |                                  |           |                        v
         * requests stream ----------> [cache_read] ------+-------> [chunk_processing] ------+----> [aggregation]---------> result_stream
         * (self, function                                |                                  |                   (cache hit)
         *     input)                                     |                                  |
         *                                                |                                  |
         *                                                +--------> ... --------------------+
         *                                  (spawns several tasks
         *                                   via for_each_concurrent)
         */

        let (cache_write_tx, mut cache_write_rx) =
            tokio::sync::mpsc::unbounded_channel::<(String, serde_json::Value)>();
        {
            let vk_client = vk_client.clone();
            // 'write_cache' task, writes input key-value pairs to cache, logging errors
            tokio::spawn(
                async move {
                    while let Some((key, value)) = cache_write_rx.recv().await {
                        let mut vkconn = vk_client.get_connection().await.unwrap();
                        if let Err(e) = vkconn.json_set(key.clone(), &value).await {
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
                    .zip(stream::repeat(vk_client.clone()))
                    .zip(stream::repeat(cache_read_tx))
                    .for_each_concurrent(None, async move |((inputs, vk_client), cache_read_tx)| {
                        // We sort the keys so that unit tests can predictably mock redis requests.
                        // That's because redis-test doesn't find a matching request in the list, but
                        // just pops the first one and asserts.
                        #[cfg(test)]
                        let inputs = inputs
                            .into_iter()
                            .map(|input| {
                                let key = input.data.key(vk_client.app_version());
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
                            .map(|input| input.key(vk_client.app_version()))
                            .collect_vec();

                        // we have to clone because of json_get_bulk's API x Rust 2024 new rules
                        let keys = cache_keys.clone();

                        // Fetch from valkey or compute and write to valkey

                        let mut vkconn = vk_client.get_connection().await.unwrap();
                        match vkconn.json_get_bulk::<T::Output, _>(keys.as_slice()).await {
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
                    })
                    .in_current_span(),
            );
        }

        let (results_tx, results_rx) = futures::channel::mpsc::unbounded::<
            Correlated<CorrelationKey, Result<T::Output, T::Error>>,
        >();
        {
            // 'aggregation' task, receives requests and potential cached task outputs. If cached,
            // directly send the value to the result stream, otherwise compute the value (send a request to Core),
            // send it to the 'write_cache' task and to the result stream.
            tokio::spawn(
                async move {
                    while let Some((input, correlation_key, cache_key, cache_entry)) =
                        cache_read_rx.recv().await
                    {
                        if let Some(cached_value) = cache_entry {
                            results_tx
                                .unbounded_send(Correlated::new(correlation_key, Ok(cached_value)))
                                .ok();
                        } else {
                            match input.compute(ctx.clone()).await {
                                Ok(value) => {
                                    #[cfg(not(test))]
                                    let serialized = serde_json::to_value(&value).unwrap();
                                    #[cfg(test)]
                                    let serialized = {
                                        let mut serialized = serde_json::to_value(&value).unwrap();
                                        serialized.sort_all_objects();
                                        serialized
                                    };
                                    cache_write_tx.send((cache_key, serialized)).ok();
                                    results_tx
                                        .unbounded_send(Correlated::new(correlation_key, Ok(value)))
                                        .ok();
                                }
                                Err(err) => {
                                    results_tx
                                        .unbounded_send(Correlated::new(correlation_key, Err(err)))
                                        .ok();
                                }
                            };
                        }
                    }
                }
                .in_current_span(),
            );
        }

        // The receiver implements Stream
        results_rx
    }
}

#[cfg(test)]
fn compress_json<T: Serialize>(value: &T) -> Vec<u8> {
    let mut encoder = zstd::Encoder::new(Vec::new(), 0).unwrap();
    serde_json::to_writer(&mut encoder, value).unwrap();
    encoder.finish().unwrap()
}

#[cfg(test)]
/// Builds an `MGET` mocked command with sorted keys and ordered JSON keys for determinism
fn mock_mget(mut values: Vec<(String, Option<Vec<u8>>)>) -> cache::MockCmd {
    values.sort_by_key(|(k, _)| k.clone());
    let (keys, values): (Vec<_>, Vec<_>) = values.into_iter().unzip();
    cache::MockCmd::new(
        deadpool_redis::redis::cmd("MGET").arg(keys),
        Ok(deadpool_redis::redis::Value::Array(
            values
                .into_iter()
                .map(|v| match v {
                    Some(v) => deadpool_redis::redis::Value::BulkString(v),
                    None => deadpool_redis::redis::Value::Nil,
                })
                .collect(),
        )),
    )
}
