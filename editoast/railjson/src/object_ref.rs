use educe::Educe;
use serde::Deserialize;
use serde::Serialize;
use utoipa::ToSchema;

use super::ObjectType;

#[derive(Deserialize, Educe, Serialize, Clone, Debug, PartialEq, Eq, Hash, ToSchema)]
#[educe(Default)]
#[serde(deny_unknown_fields)]
pub struct ObjectRef {
    #[serde(rename = "type")]
    #[educe(Default = ObjectType::TrackSection)]
    pub obj_type: ObjectType,
    #[educe(Default = "InvalidRef".into())]
    pub obj_id: String,
}

impl ObjectRef {
    pub fn new<T: AsRef<str>>(obj_type: ObjectType, obj_id: T) -> Self {
        let obj_id: String = obj_id.as_ref().to_string();
        ObjectRef { obj_type, obj_id }
    }
}
