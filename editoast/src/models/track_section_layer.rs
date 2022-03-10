use crate::schema::osrd_infra_tracksectionlayer;
use crate::schema::osrd_infra_tracksectionlayer::dsl::*;
use diesel::result::Error;
use diesel::{delete, prelude::*, sql_query};
use rocket::serde::Serialize;

#[derive(QueryableByName, Queryable, Debug, Serialize)]
#[serde(crate = "rocket::serde")]
#[table_name = "osrd_infra_tracksectionlayer"]
pub struct TrackSectionLayer {
    pub id: i32,
    pub infra_id: i32,
    pub obj_id: String,
}

impl TrackSectionLayer {
    /// Clear track section layer of a given infra id
    pub fn clear(conn: &PgConnection, infra: i32) -> Result<usize, Error> {
        delete(osrd_infra_tracksectionlayer.filter(infra_id.eq(infra))).execute(conn)
    }

    pub fn generate(conn: &PgConnection, infra: i32) -> Result<usize, Error> {
        sql_query(format!(
            "INSERT INTO osrd_infra_tracksectionlayer (obj_id, infra_id, geographic, schematic) 
        SELECT obj_id, {0}, ST_Transform(ST_GeomFromGeoJSON(data->'geo'), 3857), ST_Transform(ST_GeomFromGeoJSON(data->'sch'), 3857) FROM osrd_infra_tracksectionmodel WHERE infra_id={0}",
            infra
        ))
        .execute(conn)
    }
}
