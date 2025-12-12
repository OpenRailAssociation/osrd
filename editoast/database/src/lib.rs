pub mod db_connection_pool;
pub mod tables;
mod tables_patch;

pub use db_connection_pool::DatabasePoolError;
pub use db_connection_pool::DbConnection;
pub use db_connection_pool::DbConnectionPoolV2;

/// Generic error type to forward errors from the database
///
/// Useful for functions which only points of failure are the DB calls.
#[derive(Debug, thiserror::Error, PartialEq)]
pub enum DatabaseError {
    #[error("an error occurred while querying the database: {0}")]
    DieselError(#[source] diesel::result::Error),
    #[error("a unique constraint was violated while querying the database: {0}")]
    UniqueViolation(#[source] diesel::result::Error),
}

impl From<diesel::result::Error> for DatabaseError {
    fn from(error: diesel::result::Error) -> Self {
        match error {
            diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                _,
            ) => DatabaseError::UniqueViolation(error),
            _ => DatabaseError::DieselError(error),
        }
    }
}
