mod bounding_box;
mod zone;
mod object_type;

pub use bounding_box::BoundingBox;
pub use zone::Zone;
pub use object_type::ObjectType;

use derivative::Derivative;
use serde::Deserialize;
use serde::Serialize;

editoast_common::schemas! {
    object_type::schemas(),
    zone::schemas(),
    bounding_box::schemas(),
}

/// This trait should be implemented by all struct that represents an OSRD type.
pub trait OSRDTyped {
    fn get_type() -> ObjectType;
}

/// This trait should be implemented by all OSRD objects that can be identified.
pub trait OSRDIdentified {
    fn get_id(&self) -> &String;
}

/// This trait is used for all object that can be typed and identified.
/// It allows to get an `ObjectRef` from it.
pub trait OSRDObject: OSRDIdentified {
    fn get_type(&self) -> ObjectType;
    fn get_ref(&self) -> ObjectRef {
        ObjectRef::new(self.get_type(), self.get_id())
    }
}

impl<T: OSRDIdentified + OSRDTyped> OSRDObject for T {
    fn get_type(&self) -> ObjectType {
        T::get_type()
    }
}

#[derive(Deserialize, Derivative, Serialize, Clone, Debug, PartialEq, Eq, Hash)]
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
