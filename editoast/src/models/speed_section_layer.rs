use crate::schema::osrd_infra_speedsectionlayer;
use crate::schema::osrd_infra_speedsectionlayer::dsl::*;
use diesel::result::Error;
use diesel::sql_types::{Integer, Text};
use diesel::{delete, prelude::*, sql_query};
use rocket::serde::Serialize;

#[derive(QueryableByName, Queryable, Debug, Serialize)]
#[serde(crate = "rocket::serde")]
#[table_name = "osrd_infra_speedsectionlayer"]
pub struct SpeedSectionLayer {
    pub id: i32,
    pub infra_id: i32,
    pub obj_id: String,
}

impl SpeedSectionLayer {
    /// Clear track section layer of a given infra id
    pub fn clear(conn: &PgConnection, infra: i32) -> Result<usize, Error> {
        delete(osrd_infra_speedsectionlayer.filter(infra_id.eq(infra))).execute(conn)
    }

    /// Generate speed section layer of a given infra id
    pub fn generate(conn: &PgConnection, infra: i32) -> Result<usize, Error> {
        sql_query(include_str!("sql/generate_speed_section_layer.sql"))
            .bind::<Integer, _>(infra)
            .execute(conn)
    }

    pub fn update(conn: &PgConnection, infra: i32, obj_ids: &Vec<String>) -> Result<usize, Error> {
        let obj_ids = obj_ids.join(",");
        sql_query("DELETE FROM osrd_infra_speedsectionlayer WHERE infra_id = $1 AND obj_id in ($2)")
            .bind::<Integer, _>(infra)
            .bind::<Text, _>(&obj_ids)
            .execute(conn)?;
        sql_query(include_str!("sql/update_speed_section_layer.sql"))
            .bind::<Integer, _>(infra)
            .bind::<Text, _>(&obj_ids)
            .execute(conn)
    }
}
