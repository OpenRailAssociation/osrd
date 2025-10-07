pub mod client;
pub mod connection;

pub use client::Client;
pub use client::Config;
pub use connection::Connection;
pub use deadpool_redis::redis::RedisError;

pub type Error = RedisError;

#[cfg(feature = "mock")]
pub use redis_test::MockCmd; // re-export MockCmd to avoid having to depend on redis-test directly
