use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncPgConnection,
};

pub mod connection_error;
pub mod connection_pool;

pub use connection_error::DbConnectionError;
pub use connection_pool::DbConnectionPoolV2;

pub type DbConnection = AsyncPgConnection;
pub type DbConnectionPool = Pool<DbConnection>;
pub type DbConnectionConfig = AsyncDieselConnectionManager<AsyncPgConnection>;
