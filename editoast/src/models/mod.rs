mod infra;

pub use infra::Infra;

use rocket_sync_db_pools::database;

#[database("postgres")]
pub struct DBConnection(pub diesel::PgConnection);
