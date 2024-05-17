use diesel_async::{
    pooled_connection::{deadpool::Pool, AsyncDieselConnectionManager},
    AsyncPgConnection,
};

pub mod db_connection_error;
pub mod db_connection_pool;

pub use db_connection_error::DbConnectionError;
pub use db_connection_pool::DbConnectionPoolV2;

pub type DbConnection = AsyncPgConnection;
pub type DbConnectionPool = Pool<DbConnection>;
pub type DbConnectionConfig = AsyncDieselConnectionManager<AsyncPgConnection>;
