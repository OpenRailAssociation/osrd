mod batched_cache;
mod envs;
mod path_properties;

use std::hash::Hash;
use std::sync::Arc;

// Crate-level exports
pub use batched_cache::Cache;
pub use envs::TrainSet;
pub use envs::core::CoreEnv;
pub use envs::pathfinding::PathItemConstraint;
pub use envs::pathfinding::PathfindingConsist;
pub use envs::pathfinding::PathfindingConstraints;
pub use envs::pathfinding::PathfindingEnv;
pub use envs::pathfinding::PathfindingTrain;
pub use envs::pathfinding::pathfinding_request_from_consist_constraints;
pub use envs::simulation::ScheduleItem;
pub use envs::simulation::SimulationConsist;
pub use envs::simulation::SimulationEnv;
pub use envs::simulation::SimulationOutput;
pub use envs::simulation::SimulationTrain;
pub use envs::simulation::SimulationTrainParameters;

use futures::stream;

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
pub trait Task: Sized + Send + Cachable {
    /// Task output
    type Output: DeserializeOwned + Serialize + Clone + Send + Sync + 'static;
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

    /// Number of cache entry write attempts per batch
    ///
    /// Defaults to the same value as [Self::CACHE_READS_BATCH_SIZE] but can be overridden if needed.
    const CACHE_WRITES_BATCH_SIZE: usize = Self::CACHE_READS_BATCH_SIZE;

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
        let key = self.key(vk_client.app_version());
        let cache_entry = match vk_client.get_connection().await {
            Ok(mut vkconn) => vkconn
                .json_get::<_, Self::Output>(&key)
                .await
                .map_err(|e| e.into()),
            Err(e) => Err(e),
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
                {
                    let value = value.clone();
                    tokio::spawn(
                        async move {
                            let mut vkconn = vk_client.get_connection().await.unwrap();
                            if let Err(e) = vkconn.json_set(key.clone(), value).await {
                                tracing::error!(?e, key, "cache write error");
                            }
                        }
                        .in_current_span(),
                    );
                }
                Ok(value)
            }
        }
    }
}

/// Indicates that the struct can stored in the valkey cache server
pub trait Cachable {
    /// Computes the cache key based on task inputs
    fn key(&self, app_version: &str) -> String;
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
    T: Task + 'static + Sync,
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

        let cache = Arc::new(Cache::new(vk_client.clone(), T::CACHE_WRITES_BATCH_SIZE));
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
                    .zip(stream::repeat(cache.clone()))
                    .zip(stream::repeat(cache_read_tx))
                    .for_each_concurrent(None, async move |((inputs, cache), cache_read_tx)| {
                        for cache_result in cache.fetch(inputs).await {
                            cache_read_tx.send(cache_result).ok();
                        }
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
                                    cache.batched_write(cache_key, serialized);
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
