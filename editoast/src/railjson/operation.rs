use super::{ObjectType, TrackSection};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use rocket::serde::Deserialize;
use std::collections::{HashMap, HashSet};

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde", tag = "type")]
pub enum Operation {
    #[serde(rename = "CREATE")]
    Create(CreateOperation),
    #[serde(rename = "UPDATE")]
    Update(UpdateOperation),
    #[serde(rename = "DELETE")]
    Delete(DeleteOperation),
}

impl Operation {
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) {
        match self {
            Operation::Delete(delete) => delete.apply(infra_id, conn),
            Operation::Create(create) => create.apply(infra_id, conn),
            Operation::Update(update) => update.apply(infra_id, conn),
        }
    }

    pub fn get_updated_objects(&self, update_lists: &mut HashMap<ObjectType, HashSet<String>>) {
        match self {
            Operation::Delete(delete) => delete.get_updated_objects(update_lists),
            Operation::Create(create) => create.get_updated_objects(update_lists),
            Operation::Update(update) => update.get_updated_objects(update_lists),
        }
    }
}

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

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde", tag = "obj_type")]
pub enum CreateOperation {
    TrackSection { railjson: TrackSection },
}

impl CreateOperation {
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) {
        sql_query(format!(
            "INSERT INTO {} (infra_id, obj_id, data) VALUES ({}, '{}', '{}')",
            self.get_obj_type().get_table(),
            infra_id,
            self.get_obj_id(),
            self.get_data(),
        ))
        .execute(conn)
        .expect("An error occured while applying a deletion");
    }

    pub fn get_obj_type(&self) -> ObjectType {
        match self {
            CreateOperation::TrackSection { railjson: _ } => ObjectType::TrackSection,
        }
    }

    pub fn get_obj_id(&self) -> String {
        match self {
            CreateOperation::TrackSection { railjson } => railjson.id.clone(),
        }
    }

    pub fn get_data(&self) -> String {
        match self {
            CreateOperation::TrackSection { railjson } => serde_json::to_string(railjson).unwrap(),
        }
    }

    pub fn get_updated_objects(&self, update_lists: &mut HashMap<ObjectType, HashSet<String>>) {
        update_lists
            .entry(self.get_obj_type())
            .or_insert(Default::default())
            .insert(self.get_obj_id());
    }
}

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct UpdateOperation {}

impl UpdateOperation {
    pub fn apply(&self, _infra_id: i32, _conn: &PgConnection) {
        unimplemented!()
    }

    pub fn get_updated_objects(&self, _update_lists: &mut HashMap<ObjectType, HashSet<String>>) {
        unimplemented!()
    }
}
