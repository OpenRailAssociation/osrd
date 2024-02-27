use crate::client::RedisConfig;
use crate::error::Result;
use redis::aio::{ConnectionLike, ConnectionManager};
use redis::cluster::ClusterClient;
use redis::cluster_async::ClusterConnection;
use redis::RedisResult;
use redis::{AsyncCommands, RedisError};
use redis::{Client, ToRedisArgs};
use redis::{ErrorKind, Expiry};
use serde::de::DeserializeOwned;
use serde::Serialize;

pub enum RedisConnection {
    Cluster(ClusterConnection),
    Tokio(ConnectionManager),
}

impl ConnectionLike for RedisConnection {
    fn req_packed_command<'a>(
        &'a mut self,
        cmd: &'a redis::Cmd,
    ) -> redis::RedisFuture<'a, redis::Value> {
        match self {
            RedisConnection::Cluster(connection) => connection.req_packed_command(cmd),
            RedisConnection::Tokio(connection) => connection.req_packed_command(cmd),
        }
    }

    fn req_packed_commands<'a>(
        &'a mut self,
        cmd: &'a redis::Pipeline,
        offset: usize,
        count: usize,
    ) -> redis::RedisFuture<'a, Vec<redis::Value>> {
        match self {
            RedisConnection::Cluster(connection) => {
                connection.req_packed_commands(cmd, offset, count)
            }
            RedisConnection::Tokio(connection) => {
                connection.req_packed_commands(cmd, offset, count)
            }
        }
    }

    fn get_db(&self) -> i64 {
        match self {
            RedisConnection::Cluster(connection) => connection.get_db(),
            RedisConnection::Tokio(connection) => connection.get_db(),
        }
    }
}

impl RedisConnection {
    /// Get a deserializable value from redis
    pub async fn json_get<T: DeserializeOwned, K: ToRedisArgs + Send + Sync>(
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

    /// Get a deserializable value from redis with expiry time
    pub async fn json_get_ex<T: DeserializeOwned, K: ToRedisArgs + Send + Sync>(
        &mut self,
        key: K,
        seconds: usize,
    ) -> Result<Option<T>> {
        let value: Option<String> = self.get_ex(key, Expiry::EX(seconds)).await?;
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

    /// Set a serializable value to redis with expiry time
    pub async fn json_set_ex<K: ToRedisArgs + Send + Sync, T: Serialize>(
        &mut self,
        key: K,
        value: &T,
        seconds: u64,
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
        self.set_ex(key, str_value, seconds).await?;
        Ok(())
    }
}

#[derive(Clone)]
pub enum RedisClient {
    Cluster(ClusterClient),
    Tokio(Client),
}

impl RedisClient {
    pub fn new(redis_config: RedisConfig) -> Result<RedisClient> {
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
        }
    }
}

#[cfg(test)]
mod tests {
    use super::RedisClient;
    use rstest::rstest;
    use serde::{Deserialize, Serialize};
    use tokio::time::{sleep, Duration};

    /// Test get and set json values to redis
    #[rstest]
    async fn json_get_set() {
        #[derive(Serialize, Deserialize, Debug, PartialEq)]
        struct TestStruct {
            name: String,
            age: u8,
        }

        let redis_client = RedisClient::new(Default::default()).unwrap();
        let mut redis = redis_client.get_connection().await.unwrap();

        let key = "__test__.json_get_set";
        let test_struct = TestStruct {
            name: "John".to_string(),
            age: 25,
        };

        redis.json_set_ex(key, &test_struct, 60).await.unwrap();
        let value: TestStruct = redis.json_get_ex(key, 2).await.unwrap().unwrap();
        assert_eq!(value, test_struct);

        // Wait for 5 seconds
        sleep(Duration::from_secs(3)).await;

        // Check if the value has expired
        let value = redis.json_get::<TestStruct, _>(key).await.unwrap();
        assert_eq!(value, None);
    }
}
