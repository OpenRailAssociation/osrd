use crate::infra_cache::InfraCache;
use crate::models::DBConnection;
use crate::railjson::operation::{CreateOperation, DeleteOperation, Operation, UpdateOperation};
use crate::railjson::ObjectType;
use crate::schema::osrd_infra_speedsectionlayer;
use crate::schema::osrd_infra_speedsectionlayer::dsl::*;
use diesel::result::Error;
use diesel::sql_types::{Integer, Text};
use diesel::{delete, prelude::*, sql_query};
use itertools::Itertools;
use rocket::serde::Serialize;
use std::collections::HashSet;
use std::ops::Deref;
use std::sync::{Arc, Mutex};

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

    fn update_list(
        conn: &PgConnection,
        infra: i32,
        obj_ids: &HashSet<String>,
    ) -> Result<(), Error> {
        let obj_ids = obj_ids.iter().join(",");
        sql_query(
            "DELETE FROM osrd_infra_speedsectionlayer WHERE infra_id = $1 AND obj_id in ($2)",
        )
        .bind::<Integer, _>(infra)
        .bind::<Text, _>(&obj_ids)
        .execute(conn)?;
        sql_query(include_str!("sql/update_speed_section_layer.sql"))
            .bind::<Integer, _>(infra)
            .bind::<Text, _>(&obj_ids)
            .execute(conn)?;
        Ok(())
    }

    fn fill_speed_section_track_refs(
        infra_cache: &InfraCache,
        track_id: &String,
        results: &mut HashSet<String>,
    ) {
        infra_cache
            .get_track_refs_type(track_id, ObjectType::SpeedSection)
            .iter()
            .for_each(|obj_ref| {
                results.insert(obj_ref.obj_id.clone());
            });
    }

    pub async fn update(
        conn: &DBConnection,
        infra: i32,
        operations: &Vec<Operation>,
        infra_cache: Arc<Mutex<InfraCache>>,
    ) -> Result<(), Error> {
        // Search all signals that needs to be refreshed
        let mut obj_ids = HashSet::new();
        {
            let infra_cache = infra_cache.lock().unwrap();
            for op in operations {
                match op {
                    Operation::Create(CreateOperation::TrackSection { railjson }) => {
                        Self::fill_speed_section_track_refs(
                            infra_cache.deref(),
                            &railjson.id,
                            &mut obj_ids,
                        )
                    }
                    Operation::Update(UpdateOperation {
                        obj_id: track_id,
                        obj_type: ObjectType::TrackSection,
                        ..
                    }) => Self::fill_speed_section_track_refs(
                        infra_cache.deref(),
                        track_id,
                        &mut obj_ids,
                    ),
                    Operation::Delete(DeleteOperation {
                        obj_id: speed_section_id,
                        obj_type: ObjectType::SpeedSection,
                    })
                    | Operation::Update(UpdateOperation {
                        obj_id: speed_section_id,
                        obj_type: ObjectType::SpeedSection,
                        ..
                    }) => {
                        obj_ids.insert(speed_section_id.clone());
                    }
                    _ => (),
                }
            }
        }
        // Update layer
        conn.run(move |c| Self::update_list(c, infra, &obj_ids))
            .await
    }
}
