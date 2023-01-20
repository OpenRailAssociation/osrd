pub use super::bounding_box::{BoundingBox, InvalidationZone};
pub use super::map_layers::{Layer, MapLayers};
use crate::db_connection::RedisPool;
use redis::RedisError;
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

#[cfg(test)]
mod tests {
    use redis::RedisError;
    use rocket::tokio;
    use rocket_db_pools::deadpool_redis::{redis::cmd, Config as RedisPoolConfig, Runtime};

    use crate::{
        chartos::redis_utils::{delete, keys},
        client::RedisConfig,
        db_connection::RedisPool,
    };

    async fn set(redis_pool: &RedisPool, key: &str, value: &str) -> Result<(), RedisError> {
        cmd("SET")
            .arg(key)
            .arg(value)
            .query_async::<_, ()>(&mut redis_pool.get().await.unwrap())
            .await
    }

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
    async fn test_set_list_and_delete_key() {
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
        // Delete two keys and check absence
        let result = delete(
            &redis_pool,
            vec![String::from("test_1"), String::from("test_2")],
        )
        .await
        .unwrap();
        assert_eq!(result, 2);
        let test_keys = keys(&redis_pool, "test_*").await.unwrap();
        assert!(test_keys.is_empty());
    }
}
