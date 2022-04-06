mod create;
mod delete;
mod update;

use super::ObjectRef;
use crate::error::ApiError;
use diesel::result::Error as DieselError;
use diesel::PgConnection;
use json_patch::PatchError;
use rocket::http::Status;
use serde::{Deserialize, Serialize};
use serde_json::Error as SerdeError;
use thiserror::Error;

pub use create::RailjsonObject;
pub use update::UpdateOperation;

#[derive(Clone, Deserialize)]
#[serde(tag = "operation_type", deny_unknown_fields)]
pub enum Operation {
    #[serde(rename = "CREATE")]
    Create(Box<RailjsonObject>),
    #[serde(rename = "UPDATE")]
    Update(UpdateOperation),
    #[serde(rename = "DELETE")]
    Delete(ObjectRef),
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

#[derive(Debug, Error)]
pub enum OperationError {
    // To modify
    #[error("Object '{0}', could not be found")]
    ObjectNotFound(String),
    #[error("Update operation try to modify object id, which is forbidden")]
    ModifyId,
    #[error("An internal diesel error occurred: '{}'", .0.to_string())]
    DieselError(DieselError),
    #[error("A Json Patch error occurred: '{}'", .0.to_string())]
    JsonPatchError(PatchError),
    #[error("A Serde Json error occurred: '{}'", .0.to_string())]
    SerdeJsonError(SerdeError),
}

impl ApiError for OperationError {
    fn get_status(&self) -> Status {
        match self {
            OperationError::ObjectNotFound(_) => Status::NotFound,
            OperationError::ModifyId => Status::BadRequest,
            _ => Status::InternalServerError,
        }
    }

    fn get_type(&self) -> &'static str {
        match self {
            OperationError::ObjectNotFound(_) => "editoast:operation:ObjectNotFound",
            OperationError::ModifyId => "editoast:operation:ModifyId",
            OperationError::DieselError(_) => "editoast:operation:DieselError",
            OperationError::JsonPatchError(_) => "editoast:operation:JsonPatchError",
            OperationError::SerdeJsonError(_) => "editoast:operation:SerdeJsonError",
        }
    }
}

impl From<DieselError> for Box<dyn ApiError> {
    fn from(error: DieselError) -> Self {
        Box::new(OperationError::DieselError(error))
    }
}

impl From<PatchError> for Box<dyn ApiError> {
    fn from(error: PatchError) -> Self {
        Box::new(OperationError::JsonPatchError(error))
    }
}

impl From<SerdeError> for Box<dyn ApiError> {
    fn from(error: SerdeError) -> Self {
        Box::new(OperationError::SerdeJsonError(error))
    }
}

impl Operation {
    pub fn apply(
        &self,
        infra_id: i32,
        conn: &PgConnection,
    ) -> Result<OperationResult, Box<dyn ApiError>> {
        match self {
            Operation::Delete(object_ref) => {
                delete::apply_delete_operation(object_ref, infra_id, conn)?;
                Ok(OperationResult::Delete(object_ref.clone()))
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
