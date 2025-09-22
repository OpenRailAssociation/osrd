pub mod client;
pub mod connection;

pub use client::ValkeyClient;
pub use client::ValkeyConfig;
pub use connection::Connection;
pub use deadpool_redis::redis::RedisError;

pub type Error = RedisError;
