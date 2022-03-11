use super::{ObjectType, TrackSection};
use diesel::{sql_query, PgConnection, RunQueryDsl};
use rocket::serde::Deserialize;

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
}

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde", tag = "obj_type")]
pub enum CreateOperation {
    TrackSection { railjson: TrackSection },
}

impl CreateOperation {
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) {
        unimplemented!()
    }
}

#[derive(Clone, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct UpdateOperation {}

impl UpdateOperation {
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) {
        unimplemented!()
    }
}
