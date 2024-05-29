pub mod create;
mod delete;
mod update;

use std::ops::Deref as _;

use editoast_derive::EditoastError;
use editoast_schemas::primitives::OSRDObject as _;
use json_patch::Patch;
use serde::Deserialize;
use serde::Serialize;
use thiserror::Error;
pub use update::UpdateOperation;
use utoipa::ToSchema;

pub use self::delete::DeleteOperation;
use crate::error::Result;
use crate::infra_cache::ObjectCache;
use crate::modelsv2::DbConnection;
use editoast_schemas::infra::InfraObject;
use editoast_schemas::primitives::ObjectRef;
use editoast_schemas::primitives::ObjectType;

editoast_common::schemas! {
    Operation,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, ToSchema)]
#[serde(tag = "operation_type", deny_unknown_fields)]
pub enum Operation {
    #[serde(rename = "CREATE")]
    #[schema(value_type = InfraObject)]
    Create(Box<InfraObject>),
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
    pub fn try_from_operation(operation: &Operation, infra_object: InfraObject) -> Result<Self> {
        let cache_operation = match operation {
            Operation::Create(new_railjson_object) => {
                debug_assert_eq!(new_railjson_object.get_ref(), infra_object.get_ref());
                CacheOperation::Create(ObjectCache::from(new_railjson_object.deref().clone()))
            }
            Operation::Update(UpdateOperation { railjson_patch, .. }) => {
                let railjson_object = patch_infra_object(&infra_object, railjson_patch)?;
                CacheOperation::Update(ObjectCache::from(railjson_object))
            }
            Operation::Delete(delete_operation) => {
                let object_ref = ObjectRef::from(delete_operation.clone());
                debug_assert_eq!(object_ref, infra_object.get_ref());
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
        conn: &mut DbConnection,
    ) -> Result<Option<InfraObject>> {
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

pub fn patch_infra_object(infra_object: &InfraObject, json_patch: &Patch) -> Result<InfraObject> {
    // `json_patch::patch()` operates on `serde_json::Value`.
    // Therefore, we have to:
    // (1) transform `RailjsonObject` into `serde_json::Value`,
    // (2) patch the object,
    // (3) transform `serde_json::Value` back into a `RailjsonObject`.
    // The code below is explicitely typed (even if not needed) to help understand this dance.
    let object_type = infra_object.get_type();
    let mut value: serde_json::Value = match &infra_object {
        InfraObject::TrackSection { railjson } => serde_json::to_value(railjson)?,
        InfraObject::Signal { railjson } => serde_json::to_value(railjson)?,
        InfraObject::NeutralSection { railjson } => serde_json::to_value(railjson)?,
        InfraObject::SpeedSection { railjson } => serde_json::to_value(railjson)?,
        InfraObject::Switch { railjson } => serde_json::to_value(railjson)?,
        InfraObject::SwitchType { railjson } => serde_json::to_value(railjson)?,
        InfraObject::Detector { railjson } => serde_json::to_value(railjson)?,
        InfraObject::BufferStop { railjson } => serde_json::to_value(railjson)?,
        InfraObject::Route { railjson } => serde_json::to_value(railjson)?,
        InfraObject::OperationalPoint { railjson } => serde_json::to_value(railjson)?,
        InfraObject::Electrification { railjson } => serde_json::to_value(railjson)?,
    };
    json_patch::patch(&mut value, json_patch)?;
    let railjson_object = match object_type {
        ObjectType::TrackSection => InfraObject::TrackSection {
            railjson: serde_json::from_value(value)?,
        },
        ObjectType::Signal => InfraObject::Signal {
            railjson: serde_json::from_value(value)?,
        },
        ObjectType::SpeedSection => InfraObject::SpeedSection {
            railjson: serde_json::from_value(value)?,
        },
        ObjectType::Detector => InfraObject::Detector {
            railjson: serde_json::from_value(value)?,
        },
        ObjectType::NeutralSection => InfraObject::NeutralSection {
            railjson: serde_json::from_value(value)?,
        },
        ObjectType::Switch => InfraObject::Switch {
            railjson: serde_json::from_value(value)?,
        },
        ObjectType::SwitchType => InfraObject::SwitchType {
            railjson: serde_json::from_value(value)?,
        },
        ObjectType::BufferStop => InfraObject::BufferStop {
            railjson: serde_json::from_value(value)?,
        },
        ObjectType::Route => InfraObject::Route {
            railjson: serde_json::from_value(value)?,
        },
        ObjectType::OperationalPoint => InfraObject::OperationalPoint {
            railjson: serde_json::from_value(value)?,
        },
        ObjectType::Electrification => InfraObject::Electrification {
            railjson: serde_json::from_value(value)?,
        },
    };
    Ok(railjson_object)
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
