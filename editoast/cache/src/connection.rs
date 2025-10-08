use std::fmt::Debug;

use arcstr::ArcStr;
use deadpool_redis::redis::Arg;
use deadpool_redis::redis::AsyncCommands;
use deadpool_redis::redis::Cmd;
use deadpool_redis::redis::ErrorKind;
use deadpool_redis::redis::Pipeline;
use deadpool_redis::redis::RedisError;
use deadpool_redis::redis::RedisFuture;
use deadpool_redis::redis::ToRedisArgs;
use deadpool_redis::redis::Value;
use deadpool_redis::redis::aio::ConnectionLike;
use futures::FutureExt;
use futures::future;
use serde::Deserialize;
use serde::Serialize;
use serde::de::DeserializeOwned;
use tracing::Level;
use tracing::debug;
use tracing::span;

pub struct Connection {
    inner: ConnectionInner,
    app_version: ArcStr,
}

pub(crate) enum ConnectionInner {
    Tokio(deadpool_redis::Connection),
    NoCache,
    #[cfg(feature = "mock")]
    Mock(redis_test::MockRedisConnection),
}

fn no_cache_cmd_handler(cmd: &Cmd) -> Result<Value, RedisError> {
    let cmd_name = cmd
        .args_iter()
        .next()
        .ok_or((ErrorKind::ClientError, "missing a command instruction"))?;
    let nb_keys = cmd.args_iter().skip(1).count();
    match cmd_name {
        Arg::Simple(cmd_name_bytes)
            if cmd_name_bytes == "MGET".as_bytes()
                || cmd_name_bytes == "MSET".as_bytes()
                || nb_keys > 1 =>
        {
            Ok(Value::Array(vec![Value::Nil; nb_keys]))
        }
        Arg::Simple(_) if nb_keys == 1 => Ok(Value::Nil),
        Arg::Simple(cmd_name_bytes) if cmd_name_bytes == "PING".as_bytes() => {
            Ok(Value::SimpleString("PONG".to_string()))
        }
        Arg::Simple(cmd_name_bytes) => unimplemented!(
            "valkey command '{}' is not supported by cache::ValkeyConnection with '--no-cache'",
            String::from_utf8(cmd_name_bytes.to_vec())?
        ),
        Arg::Cursor => unimplemented!(
            "valkey cursor mode is not supported by cache::ValkeyConnection with '--no-cache'"
        ),
    }
}

impl ConnectionLike for Connection {
    fn req_packed_command<'a>(&'a mut self, cmd: &'a Cmd) -> RedisFuture<'a, Value> {
        match &mut self.inner {
            ConnectionInner::Tokio(connection) => connection.req_packed_command(cmd),
            ConnectionInner::NoCache => future::ready(no_cache_cmd_handler(cmd)).boxed(),
            #[cfg(feature = "mock")]
            ConnectionInner::Mock(mock_conn) => {
                let result = deadpool_redis::redis::ConnectionLike::req_packed_command(
                    mock_conn,
                    &cmd.get_packed_command(),
                );
                future::ready(result).boxed()
            }
        }
    }

    fn req_packed_commands<'a>(
        &'a mut self,
        cmd: &'a Pipeline,
        offset: usize,
        count: usize,
    ) -> RedisFuture<'a, Vec<Value>> {
        match &mut self.inner {
            ConnectionInner::Tokio(connection) => {
                connection.req_packed_commands(cmd, offset, count)
            }
            ConnectionInner::NoCache => {
                let responses = cmd
                    .cmd_iter()
                    .skip(offset)
                    .take(count)
                    .map(no_cache_cmd_handler)
                    .collect::<Result<_, RedisError>>();
                future::ready(responses).boxed()
            }
            #[cfg(feature = "mock")]
            ConnectionInner::Mock(mock_conn) => {
                let result = deadpool_redis::redis::ConnectionLike::req_packed_commands(
                    mock_conn,
                    &cmd.get_packed_pipeline(),
                    offset,
                    count,
                );
                future::ready(result).boxed()
            }
        }
    }

    fn get_db(&self) -> i64 {
        match &self.inner {
            ConnectionInner::Tokio(connection) => connection.get_db(),
            ConnectionInner::NoCache => 0,
            #[cfg(feature = "mock")]
            ConnectionInner::Mock(mock_conn) => {
                deadpool_redis::redis::ConnectionLike::get_db(mock_conn)
            }
        }
    }
}

