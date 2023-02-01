use rocket_db_pools::{deadpool_redis, Database};
use rocket_sync_db_pools::{database, diesel};

#[database("postgres")]
pub struct DBConnection(pub diesel::PgConnection);

#[derive(Database)]
#[database("redis")]
pub struct RedisPool(pub deadpool_redis::Pool);
