pub mod create;
mod delete;
mod update;

use super::ObjectRef;
use crate::error::Result;
use diesel_async::AsyncPgConnection as PgConnection;
use editoast_derive::EditoastError;
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub use self::delete::DeleteOperation;
pub use create::RailjsonObject;
pub use update::UpdateOperation;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
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
    pub async fn apply(&self, infra_id: i64, conn: &mut PgConnection) -> Result<OperationResult> {
        match self {
            Operation::Delete(deletion) => {
                deletion.apply(infra_id, conn).await?;
                Ok(OperationResult::Delete(deletion.clone().into()))
            }
            Operation::Create(railjson_object) => {
                create::apply_create_operation(railjson_object, infra_id, conn).await?;
                Ok(OperationResult::Create(*railjson_object.clone()))
            }
            Operation::Update(update) => {
                let obj_railjson = update.apply(infra_id, conn).await?;
                Ok(OperationResult::Update(obj_railjson))
            }
        }
    }
}

#[derive(Debug, Error, EditoastError)]
#[editoast_error(base_id = "operation")]
enum OperationError {
    // To modify
    #[error("Object '{obj_id}', could not be found in the infrastructure '{infra_id}'")]
    #[editoast_error(status = 404)]
    ObjectNotFound { obj_id: String, infra_id: i64 },
    #[error("Empty string id is forbidden")]
    EmptyId,
    #[error("Update operation try to modify object id, which is forbidden")]
    ModifyId,
    #[error("A Json Patch error occurred: '{}'", .0)]
    InvalidPatch(String),
}

impl From<&Operation> for OperationResult {
    fn from(op: &Operation) -> Self {
        match op {
            Operation::Delete(deletion) => OperationResult::Delete(deletion.clone().into()),
            Operation::Create(railjson_object) => OperationResult::Create(*railjson_object.clone()),
            Operation::Update(_update) => todo!(),
        }
    }
}