#[derive(Clone, Serialize)]
struct ZaddWrapper<'a, M: Serialize> {
    member: &'a M,
    nonce: u64,
}

#[derive(Clone, Deserialize)]
struct ZrangebyscoreWrapper<M> {
    member: M,
    #[expect(dead_code)]
    nonce: u64,
}

impl Connection {
    pub(crate) fn new(inner: ConnectionInner, app_version: ArcStr) -> Self {
        Self { inner, app_version }
    }

    pub fn app_version(&self) -> &str {
        &self.app_version
    }

    /// Get a deserializable value from valkey
    #[tracing::instrument(name = "cache:json_get", skip(self), err)]
    pub async fn json_get<T: DeserializeOwned, K: Debug + ToRedisArgs + Send + Sync>(
        &mut self,
        key: K,
    ) -> Result<Option<T>, RedisError> {
        let value: Option<String> = self.get(key).await?;
        match value {
            Some(v) => match serde_json::from_str(&v) {
                Ok(value) => Ok(value),
                Err(e) => {
                    tracing::warn!(
                        "the cached value is not a valid JSON for type '{}': {e}",
                        std::any::type_name::<T>()
                    );
                    Ok(None)
                }
            },
            None => Ok(None),
        }
    }

    /// Get a list of deserializable value from valkey
    #[tracing::instrument(name = "cache:json_get_bulk", skip(self), err)]
    pub async fn json_get_bulk<T: DeserializeOwned, K: Debug + ToRedisArgs + Send + Sync>(
        &mut self,
        keys: &[K],
    ) -> Result<impl Iterator<Item = Option<T>>, RedisError> {
        let values: Vec<Option<String>> = if !keys.is_empty() {
            self.mget(keys).await?
        } else {
            // Avoid mget to fail if keys is empty
            vec![]
        };
        let cached_values = values.into_iter().map(|value| {
            value.and_then(|v| match serde_json::from_str(&v) {
                Ok(value) => Some(value),
                Err(e) => {
                    tracing::warn!(
                        "the cached value is not a valid JSON for type '{}': {e}",
                        std::any::type_name::<T>()
                    );
                    None
                }
            })
        });
        Ok(cached_values)
    }

    /// Set a serializable value to valkey with expiry time
    #[tracing::instrument(name = "cache:json_set", skip(self, value), err)]
    pub async fn json_set<K: Debug + ToRedisArgs + Send + Sync, T: Serialize>(
        &mut self,
        key: K,
        value: &T,
    ) -> Result<(), RedisError> {
        let str_value = match serde_json::to_string(value) {
            Ok(value) => value,
            Err(e) => {
                tracing::warn!(
                    "failed to serialize value to JSON for type '{}': {e}",
                    std::any::type_name::<T>()
                );
                return Ok(());
            }
        };
        self.set::<_, _, ()>(key, str_value).await?;
        Ok(())
    }

    /// Set a list of serializable values to valkey
    #[tracing::instrument(name = "cache:json_set_bulk", skip(self, items), err)]
    pub async fn json_set_bulk<K: Debug + ToRedisArgs + Send + Sync, T: Serialize>(
        &mut self,
        items: &[(K, T)],
    ) -> Result<(), RedisError> {
        // Avoid mset to fail if keys is empty
        if items.is_empty() {
            return Ok(());
        }
        let serialized_items = items
            .iter()
            .filter_map(|(key, value)| match serde_json::to_string(value) {
                Ok(str_value) => Some((key, str_value)),
                Err(e) => {
                    tracing::warn!(
                        "failed to serialize value to JSON for type '{}': {e}",
                        std::any::type_name::<T>()
                    );
                    None
                }
            })
            .collect::<Vec<_>>();

        if !serialized_items.is_empty() {
            self.mset::<_, _, ()>(&serialized_items).await?;
        }
        Ok(())
    }

