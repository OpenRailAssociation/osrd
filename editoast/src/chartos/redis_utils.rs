pub use super::bounding_box::{BoundingBox, InvalidationZone};
pub use super::map_layers::{Layer, MapLayers};
use crate::db_connection::RedisPool;
use redis::{FromRedisValue, RedisError, ToRedisArgs};
use rocket_db_pools::deadpool_redis::redis::cmd;

pub async fn keys(redis_pool: &RedisPool, key_pattern: &str) -> Result<Vec<String>, RedisError> {
    cmd("KEYS")
        .arg(key_pattern)
        .query_async::<_, Vec<String>>(&mut redis_pool.get().await.unwrap())
        .await
}

pub async fn delete(
    redis_pool: &RedisPool,
    keys_to_delete: Vec<String>,
) -> Result<u64, RedisError> {
    if keys_to_delete.is_empty() {
        return Ok(0);
    }
    let mut del = cmd("DEL");
    for key in keys_to_delete {
        del.arg(key);
    }
    del.query_async::<_, u64>(&mut redis_pool.get().await.unwrap())
        .await
}

pub async fn set<T: ToRedisArgs>(
    redis_pool: &RedisPool,
    key: &str,
    value: T,
) -> Result<(), RedisError> {
    cmd("SET")
        .arg(key)
        .arg(value)
        .query_async::<_, ()>(&mut redis_pool.get().await.unwrap())
        .await
}

/// Gets Redis value associated to a  specific key
/// Returns None if key does not exists.
pub async fn get<T: Default + FromRedisValue>(
    redis_pool: &RedisPool,
    cache_key: &str,
) -> Option<T> {
    cmd("GET")
        .arg(cache_key)
        .query_async::<_, Option<T>>(&mut redis_pool.get().await.unwrap())
        .await
        .unwrap()
}

#[cfg(test)]
mod tests {
    use rocket::tokio;
    use rocket_db_pools::deadpool_redis::{Config as RedisPoolConfig, Runtime};

    use crate::{
        chartos::redis_utils::{delete, get, keys, set},
        client::RedisConfig,
        db_connection::RedisPool,
    };

    fn create_redis_pool() -> RedisPool {
        let cfg = RedisPoolConfig::from_url(
            RedisConfig {
                ..Default::default()
            }
            .redis_url,
        );
        let pool = cfg.create_pool(Some(Runtime::Tokio1)).unwrap();
        RedisPool(pool)
    }

    #[tokio::test]
    async fn test_redis_set_get_list_delete() {
        let redis_pool = create_redis_pool();
        // Check redis empty
        let test_keys = keys(&redis_pool, "test_*").await.unwrap();
        assert!(test_keys.is_empty());
        // Add two keys and check presence
        set(&redis_pool, "test_1", "value_1").await.unwrap();
        set(&redis_pool, "test_2", "value_2").await.unwrap();
        let mut test_keys = keys(&redis_pool, "test_*").await.unwrap();
        test_keys.sort();
        assert_eq!(test_keys, vec!["test_1", "test_2"]);
        // Get value 1
        let value_1 = get::<String>(&redis_pool, "test_1").await.unwrap();
        assert_eq!("value_1", value_1);
        // Get nonexisting key
        let does_not_exist = get::<Vec<u8>>(&redis_pool, "does_not_exist").await;
        assert!(does_not_exist.is_none());
        // Set and get empty vec
        let empty_vec: Vec<u8> = vec![];
        set(&redis_pool, "test_empty", empty_vec.clone())
            .await
            .unwrap();
        let test_empty = get::<Vec<u8>>(&redis_pool, "test_empty").await;
        assert!(test_empty.is_some());
        assert_eq!(test_empty.unwrap(), empty_vec);
        // Delete two keys and check absence
        let result = delete(
            &redis_pool,
            vec![
                String::from("test_1"),
                String::from("test_2"),
                String::from("test_empty"),
            ],
        )
        .await
        .unwrap();
        assert_eq!(result, 3);
        let test_keys = keys(&redis_pool, "test_*").await.unwrap();
        assert!(test_keys.is_empty());
    }
}
