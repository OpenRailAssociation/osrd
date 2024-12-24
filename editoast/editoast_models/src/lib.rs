pub mod db_connection_pool;
pub mod model;
pub mod tables;

pub use db_connection_pool::DbConnection;
pub use db_connection_pool::DbConnectionPoolV2;

/// Generic error type to forward errors from the database
///
/// Useful for functions which only points of failure are the DB calls.
#[derive(Debug, thiserror::Error)]
#[error("an error occurred while querying the database: {0}")]
pub struct DatabaseError(#[from] diesel::result::Error);
