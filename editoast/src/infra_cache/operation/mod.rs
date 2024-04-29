pub mod create;
mod delete;
mod update;

use std::ops::Deref as _;

pub use create::RailjsonObject;
use editoast_derive::EditoastError;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
pub use update::UpdateOperation;
use utoipa::ToSchema;

pub use self::delete::DeleteOperation;
use crate::error::Result;
use crate::infra_cache::ObjectCache;
use crate::modelsv2::Connection;
use editoast_schemas::primitives::OSRDObject as _;
use editoast_schemas::primitives::ObjectRef;

editoast_common::schemas! { Operation, }

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(tag = "operation_type", deny_unknown_fields)]
pub enum Operation {
    #[serde(rename = "CREATE")]
    #[schema(value_type = RailjsonObject)]
    Create(Box<RailjsonObject>),
    #[serde(rename = "UPDATE")]
    Update(UpdateOperation),
    #[serde(rename = "DELETE")]
    Delete(DeleteOperation),
}

#[derive(Clone)]
pub enum CacheOperation {
    Create(ObjectCache),
    Update(ObjectCache),
    Delete(ObjectRef),
}

impl CacheOperation {
    pub fn try_from_operation(
        operation: &Operation,
        railjson_object: RailjsonObject,
    ) -> Result<Self> {
        let cache_operation = match operation {
            Operation::Create(new_railjson_object) => {
                debug_assert_eq!(new_railjson_object.get_ref(), railjson_object.get_ref());
                CacheOperation::Create(ObjectCache::from(new_railjson_object.deref().clone()))
            }
            Operation::Update(UpdateOperation { railjson_patch, .. }) => {
                let railjson_object = railjson_object.patch(railjson_patch)?;
                CacheOperation::Update(ObjectCache::from(railjson_object))
            }
            Operation::Delete(delete_operation) => {
                let object_ref = ObjectRef::from(delete_operation.clone());
                debug_assert_eq!(object_ref, railjson_object.get_ref());
                CacheOperation::Delete(object_ref)
            }
        };
        Ok(cache_operation)
    }
}

impl Operation {
    pub async fn apply(
        &self,
        infra_id: i64,
        conn: &mut Connection,
    ) -> Result<Option<RailjsonObject>> {
        match self {
            Operation::Delete(deletion) => {
                deletion.apply(infra_id, conn).await?;
                Ok(None)
            }
            Operation::Create(railjson_object) => {
                create::apply_create_operation(railjson_object, infra_id, conn).await?;
                Ok(Some(railjson_object.deref().clone()))
            }
            Operation::Update(update) => {
                let railjson_object = update.apply(infra_id, conn).await?;
                Ok(Some(railjson_object))
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
    #[error("A Json Patch error occurred: '{error}'")]
    InvalidPatch { error: String },
}
