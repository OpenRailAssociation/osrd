use diesel_async::{pooled_connection::deadpool::Pool, AsyncPgConnection};

mod db_connection_pool;
mod error;

pub use db_connection_pool::create_connection_pool;
pub use db_connection_pool::DbConnectionPoolV2;
pub use error::EditoastModelsError;

pub type DbConnection = AsyncPgConnection;
pub type DbConnectionPool = Pool<DbConnection>;
