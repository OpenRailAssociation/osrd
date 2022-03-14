use super::ObjectType;
use diesel::{sql_query, PgConnection, RunQueryDsl};
use rocket::serde::Deserialize;
use std::collections::{HashMap, HashSet};

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct DeleteOperation {
    pub obj_type: ObjectType,
    pub obj_id: String,
}

impl DeleteOperation {
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) {
        sql_query(format!(
            "DELETE FROM {} WHERE obj_id = '{}' AND infra_id = {}",
            self.obj_type.get_table(),
            self.obj_id,
            infra_id
        ))
        .execute(conn)
        .expect("An error occured while applying a deletion");
    }

    pub fn get_updated_objects(&self, update_lists: &mut HashMap<ObjectType, HashSet<String>>) {
        update_lists
            .entry(self.obj_type.clone())
            .or_insert(Default::default())
            .insert(self.obj_id.clone());
    }
}
