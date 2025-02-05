use std::fmt::Debug;

use deadpool_redis::redis::aio::ConnectionLike;
use deadpool_redis::redis::cmd;
use deadpool_redis::redis::Arg;
use deadpool_redis::redis::AsyncCommands;
use deadpool_redis::redis::Cmd;
use deadpool_redis::redis::ErrorKind;
use deadpool_redis::redis::Pipeline;
use deadpool_redis::redis::RedisError;
use deadpool_redis::redis::RedisFuture;
use deadpool_redis::redis::ToRedisArgs;
use deadpool_redis::redis::Value;
use deadpool_redis::Config;
use deadpool_redis::Connection;
use deadpool_redis::Pool;
use deadpool_redis::PoolError;
use deadpool_redis::Runtime;
use futures::future;
use futures::FutureExt;
use serde::de::DeserializeOwned;
use serde::Serialize;
use tracing::{debug, span, trace, Level};
use url::Url;

use crate::error::Result;

pub enum ValkeyConnection {
    Tokio(Connection),
    NoCache,
}

fn no_cache_cmd_handler(cmd: &Cmd) -> std::result::Result<Value, RedisError> {
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
        },
        Arg::Simple(_)
            if nb_keys == 1 =>
        {
            Ok(Value::Nil)
        },
        Arg::Simple(cmd_name_bytes) if cmd_name_bytes == "PING".as_bytes() => Ok(Value::SimpleString("PONG".to_string())),
        Arg::Simple(cmd_name_bytes) => unimplemented!(
            "valkey command '{}' is not supported by editoast::valkey_utils::ValkeyConnection with '--no-cache'", String::from_utf8(cmd_name_bytes.to_vec())?
        ),
        Arg::Cursor => unimplemented!(
            "valkey cursor mode is not supported by editoast::valkey_utils::ValkeyConnection with '--no-cache'"
        ),
    }
}

impl ConnectionLike for ValkeyConnection {
    fn req_packed_command<'a>(&'a mut self, cmd: &'a Cmd) -> RedisFuture<'a, Value> {
        match self {
            ValkeyConnection::Tokio(connection) => connection.req_packed_command(cmd),
            ValkeyConnection::NoCache => future::ready(no_cache_cmd_handler(cmd)).boxed(),
        }
    }

    fn req_packed_commands<'a>(
        &'a mut self,
        cmd: &'a Pipeline,
        offset: usize,
        count: usize,
    ) -> RedisFuture<'a, Vec<Value>> {
        match self {
            ValkeyConnection::Tokio(connection) => {
                connection.req_packed_commands(cmd, offset, count)
            }
            ValkeyConnection::NoCache => {
                let responses = cmd
                    .cmd_iter()
                    .skip(offset)
                    .take(count)
                    .map(no_cache_cmd_handler)
                    .collect::<std::result::Result<_, RedisError>>();
                future::ready(responses).boxed()
            }
        }
    }

    fn get_db(&self) -> i64 {
        match self {
            ValkeyConnection::Tokio(connection) => connection.get_db(),
            ValkeyConnection::NoCache => 0,
        }
    }
}

