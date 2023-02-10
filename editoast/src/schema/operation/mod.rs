pub mod create;
mod delete;
mod update;

use super::ObjectRef;
use crate::error::Result;
use diesel::PgConnection;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub use self::delete::DeleteOperation;
pub use create::RailjsonObject;
pub use update::UpdateOperation;

#[derive(Clone, Deserialize, Serialize)]
#[serde(tag = "operation_type", deny_unknown_fields)]
pub enum Operation {
    #[serde(rename = "CREATE")]
    Create(Box<RailjsonObject>),
    #[serde(rename = "UPDATE")]
    Update(UpdateOperation),
    #[serde(rename = "DELETE")]
    Delete(DeleteOperation),
}

#[derive(Clone, Serialize)]
#[serde(tag = "operation_type")]
pub enum OperationResult {
    #[serde(rename = "CREATE")]
    Create(RailjsonObject),
    #[serde(rename = "UPDATE")]
    Update(RailjsonObject),
    #[serde(rename = "DELETE")]
    Delete(ObjectRef),
}

impl Operation {
    pub fn apply(&self, infra_id: i64, conn: &mut PgConnection) -> Result<OperationResult> {
        match self {
            Operation::Delete(deletion) => {
                deletion.apply(infra_id, conn)?;
                Ok(OperationResult::Delete(deletion.clone().into()))
            }
            Operation::Create(railjson_object) => {
                create::apply_create_operation(railjson_object, infra_id, conn)?;
                Ok(OperationResult::Create(*railjson_object.clone()))
            }
            Operation::Update(update) => {
                let obj_railjson = update.apply(infra_id, conn)?;
                Ok(OperationResult::Update(obj_railjson))
            }
        }
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "operation")]
enum OperationError {
    // To modify
    #[error("Object '{0}', could not be found")]
    #[editoast_error(status = 404)]
    ObjectNotFound(String),
    #[error("Empty string id is forbidden")]
    EmptyId,
    #[error("Update operation try to modify object id, which is forbidden")]
    ModifyId,
    #[error("A Json Patch error occurred: '{}'", .0)]
    InvalidPatch(String),
}
