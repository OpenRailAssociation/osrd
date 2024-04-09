use derivative::Derivative;
use enum_map::Enum;
use serde::Deserialize;
use serde::Serialize;
use strum::Display;
use strum::EnumIter;
use utoipa::ToSchema;

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

#[derive(
    Debug,
    Clone,
    Copy,
    Deserialize,
    Hash,
    Eq,
    PartialEq,
    Serialize,
    Enum,
    EnumIter,
    Display,
    ToSchema,
)]
#[serde(deny_unknown_fields)]
pub enum ObjectType {
    TrackSection,
    Signal,
    SpeedSection,
    Detector,
    NeutralSection,
    Switch,
    SwitchType,
    BufferStop,
    Route,
    OperationalPoint,
    Electrification,
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
