use crate::client::RedisConfig;
use crate::error::Result;
use futures::future;
use futures::FutureExt;
use redis::aio::{ConnectionLike, ConnectionManager};
use redis::cluster::ClusterClient;
use redis::cluster_async::ClusterConnection;
use redis::AsyncCommands;
use redis::Client;
use redis::ErrorKind;
use redis::RedisError;
use redis::RedisFuture;
use redis::RedisResult;
use redis::ToRedisArgs;
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::fmt::Debug;

pub enum RedisConnection {
    Cluster(ClusterConnection),
    Tokio(ConnectionManager),
    NoCache,
}

impl ConnectionLike for RedisConnection {
    fn req_packed_command<'a>(&'a mut self, cmd: &'a redis::Cmd) -> RedisFuture<'a, redis::Value> {
        match self {
            RedisConnection::Cluster(connection) => connection.req_packed_command(cmd),
            RedisConnection::Tokio(connection) => connection.req_packed_command(cmd),
            RedisConnection::NoCache => {
                let nb_keys = cmd.args_iter().count() - 1;
                if nb_keys == 1 {
                    future::ok(redis::Value::Nil).boxed()
                } else {
                    future::ok(redis::Value::Bulk(vec![redis::Value::Nil; nb_keys])).boxed()
                }
            }
        }
    }

    fn req_packed_commands<'a>(
        &'a mut self,
        cmd: &'a redis::Pipeline,
        offset: usize,
        count: usize,
    ) -> RedisFuture<'a, Vec<redis::Value>> {
        match self {
            RedisConnection::Cluster(connection) => {
                connection.req_packed_commands(cmd, offset, count)
            }
            RedisConnection::Tokio(connection) => {
                connection.req_packed_commands(cmd, offset, count)
            }
            RedisConnection::NoCache => future::ok(vec![]).boxed(),
        }
    }

    fn get_db(&self) -> i64 {
        match self {
            RedisConnection::Cluster(connection) => connection.get_db(),
            RedisConnection::Tokio(connection) => connection.get_db(),
            RedisConnection::NoCache => 0,
        }
    }
}

impl RedisConnection {
    /// Get a deserializable value from redis
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

    /// Get a list of deserializable value from redis
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

    /// Set a serializable value to redis with expiry time
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

    /// Set a list of serializable values to redis
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
pub enum RedisClient {
    Cluster(ClusterClient),
    Tokio(Client),
    /// This doesn't cache anything. It has no backend.
    NoCache,
}

impl RedisClient {
    pub fn new(redis_config: RedisConfig) -> Result<RedisClient> {
        if redis_config.no_cache {
            return Ok(RedisClient::NoCache);
        }
        let redis_config_url = redis_config.url()?;
        if redis_config.is_cluster_client {
            return Ok(RedisClient::Cluster(
                redis::cluster::ClusterClient::new(vec![redis_config_url.as_str()]).unwrap(),
            ));
        }
        Ok(RedisClient::Tokio(
            redis::Client::open(redis_config_url.as_str()).unwrap(),
        ))
    }

    pub async fn get_connection(&self) -> RedisResult<RedisConnection> {
        match self {
            RedisClient::Cluster(client) => Ok(RedisConnection::Cluster(
                client.get_async_connection().await?,
            )),
            RedisClient::Tokio(client) => Ok(RedisConnection::Tokio(
                client.get_connection_manager().await?,
            )),
            RedisClient::NoCache => Ok(RedisConnection::NoCache),
        }
    }
}
