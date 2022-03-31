use crate::railjson::operation::{Operation, RailjsonObject, UpdateOperation};
use crate::railjson::{ObjectRef, ObjectType};
use crate::schema::osrd_infra_tracksectionlayer;
use crate::schema::osrd_infra_tracksectionlayer::dsl::*;
use diesel::result::Error;
use diesel::sql_types::{Integer, Text};
use diesel::{delete, prelude::*, sql_query};
use itertools::Itertools;
use serde::Serialize;
use std::collections::HashSet;

#[derive(QueryableByName, Queryable, Debug, Serialize)]
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

    /// Generate track section layer of a given infra id
    pub fn generate(conn: &PgConnection, infra: i32) -> Result<usize, Error> {
        sql_query(include_str!("sql/generate_track_section_layer.sql"))
            .bind::<Integer, _>(infra)
            .execute(conn)
    }

    fn update_list(
        conn: &PgConnection,
        infra: i32,
        obj_ids: &HashSet<String>,
    ) -> Result<(), Error> {
        let obj_ids = obj_ids.iter().join(",");
        sql_query(
            "DELETE FROM osrd_infra_tracksectionlayer WHERE infra_id = $1 AND obj_id in ($2)",
        )
        .bind::<Integer, _>(infra)
        .bind::<Text, _>(&obj_ids)
        .execute(conn)?;
        sql_query(include_str!("sql/update_track_section_layer.sql"))
            .bind::<Integer, _>(infra)
            .bind::<Text, _>(&obj_ids)
            .execute(conn)?;
        Ok(())
    }

    pub fn update(
        conn: &PgConnection,
        infra: i32,
        operations: &Vec<Operation>,
    ) -> Result<(), Error> {
        // Search all signals that needs to be refreshed
        let mut obj_ids = HashSet::new();
        for op in operations {
            match op {
                Operation::Create(RailjsonObject::TrackSection { railjson }) => {
                    obj_ids.insert(railjson.id.clone());
                }
                Operation::Update(UpdateOperation {
                    obj_id: track_id,
                    obj_type: ObjectType::TrackSection,
                    ..
                })
                | Operation::Delete(ObjectRef {
                    obj_id: track_id,
                    obj_type: ObjectType::TrackSection,
                }) => {
                    obj_ids.insert(track_id.clone());
                }
                _ => (),
            }
        }
        // Update layer
        Self::update_list(conn, infra, &obj_ids)
    }
}
