use crate::client::ChartosConfig;
use crate::infra_cache::InfraCache;
use crate::railjson::operation::{DeleteOperation, Operation, UpdateOperation};
use crate::railjson::ObjectType;
use crate::schema::osrd_infra_tracksectionlinklayer;
use crate::schema::osrd_infra_tracksectionlinklayer::dsl::*;
use diesel::result::Error;
use diesel::sql_types::{Array, Integer, Text};
use diesel::{delete, prelude::*, sql_query};
use serde::Serialize;
use std::collections::HashSet;

use super::invalidate_chartos_layer;

#[derive(QueryableByName, Queryable, Debug, Serialize)]
#[table_name = "osrd_infra_tracksectionlinklayer"]
pub struct TrackLinkLayer {
    pub id: i32,
    pub infra_id: i32,
    pub obj_id: String,
}

impl TrackLinkLayer {
    /// Clear and regenerate fully the track_link sections layer of a given infra id
    pub fn refresh(
        conn: &PgConnection,
        infra: i32,
        chartos_config: &ChartosConfig,
    ) -> Result<(), Error> {
        delete(osrd_infra_tracksectionlinklayer.filter(infra_id.eq(infra))).execute(conn)?;
        sql_query(include_str!("sql/generate_track_link_layer.sql"))
            .bind::<Integer, _>(infra)
            .execute(conn)?;
        invalidate_chartos_layer(infra, "track_section_links", chartos_config);
        Ok(())
    }

    fn update_list(conn: &PgConnection, infra: i32, obj_ids: HashSet<String>) -> Result<(), Error> {
        let obj_ids: Vec<String> = obj_ids.into_iter().collect();

        sql_query(
            "DELETE FROM osrd_infra_tracksectionlinklayer WHERE infra_id = $1 AND obj_id = ANY($2)",
        )
        .bind::<Integer, _>(infra)
        .bind::<Array<Text>, _>(&obj_ids)
        .execute(conn)?;

        sql_query(include_str!("sql/update_track_link_layer.sql"))
            .bind::<Integer, _>(infra)
            .bind::<Array<Text>, _>(&obj_ids)
            .execute(conn)?;
        Ok(())
    }

    fn fill_track_link_track_refs(
        infra_cache: &InfraCache,
        track_id: &String,
        results: &mut HashSet<String>,
    ) {
        infra_cache
            .get_track_refs_type(track_id, ObjectType::TrackLink)
            .iter()
            .for_each(|obj_ref| {
                results.insert(obj_ref.obj_id.clone());
            });
    }

    /// Search and update all track links that needs to be refreshed given a list of operation.
    pub fn update(
        conn: &PgConnection,
        infra: i32,
        operations: &Vec<Operation>,
        infra_cache: &mut InfraCache,
        chartos_config: &ChartosConfig,
    ) -> Result<(), Error> {
        let mut obj_ids = HashSet::new();
        for op in operations {
            match op {
                Operation::Create(rjs_obj) => match rjs_obj.get_obj_type() {
                    ObjectType::TrackSection => {
                        Self::fill_track_link_track_refs(
                            infra_cache,
                            &rjs_obj.get_obj_id(),
                            &mut obj_ids,
                        );
                    }
                    ObjectType::TrackLink => {
                        obj_ids.insert(rjs_obj.get_obj_id().clone());
                    }
                    _ => (),
                },
                Operation::Update(UpdateOperation {
                    obj_id: track_id,
                    obj_type: ObjectType::TrackSection,
                    ..
                }) => Self::fill_track_link_track_refs(infra_cache, track_id, &mut obj_ids),
                Operation::Delete(DeleteOperation {
                    obj_id: track_link_id,
                    obj_type: ObjectType::TrackLink,
                })
                | Operation::Update(UpdateOperation {
                    obj_id: track_link_id,
                    obj_type: ObjectType::TrackLink,
                    ..
                }) => {
                    obj_ids.insert(track_link_id.clone());
                }
                _ => (),
            }
        }
        if obj_ids.is_empty() {
            // No update needed
            return Ok(());
        }
        dbg!(&obj_ids);
        Self::update_list(conn, infra, obj_ids)?;
        invalidate_chartos_layer(infra, "track_links", chartos_config);
        Ok(())
    }
}
