use rocket_sync_db_pools::{database, diesel};

#[database("postgres")]
pub struct DBConnection(pub diesel::PgConnection);