impl ValkeyConnection {
    /// Get a deserializable value from valkey
    #[tracing::instrument(name = "cache:json_get", skip(self), err)]
    pub async fn json_get<T: DeserializeOwned, K: Debug + ToRedisArgs + Send + Sync>(
        &mut self,
        key: K,
    ) -> Result<Option<T>> {
        let value: Option<String> = self.get(key).await?;
        match value {
            Some(v) => match serde_json::from_str(&v) {
                Ok(value) => Ok(value),
                Err(_) => {
                    Err(RedisError::from((ErrorKind::TypeError, "Expected valid json")).into())
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
    ) -> Result<Vec<Option<T>>> {
        // Avoid mget to fail if keys is empty
        if keys.is_empty() {
            return Ok(vec![]);
        }
        let values: Vec<Option<String>> = self.mget(keys).await?;
        values
            .into_iter()
            .map(|value| match value {
                Some(v) => match serde_json::from_str::<T>(&v) {
                    Ok(value) => Ok(Some(value)),
                    Err(_) => {
                        Err(RedisError::from((ErrorKind::TypeError, "Expected valid json")).into())
                    }
                },
                None => Ok(None),
            })
            .collect()
    }

    /// Set a serializable value to valkey with expiry time
    #[tracing::instrument(name = "cache:json_set", skip(self, value), err)]
    pub async fn json_set<K: Debug + ToRedisArgs + Send + Sync, T: Serialize>(
        &mut self,
        key: K,
        value: &T,
    ) -> Result<()> {
        let str_value = match serde_json::to_string(value) {
            Ok(value) => value,
            Err(_) => {
                return Err(RedisError::from((
                    ErrorKind::IoError,
                    "An error occurred serializing to json",
                ))
                .into())
            }
        };
        self.set(key, str_value).await?;
        Ok(())
    }

    /// Set a list of serializable values to valkey
    #[tracing::instrument(name = "cache:json_set_bulk", skip(self, items), err)]
    pub async fn json_set_bulk<K: Debug + ToRedisArgs + Send + Sync, T: Serialize>(
        &mut self,
        items: &[(K, T)],
    ) -> Result<()> {
        // Avoid mset to fail if keys is empty
        if items.is_empty() {
            return Ok(());
        }
        let serialized_items = items
            .iter()
            .map(|(key, value)| {
                serde_json::to_string(value)
                    .map(|str_value| (key, str_value))
                    .map_err(|_| {
                        RedisError::from((
                            ErrorKind::IoError,
                            "An error occurred serializing to json",
                        ))
                        .into()
                    })
            })
            .collect::<Result<Vec<_>>>()?;

        self.mset(&serialized_items).await?;
        Ok(())
    }

    /// Set a list of compressed serializable values to valkey
    #[tracing::instrument(name = "cache:compressed_set_bulk", skip(self, items), err)]
    pub async fn compressed_set_bulk<K: Debug + ToRedisArgs + Send + Sync, T: Serialize>(
        &mut self,
        items: &[(K, T)],
    ) -> Result<()> {
        // Avoid mset to fail if keys is empty
        if items.is_empty() {
            return Ok(());
        }

        let compressed_items = span!(Level::INFO, "Compressing data").in_scope(|| {
            items
                .iter()
                .map(|(key, value)| {
                    // Create a LZ4 encoder.
                    let mut encoder = lz4_flex::frame::FrameEncoder::new(Vec::new());
                    // Serialize the `value` into JSON format and write it to the encoder (which compresses it).
                    serde_json::to_writer(&mut encoder, value)?;
                    // Finalize the compression process and retrieve the compressed data.
                    let compressed_value = encoder.finish().map_err(|_| {
                        RedisError::from((
                            ErrorKind::IoError,
                            "An error occured compressing the value",
                        ))
                    })?;
                    Ok((key, compressed_value))
                })
                .collect::<Result<Vec<_>>>()
        })?;

        // Store the compressed values using mset
        span!(Level::INFO, "Sending items to Redis")
            .in_scope(|| async move { self.mset(&compressed_items).await })
            .await?;
        Ok(())
    }

    /// Retrieves a list of compressed serialized values from Valkey, decompresses them, and deserializes the result.
    #[tracing::instrument(name = "cache:compressed_get_bulk", skip(self), err)]
    pub async fn compressed_get_bulk<K: Debug + ToRedisArgs + Send + Sync, T: DeserializeOwned>(
        &mut self,
        keys: &[K],
    ) -> Result<Vec<Option<T>>> {
        // Avoid mget to fail if keys is empty
        if keys.is_empty() {
            return Ok(vec![]);
        }
        debug!(nb_keys = keys.len());

        // Fetch the values from Redis
        let values = span!(Level::INFO, "Fetching values from Redis")
            .in_scope(|| async move { self.mget::<_, Vec<Option<Vec<u8>>>>(keys).await })
            .await?;

        // Decompress each value if it exists
        span!(Level::INFO, "Decompressing data").in_scope(|| {
            values
                .into_iter()
                .map(|value| match value {
                    Some(compressed_data) => {
                        let mut decoder = lz4_flex::frame::FrameDecoder::new(&compressed_data[..]);
                        let deserialized: T = serde_json::from_reader(&mut decoder)?;
                        Ok(Some(deserialized))
                    }
                    None => Ok(None),
                })
                .collect()
        })
    }
}

#[derive(Clone)]
pub enum ValkeyClient {
    Tokio(Pool),
    /// This doesn't cache anything. It has no backend.
    NoCache,
}

#[derive(Clone)]
pub struct ValkeyConfig {
    /// Disables caching. This should not be used in production.
    pub no_cache: bool,
    pub valkey_url: Url,
}

impl ValkeyClient {
    pub fn new(valkey_config: ValkeyConfig) -> Result<ValkeyClient> {
        if valkey_config.no_cache {
            return Ok(ValkeyClient::NoCache);
        }
        Ok(ValkeyClient::Tokio(
            Config::from_url(valkey_config.valkey_url)
                .create_pool(Some(Runtime::Tokio1))
                .unwrap(),
        ))
    }

    pub async fn get_connection(&self) -> std::result::Result<ValkeyConnection, PoolError> {
        match self {
            ValkeyClient::Tokio(pool) => Ok(ValkeyConnection::Tokio(pool.get().await?)),
            ValkeyClient::NoCache => Ok(ValkeyConnection::NoCache),
        }
    }

    #[tracing::instrument(skip_all)]
    pub async fn ping_valkey(&self) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        cmd("PING").query_async::<()>(&mut conn).await?;
        trace!("Valkey ping successful");
        Ok(())
    }
}
