use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::ObjectType;

editoast_common::schemas! {
    ObjectRef,
}

#[derive(Deserialize, Derivative, Serialize, Clone, Debug, PartialEq, Eq, Hash, ToSchema)]
#[derivative(Default)]
#[serde(deny_unknown_fields)]
pub struct ObjectRef {
    #[serde(rename = "type")]
    #[derivative(Default(value = "ObjectType::TrackSection"))]
    pub obj_type: ObjectType,
    #[derivative(Default(value = r#""InvalidRef".into()"#))]
    pub obj_id: String,
}

impl ObjectRef {
    pub fn new<T: AsRef<str>>(obj_type: ObjectType, obj_id: T) -> Self {
        let obj_id: String = obj_id.as_ref().to_string();
        ObjectRef { obj_type, obj_id }
    }
}