    /// Set a list of compressed serializable values to valkey
    #[tracing::instrument(name = "cache:compressed_set_bulk", skip(self, items), err)]
    pub async fn compressed_set_bulk<K: Debug + ToRedisArgs + Send + Sync, T: Serialize>(
        &mut self,
        items: &[(K, T)],
    ) -> Result<(), RedisError> {
        // Avoid mset to fail if keys is empty
        if items.is_empty() {
            return Ok(());
        }

        let compressed_items = span!(Level::INFO, "Compressing data").in_scope(|| {
            items
                .iter()
                .filter_map(|(key, value)| {
                    // Create a LZ4 encoder.
                    let mut encoder = lz4_flex::frame::FrameEncoder::new(Vec::new());
                    // Serialize the `value` into JSON format and write it to the encoder (which compresses it).
                    if let Err(e) = serde_json::to_writer(&mut encoder, value) {
                        tracing::warn!(
                            "failed to serialize value to JSON for type '{}': {e}",
                            std::any::type_name::<T>()
                        );
                        return None;
                    }
                    // Finalize the compression process and retrieve the compressed data.
                    match encoder.finish() {
                        Ok(compressed_value) => Some((key, compressed_value)),
                        Err(e) => {
                            tracing::warn!(
                                "failed to compress value for type '{}': {e}",
                                std::any::type_name::<T>()
                            );
                            None
                        }
                    }
                })
                .collect::<Vec<_>>()
        });

        // Store the compressed values using mset
        if !compressed_items.is_empty() {
            span!(Level::INFO, "Sending items to Redis")
                .in_scope(|| self.mset::<_, _, ()>(&compressed_items))
                .await?;
        }
        Ok(())
    }

    /// Retrieves a list of compressed serialized values from Valkey, decompresses them, and deserializes the result.
    #[tracing::instrument(name = "cache:compressed_get_bulk", skip(self), err)]
    pub async fn compressed_get_bulk<K: Debug + ToRedisArgs + Send + Sync, T: DeserializeOwned>(
        &mut self,
        keys: &[K],
    ) -> Result<impl Iterator<Item = Option<T>>, RedisError> {
        debug!(nb_keys = keys.len());

        // Fetch the values from Redis
        let values = if !keys.is_empty() {
            span!(Level::INFO, "Fetching values from Redis")
                .in_scope(|| self.mget::<_, Vec<Option<Vec<u8>>>>(keys))
                .await?
        } else {
            // Avoid mget to fail if keys is empty
            vec![]
        };

        // Decompress each value if it exists
        let cached_values = span!(Level::INFO, "Decompressing data").in_scope(|| {
            values
                .into_iter()
                .map(|value| {
                    value.and_then(|compressed_data| {
                        let mut decoder = lz4_flex::frame::FrameDecoder::new(&compressed_data[..]);
                        match serde_json::from_reader(&mut decoder) {
                            Ok(deserialized) => Some(deserialized),
                            Err(e) => {
                                tracing::warn!(
                                    "the cached value is not a valid compressed JSON data for type '{}': {e}",
                                    std::any::type_name::<T>()
                                );
                                None
                            }
                        }
                    })
                })
        });
        Ok(cached_values)
    }

    /// Add one serializable member to a sorted set, or update its score if it already exists.
    pub async fn json_zadd<
        K: Debug + ToRedisArgs + Send + Sync,
        S: ToRedisArgs + Send + Sync,
        M: Serialize + ToOwned,
    >(
        &mut self,
        key: K,
        member: &M,
        score: S,
    ) -> Result<(), RedisError> {
        let member = ZaddWrapper {
            member,
            nonce: rand::random(),
        };
        let str_member = match serde_json::to_string(&member) {
            Ok(member) => member,
            Err(e) => {
                tracing::warn!(
                    "failed to serialize member to JSON for type '{}': {e}",
                    std::any::type_name::<M>()
                );
                return Ok(());
            }
        };
        self.zadd::<_, _, _, ()>(key, str_member, score).await?;
        Ok(())
    }

    /// Return a range of members in a sorted set, by score.
    pub async fn json_zrangebyscore<
        T: DeserializeOwned,
        K: ToRedisArgs + Send + Sync,
        M: ToRedisArgs + Send + Sync,
        MM: ToRedisArgs + Send + Sync,
    >(
        &mut self,
        key: K,
        min: M,
        max: MM,
    ) -> Result<impl Iterator<Item = Option<T>>, RedisError> {
        let serialized_members = self
            .zrangebyscore::<_, _, _, Vec<String>>(key, min, max)
            .await?;
        let deserialized_members = serialized_members.into_iter().map(|value| {
            match serde_json::from_str::<ZrangebyscoreWrapper<T>>(&value) {
                Ok(value) => Some(value.member),
                Err(e) => {
                    tracing::warn!(
                        "the cached value is not a valid JSON for type '{}': {e}",
                        std::any::type_name::<T>()
                    );
                    None
                }
            }
        });
        Ok(deserialized_members)
    }
}
