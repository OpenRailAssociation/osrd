use crate::railjson::{ObjectRef, ObjectType};
use diesel::sql_types::{Integer, Text};
use diesel::PgConnection;
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Default)]
pub struct InfraCache {
    pub track_sections_dependencies: HashMap<String, Vec<ObjectRef>>,
}

#[derive(QueryableByName)]
struct ResultObjRef {
    #[sql_type = "Text"]
    obj_id: String,
    #[sql_type = "Text"]
    ref_id: String,
}

impl InfraCache {
    fn add_refs(&mut self, refs: Vec<ResultObjRef>, obj_type: ObjectType) {
        for objref in refs.iter() {
            self.track_sections_dependencies
                .entry(objref.ref_id.clone())
                .or_insert(Default::default())
                .push(ObjectRef::new(obj_type.clone(), objref.obj_id.clone()));
        }
    }

    pub fn init(conn: &PgConnection, infra_id: i32) -> InfraCache {
        let mut infra_cache = Self::default();

        // Load signal tracks references
        infra_cache.add_refs(sql_query(
            "SELECT obj_id, data->'track'->'id' AS ref_id FROM osrd_infra_signalmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load(conn).expect("Error loading signal refs"), ObjectType::Signal);

        // Load speed sections tracks references
        infra_cache.add_refs(sql_query(
            "SELECT obj_id, jsonb_array_elements(data->'track_ranges')->'track'->'id' AS ref_id FROM osrd_infra_speedsectionmodel WHERE infra_id = $1")
        .bind::<Integer, _>(infra_id)
        .load(conn).expect("Error loading signal refs"), ObjectType::SpeedSection);

        infra_cache
    }

    pub fn get_tracks_dependencies(
        &self,
        track_id: &String,
        dependencies: &mut HashMap<ObjectType, HashSet<String>>,
    ) {
        if let Some(deps) = self.track_sections_dependencies.get(track_id) {
            for d in deps.iter() {
                dependencies
                    .entry(d.obj_type.clone())
                    .or_insert(Default::default())
                    .insert(d.obj_id.clone());
            }
        }
    }
}
