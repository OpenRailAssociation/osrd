use crate::client::ChartosConfig;
use crate::railjson::operation::{DeleteOperation, Operation, UpdateOperation};
use crate::railjson::ObjectType;
use crate::schema::osrd_infra_tracksectionlayer;
use crate::schema::osrd_infra_tracksectionlayer::dsl::*;
use diesel::result::Error;
use diesel::sql_types::{Array, Integer, Text};
use diesel::{delete, prelude::*, sql_query};
use serde::Serialize;
use std::collections::HashSet;

use super::invalidate_chartos_layer;

#[derive(QueryableByName, Queryable, Debug, Serialize)]
#[table_name = "osrd_infra_tracksectionlayer"]
pub struct TrackSectionLayer {
    pub id: i32,
    pub infra_id: i32,
    pub obj_id: String,
}

impl TrackSectionLayer {
    /// Clear and regenerate fully the track sections layer of a given infra id
    pub fn refresh(
        conn: &PgConnection,
        infra: i32,
        chartos_config: &ChartosConfig,
    ) -> Result<(), Error> {
        delete(osrd_infra_tracksectionlayer.filter(infra_id.eq(infra))).execute(conn)?;
        sql_query(include_str!("sql/generate_track_section_layer.sql"))
            .bind::<Integer, _>(infra)
            .execute(conn)?;
        invalidate_chartos_layer(infra, "track_sections", chartos_config);
        Ok(())
    }

    fn update_list(conn: &PgConnection, infra: i32, obj_ids: HashSet<String>) -> Result<(), Error> {
        let obj_ids: Vec<String> = obj_ids.into_iter().collect();

        sql_query(
            "DELETE FROM osrd_infra_tracksectionlayer WHERE infra_id = $1 AND obj_id = ANY($2)",
        )
        .bind::<Integer, _>(infra)
        .bind::<Array<Text>, _>(&obj_ids)
        .execute(conn)?;

        sql_query(include_str!("sql/update_track_section_layer.sql"))
            .bind::<Integer, _>(infra)
            .bind::<Array<Text>, _>(&obj_ids)
            .execute(conn)?;
        Ok(())
    }

    /// Search and update all track sections that needs to be refreshed given a list of operation.
    pub fn update(
        conn: &PgConnection,
        infra: i32,
        operations: &Vec<Operation>,
        chartos_config: &ChartosConfig,
    ) -> Result<(), Error> {
        let mut obj_ids = HashSet::new();
        for op in operations {
            match op {
                Operation::Create(rjs_obj)
                    if rjs_obj.get_obj_type() == ObjectType::TrackSection =>
                {
                    obj_ids.insert(rjs_obj.get_obj_id().clone());
                }
                Operation::Update(UpdateOperation {
                    obj_id: track_id,
                    obj_type: ObjectType::TrackSection,
                    ..
                })
                | Operation::Delete(DeleteOperation {
                    obj_id: track_id,
                    obj_type: ObjectType::TrackSection,
                }) => {
                    obj_ids.insert(track_id.clone());
                }
                _ => (),
            }
        }
        if obj_ids.is_empty() {
            // No update needed
            return Ok(());
        }
        Self::update_list(conn, infra, obj_ids)?;
        invalidate_chartos_layer(infra, "track_sections", chartos_config);
        Ok(())
    }
}
