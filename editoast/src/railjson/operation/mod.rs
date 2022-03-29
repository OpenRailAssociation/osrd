mod create;
mod delete;
mod update;

use super::{ObjectType, TrackSection};
use crate::response::ApiError;
use diesel::result::Error as DieselError;
use diesel::PgConnection;
use json_patch::PatchError;
use rocket::http::Status;
use serde::Deserialize;
use serde_json::Error as SerdeError;
use thiserror::Error;

pub use create::CreateOperation;
pub use delete::DeleteOperation;
pub use update::UpdateOperation;

#[derive(Clone, Deserialize)]
#[serde(tag = "type")]
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
            OperationError::ObjectNotFound(_) => "editoast:operation:NotFound",
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
    pub fn apply(&self, infra_id: i32, conn: &PgConnection) -> Result<(), Box<dyn ApiError>> {
        match self {
            Operation::Delete(delete) => delete.apply(infra_id, conn),
            Operation::Create(create) => create.apply(infra_id, conn),
            Operation::Update(update) => update.apply(infra_id, conn),
        }
    }
}
