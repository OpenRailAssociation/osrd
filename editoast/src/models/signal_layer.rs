use crate::schema::osrd_infra_signallayer;
use crate::schema::osrd_infra_signallayer::dsl::*;
use diesel::prelude::*;
use diesel::result::Error;
use diesel::sql_types::Integer;
use diesel::{delete, sql_query};
use rocket::serde::Serialize;

#[derive(QueryableByName, Queryable, Debug, Serialize)]
#[serde(crate = "rocket::serde")]
#[table_name = "osrd_infra_signallayer"]
pub struct SignalLayer {
    pub id: i32,
    pub infra_id: i32,
    pub obj_id: String,
}

impl SignalLayer {
    /// Clear track section layer of a given infra id
    pub fn clear(conn: &PgConnection, infra: i32) -> Result<usize, Error> {
        delete(osrd_infra_signallayer.filter(infra_id.eq(infra))).execute(conn)
    }

    pub fn generate(conn: &PgConnection, infra: i32) -> Result<usize, Error> {
        sql_query(include_str!("sql/generate_signal_layer.sql"))
            .bind::<Integer, _>(infra)
            .execute(conn)
    }
}
