use super::ObjectType;
use crate::{infra_cache::InfraCache, railjson::change::TrackSectionChange};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use rocket::serde::Deserialize;
use serde_json::to_string;
use std::collections::{HashMap, HashSet};

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde", tag = "obj_type")]
pub enum UpdateOperation {
    TrackSection {
        obj_id: String,
        railjson: TrackSectionChange,
    },
}

impl UpdateOperation {
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) {
        sql_query(format!(
            "UPDATE {} SET data = data || '{}' WHERE infra_id = {} AND obj_id = '{}'",
            self.get_obj_type().get_table(),
            self.get_data_change(),
            infra_id,
            self.get_obj_id()
        ))
        .execute(conn)
        .expect("An error occured while applying a update");
    }

    pub fn get_updated_objects(
        &self,
        update_lists: &mut HashMap<ObjectType, HashSet<String>>,
        infra_cache: &InfraCache,
    ) {
        update_lists
            .entry(self.get_obj_type())
            .or_insert(Default::default())
            .insert(self.get_obj_id());

        if self.get_obj_type() == ObjectType::TrackSection {
            infra_cache.get_tracks_dependencies(&self.get_obj_id(), update_lists);
        }
    }

    pub fn get_obj_type(&self) -> ObjectType {
        match self {
            UpdateOperation::TrackSection { .. } => ObjectType::TrackSection,
        }
    }

    pub fn get_obj_id(&self) -> String {
        match self {
            UpdateOperation::TrackSection { obj_id, .. } => obj_id.clone(),
        }
    }

    pub fn get_data_change(&self) -> String {
        match self {
            UpdateOperation::TrackSection { railjson, .. } => to_string(railjson).unwrap(),
        }
    }
}
