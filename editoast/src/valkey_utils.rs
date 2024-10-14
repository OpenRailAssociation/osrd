use std::fmt::Debug;

use futures::future;
use futures::FutureExt;
use redis::aio::ConnectionLike;
use redis::aio::ConnectionManager;
use redis::cluster::ClusterClient;
use redis::cluster_async::ClusterConnection;
use redis::cmd;
use redis::AsyncCommands;
use redis::Client;
use redis::ErrorKind;
use redis::RedisError;
use redis::RedisFuture;
use redis::RedisResult;
use redis::ToRedisArgs;
use serde::de::DeserializeOwned;
use serde::Serialize;
use tracing::trace;

use crate::client::ValkeyConfig;
use crate::error::Result;

pub enum ValkeyConnection {
    Cluster(ClusterConnection),
    Tokio(ConnectionManager),
    NoCache,
}

fn no_cache_cmd_handler(cmd: &redis::Cmd) -> std::result::Result<redis::Value, RedisError> {
    let cmd_name = cmd.args_iter().next().ok_or((
        redis::ErrorKind::ClientError,
        "missing a command instruction",
    ))?;
    let nb_keys = cmd.args_iter().skip(1).count();
    match cmd_name {
        redis::Arg::Simple(cmd_name_bytes)
            if cmd_name_bytes == "MGET".as_bytes()
                || cmd_name_bytes == "MSET".as_bytes()
                || nb_keys > 1 =>
        {
            Ok(redis::Value::Bulk(vec![redis::Value::Nil; nb_keys]))
        },
        redis::Arg::Simple(_)
            if nb_keys == 1 =>
        {
            Ok(redis::Value::Nil)
        },
        redis::Arg::Simple(cmd_name_bytes) if cmd_name_bytes == "PING".as_bytes() => Ok(redis::Value::Status("PONG".to_string())),
        redis::Arg::Simple(cmd_name_bytes) => unimplemented!(
            "valkey command '{}' is not supported by editoast::valkey_utils::ValkeyConnection with '--no-cache'", String::from_utf8(cmd_name_bytes.to_vec())?
        ),
        redis::Arg::Cursor => unimplemented!(
            "valkey cursor mode is not supported by editoast::valkey_utils::ValkeyConnection with '--no-cache'"
        ),
    }
}

impl ConnectionLike for ValkeyConnection {
    fn req_packed_command<'a>(&'a mut self, cmd: &'a redis::Cmd) -> RedisFuture<'a, redis::Value> {
        match self {
            ValkeyConnection::Cluster(connection) => connection.req_packed_command(cmd),
            ValkeyConnection::Tokio(connection) => connection.req_packed_command(cmd),
            ValkeyConnection::NoCache => future::ready(no_cache_cmd_handler(cmd)).boxed(),
        }
    }

    fn req_packed_commands<'a>(
        &'a mut self,
        cmd: &'a redis::Pipeline,
        offset: usize,
        count: usize,
    ) -> RedisFuture<'a, Vec<redis::Value>> {
        match self {
            ValkeyConnection::Cluster(connection) => {
                connection.req_packed_commands(cmd, offset, count)
            }
            ValkeyConnection::Tokio(connection) => {
                connection.req_packed_commands(cmd, offset, count)
            }
            ValkeyConnection::NoCache => {
                let responses = cmd
                    .cmd_iter()
                    .skip(offset)
                    .take(count)
                    .map(no_cache_cmd_handler)
                    .collect::<std::result::Result<_, redis::RedisError>>();
                future::ready(responses).boxed()
            }
        }
    }

    fn get_db(&self) -> i64 {
        match self {
            ValkeyConnection::Cluster(connection) => connection.get_db(),
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
    #[tracing::instrument(name = "cache:get_bulk", skip(self), err)]
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
                    "An error occured serializing to json",
                ))
                .into())
            }
        };
        self.set(key, str_value).await?;
        Ok(())
    }

    /// Set a list of serializable values to valkey
    #[tracing::instrument(name = "cache:set_bulk", skip(self, items), err)]
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
                            "An error occured serializing to json",
                        ))
                        .into()
                    })
            })
            .collect::<Result<Vec<_>>>()?;

        self.mset(&serialized_items).await?;
        Ok(())
    }
}

#[derive(Clone)]
pub enum ValkeyClient {
    Cluster(ClusterClient),
    Tokio(Client),
    /// This doesn't cache anything. It has no backend.
    NoCache,
}

impl ValkeyClient {
    pub fn new(valkey_config: ValkeyConfig) -> Result<ValkeyClient> {
        if valkey_config.no_cache {
            return Ok(ValkeyClient::NoCache);
        }
        let valkey_config_url = valkey_config.url()?;
        if valkey_config.is_cluster_client {
            return Ok(ValkeyClient::Cluster(
                redis::cluster::ClusterClient::new(vec![valkey_config_url.as_str()]).unwrap(),
            ));
        }
        Ok(ValkeyClient::Tokio(
            redis::Client::open(valkey_config_url.as_str()).unwrap(),
        ))
    }

    pub async fn get_connection(&self) -> RedisResult<ValkeyConnection> {
        match self {
            ValkeyClient::Cluster(client) => Ok(ValkeyConnection::Cluster(
                client.get_async_connection().await?,
            )),
            ValkeyClient::Tokio(client) => Ok(ValkeyConnection::Tokio(
                client.get_connection_manager().await?,
            )),
            ValkeyClient::NoCache => Ok(ValkeyConnection::NoCache),
        }
    }

    pub async fn ping_valkey(&self) -> RedisResult<()> {
        let mut conn = self.get_connection().await?;
        cmd("PING").query_async::<_, ()>(&mut conn).await?;
        trace!("Valkey ping successful");
        Ok(())
    }
}
