pub mod client;
pub mod connection;

pub use client::Client;
pub use client::Config;
pub use connection::Connection;
pub use deadpool_redis::redis::RedisError;

pub type Error = RedisError;
