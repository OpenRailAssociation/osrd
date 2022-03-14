mod create;
mod delete;
mod update;

use crate::infra_cache::InfraCache;

use super::{ObjectType, TrackSection};
pub use create::CreateOperation;
pub use delete::DeleteOperation;
use diesel::PgConnection;
use rocket::serde::Deserialize;
use std::collections::{HashMap, HashSet};
pub use update::UpdateOperation;

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

    pub fn get_updated_objects(
        &self,
        update_lists: &mut HashMap<ObjectType, HashSet<String>>,
        infra_cache: &InfraCache,
    ) {
        match self {
            Operation::Delete(delete) => delete.get_updated_objects(update_lists),
            Operation::Create(create) => create.get_updated_objects(update_lists, infra_cache),
            Operation::Update(update) => update.get_updated_objects(update_lists, infra_cache),
        }
    }
}
