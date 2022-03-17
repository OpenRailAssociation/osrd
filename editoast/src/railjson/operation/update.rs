use super::ObjectType;
use crate::infra_cache::InfraCache;
use crate::railjson::TrackSection;
use diesel::sql_types::Jsonb;
use diesel::{sql_query, PgConnection, QueryableByName, RunQueryDsl};
use json_patch::Patch;
use rocket::serde::Deserialize;
use serde_json::{from_value, to_string, Value};
use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::fmt;

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct UpdateOperation {
    obj_id: String,
    obj_type: ObjectType,
    railjson_patch: Patch,
}

impl UpdateOperation {
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) {
        // Load object
        let mut obj: DataObject = sql_query(format!(
            "SELECT data FROM {} WHERE infra_id = {} AND obj_id = '{}'",
            self.obj_type.get_table(),
            infra_id,
            self.obj_id
        ))
        .get_result(conn)
        .expect("An error occured looking for the object to update.");

        // Apply and check patch
        obj.patch_and_check(self)
            .expect("An error occurred patching object");

        // Save new object
        sql_query(format!(
            "UPDATE {} SET data = '{}' WHERE infra_id = {} AND obj_id = '{}'",
            self.obj_type.get_table(),
            to_string(&obj.data).unwrap(),
            infra_id,
            self.obj_id,
        ))
        .execute(conn)
        .expect("Object update failed");
    }

    pub fn get_updated_objects(
        &self,
        update_lists: &mut HashMap<ObjectType, HashSet<String>>,
        infra_cache: &InfraCache,
    ) {
        update_lists
            .entry(self.obj_type.clone())
            .or_insert(Default::default())
            .insert(self.obj_id.clone());

        if self.obj_type == ObjectType::TrackSection {
            infra_cache.get_tracks_dependencies(&self.obj_id, update_lists);
        }
    }
}

#[derive(QueryableByName)]
struct DataObject {
    #[sql_type = "Jsonb"]
    data: Value,
}

#[derive(Debug)]
enum UpdateError {
    PatchChangeObjID,
}

impl fmt::Display for UpdateError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            UpdateError::PatchChangeObjID => write!(
                f,
                "Update operation is modifies object id, which is forbidden",
            ),
        }
    }
}

impl Error for UpdateError {}

impl DataObject {
    /// This function will patch the data object given an update operation.
    /// It will also check that the id of the id of the object is untouched and that the resulted data is valid.
    pub fn patch_and_check(&mut self, update: &UpdateOperation) -> Result<(), Box<dyn Error>> {
        json_patch::patch(&mut self.data, &update.railjson_patch)?;
        let check_id = match update.obj_type {
            ObjectType::TrackSection => from_value::<TrackSection>(self.data.clone())?.id,
            ObjectType::Signal => todo!(),
            ObjectType::SpeedSection => todo!(),
        };

        if check_id != update.obj_id {
            return Err(Box::new(UpdateError::PatchChangeObjID));
        }
        Ok(())
    }
}
