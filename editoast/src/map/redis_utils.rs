use crate::client::RedisConfig;
use crate::error::Result;
use redis::aio::{ConnectionLike, ConnectionManager};
use redis::cluster::ClusterClient;
use redis::cluster_async::ClusterConnection;
use redis::Client;
use redis::{cmd, FromRedisValue, RedisResult, ToRedisArgs};

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

#[derive(Clone)]
pub enum RedisClient {
    Cluster(ClusterClient),
    Tokio(Client),
}

impl RedisClient {
    pub fn new(redis_config: RedisConfig) -> RedisClient {
        if redis_config.is_cluster_client {
            return RedisClient::Cluster(
                redis::cluster::ClusterClient::new(vec![redis_config.redis_url.as_str()]).unwrap(),
            );
        }
        RedisClient::Tokio(redis::Client::open(redis_config.redis_url.as_str()).unwrap())
    }

    pub async fn get_connection(&self) -> RedisResult<RedisConnection> {
        match self {
            RedisClient::Cluster(client) => Ok(RedisConnection::Cluster(
                client.get_async_connection().await?,
            )),
            RedisClient::Tokio(client) => Ok(RedisConnection::Tokio(
                client.get_tokio_connection_manager().await?,
            )),
        }
    }
}

/// Retrieve all keys matching the given `key_pattern`.
///
/// Check redis pattern documentation [here](https://redis.io/commands/keys).
pub async fn keys<C: ConnectionLike>(redis: &mut C, key_pattern: &str) -> Result<Vec<String>> {
    Ok(cmd("KEYS")
        .arg(key_pattern)
        .query_async::<_, Vec<String>>(redis)
        .await?)
}

/// Delete redis values associated to the given keys.
pub async fn delete<C: ConnectionLike>(redis: &mut C, keys_to_delete: Vec<String>) -> Result<u64> {
    if keys_to_delete.is_empty() {
        return Ok(0);
    }
    let mut del = cmd("DEL");
    for key in keys_to_delete {
        del.arg(key);
    }
    Ok(del.query_async::<_, u64>(redis).await?)
}

/// Sets redis value associated to a specific key
/// The key will expire after cache_duration (in seconds)
pub async fn set<C: ConnectionLike, T: ToRedisArgs>(
    redis: &mut C,
    key: &str,
    value: T,
    cache_duration: u32,
) -> Result<()> {
    cmd("SET")
        .arg(key)
        .arg(value)
        .query_async::<_, ()>(redis)
        .await?;
    cmd("EXPIRE")
        .arg(key)
        .arg(cache_duration)
        .query_async::<_, ()>(redis)
        .await?;
    Ok(())
}

/// Gets redis value associated to a specific key
/// Returns None if key does not exists.
pub async fn get<C: ConnectionLike, T: ToRedisArgs + FromRedisValue>(
    redis: &mut C,
    cache_key: &str,
) -> Option<T> {
    cmd("GET")
        .arg(cache_key)
        .query_async::<_, Option<T>>(redis)
        .await
        .unwrap()
}

#[cfg(test)]
mod tests {
    use std::{thread::sleep, time::Duration};

    use crate::{
        client::RedisConfig,
        map::redis_utils::{delete, get, keys, set},
    };
    use actix_web::test as actix_test;
    use redis::aio::ConnectionManager;

    async fn create_redis_pool() -> ConnectionManager {
        let cfg = RedisConfig::default();
        let redis = redis::Client::open(cfg.redis_url).unwrap();
        redis.get_tokio_connection_manager().await.unwrap()
    }

    #[actix_test]
    async fn test_redis_set_get_list_delete() {
        let mut redis_pool = create_redis_pool().await;
        // Check redis empty
        let test_keys = keys(&mut redis_pool, "test_*").await.unwrap();
        assert!(test_keys.is_empty());
        // Add two keys and check presence
        set(&mut redis_pool, "test_1", "value_1", 600)
            .await
            .unwrap();
        set(&mut redis_pool, "test_2", "value_2", 600)
            .await
            .unwrap();
        let mut test_keys = keys(&mut redis_pool, "test_*").await.unwrap();
        test_keys.sort();
        assert_eq!(test_keys, vec!["test_1", "test_2"]);
        // Get value 1
        let value_1 = get::<_, String>(&mut redis_pool, "test_1").await.unwrap();
        assert_eq!("value_1", value_1);
        // Get nonexisting key
        let does_not_exist = get::<_, Vec<u8>>(&mut redis_pool, "does_not_exist").await;
        assert!(does_not_exist.is_none());
        // Set and get empty vec
        let empty_vec: Vec<u8> = vec![];
        set(&mut redis_pool, "test_empty", empty_vec.clone(), 600)
            .await
            .unwrap();
        let test_empty = get::<_, Vec<u8>>(&mut redis_pool, "test_empty").await;
        assert!(test_empty.is_some());
        assert_eq!(test_empty.unwrap(), empty_vec);
        // Delete two keys and check absence
        let result = delete(
            &mut redis_pool,
            vec![
                String::from("test_1"),
                String::from("test_2"),
                String::from("test_empty"),
            ],
        )
        .await
        .unwrap();
        assert_eq!(result, 3);
        let test_keys = keys(&mut redis_pool, "test_*").await.unwrap();
        assert!(test_keys.is_empty());
        // Test expire parameter
        set(&mut redis_pool, "test_1", "value_1", 1).await.unwrap();
        sleep(Duration::from_secs(2));
        let test_keys = keys(&mut redis_pool, "test_1").await.unwrap();
        assert!(test_keys.is_empty());
    }
}
