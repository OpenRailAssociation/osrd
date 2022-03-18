mod create;
mod delete;
mod update;

use crate::infra_cache::InfraCache;

use super::{ObjectType, TrackSection};
use crate::response::ApiError;
pub use create::CreateOperation;
pub use delete::DeleteOperation;
use diesel::result::Error as DieselError;
use diesel::PgConnection;
use rocket::serde::Deserialize;
use std::collections::{HashMap, HashSet};
use thiserror::Error;
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

#[derive(Debug, Error)]
pub enum OperationError {
    // To modify
    #[error("Tracksection '{0}', could not be found")]
    NotFound(String),
    #[error("An internal diesel error occurred: '{}'", .0.to_string())]
    Other(DieselError),
}

impl ApiError for OperationError {
    fn get_code(&self) -> u16 {
        match self {
            OperationError::NotFound(_) => 404,
            OperationError::Other(_) => 500,
        }
    }

    fn get_type(&self) -> &'static str {
        match self {
            OperationError::NotFound(_) => "editoast:operation:NotFound",
            OperationError::Other(_) => "editoast:operation:Other",
        }
    }
}

impl Operation {
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) -> Result<(), Box<dyn ApiError>> {
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
