use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::AsyncPgConnection;

pub mod db_connection_pool;
pub mod tables;

pub use db_connection_pool::DbConnection;
pub use db_connection_pool::DbConnectionPoolV2;

type DieselConnection = AsyncPgConnection;
pub type DbConnectionPool = Pool<DieselConnection>;

/// Generic error type to forward errors from the database
///
/// Useful for functions which only points of failure are the DB calls.
#[derive(Debug, thiserror::Error)]
#[error("an error occured while querying the database: {0}")]
pub struct DatabaseError(#[from] diesel::result::Error);
