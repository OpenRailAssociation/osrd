use crate::railjson::{ObjectRef, ObjectType};
use diesel::sql_types::{Integer, Text};
use diesel::PgConnection;
use diesel::{sql_query, QueryableByName, RunQueryDsl};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Default)]
pub struct InfraCache {
    track_sections_refs: HashMap<String, HashSet<ObjectRef>>,
}

#[derive(QueryableByName)]
struct ObjRefLink {
    #[sql_type = "Text"]
    obj_id: String,
    #[sql_type = "Text"]
    ref_id: String,
}

impl InfraCache {
    fn add_refs(&mut self, refs: Vec<ObjRefLink>, obj_type: ObjectType) {
        for link in refs.iter() {
            self.track_sections_refs
                .entry(link.ref_id.clone())
                .or_insert(Default::default())
                .insert(ObjectRef::new(obj_type.clone(), link.obj_id.clone()));
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

    pub fn get_track_refs_type(&self, track_id: &String, obj_type: ObjectType) -> Vec<&ObjectRef> {
        if let Some(refs) = self.track_sections_refs.get(track_id) {
            refs.iter()
                .filter(|obj_ref| obj_ref.obj_type == obj_type)
                .collect()
        } else {
            vec![]
        }
    }
}
