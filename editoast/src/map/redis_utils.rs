pub use super::bounding_box::{BoundingBox, InvalidationZone};
pub use super::layers::{Layer, MapLayers};
use crate::error::Result;
use redis::aio::ConnectionManager;
use redis::{cmd, FromRedisValue, ToRedisArgs};

pub async fn keys(redis: &mut ConnectionManager, key_pattern: &str) -> Result<Vec<String>> {
    Ok(cmd("KEYS")
        .arg(key_pattern)
        .query_async::<_, Vec<String>>(redis)
        .await?)
}

pub async fn delete(redis: &mut ConnectionManager, keys_to_delete: Vec<String>) -> Result<u64> {
    if keys_to_delete.is_empty() {
        return Ok(0);
    }
    let mut del = cmd("DEL");
    for key in keys_to_delete {
        del.arg(key);
    }
    Ok(del.query_async::<_, u64>(redis).await?)
}

pub async fn set<T: ToRedisArgs>(redis: &mut ConnectionManager, key: &str, value: T) -> Result<()> {
    Ok(cmd("SET")
        .arg(key)
        .arg(value)
        .query_async::<_, ()>(redis)
        .await?)
}

/// Gets Redis value associated to a  specific key
/// Returns None if key does not exists.
pub async fn get<T: Default + FromRedisValue>(
    redis: &mut ConnectionManager,
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
        set(&mut redis_pool, "test_1", "value_1").await.unwrap();
        set(&mut redis_pool, "test_2", "value_2").await.unwrap();
        let mut test_keys = keys(&mut redis_pool, "test_*").await.unwrap();
        test_keys.sort();
        assert_eq!(test_keys, vec!["test_1", "test_2"]);
        // Get value 1
        let value_1 = get::<String>(&mut redis_pool, "test_1").await.unwrap();
        assert_eq!("value_1", value_1);
        // Get nonexisting key
        let does_not_exist = get::<Vec<u8>>(&mut redis_pool, "does_not_exist").await;
        assert!(does_not_exist.is_none());
        // Set and get empty vec
        let empty_vec: Vec<u8> = vec![];
        set(&mut redis_pool, "test_empty", empty_vec.clone())
            .await
            .unwrap();
        let test_empty = get::<Vec<u8>>(&mut redis_pool, "test_empty").await;
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
    }
}
