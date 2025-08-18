mod bounding_box;
pub mod duration;
mod identifier;
mod non_blank_string;
mod object_ref;
mod object_type;

pub use bounding_box::BoundingBox;
pub use duration::PositiveDuration;
pub use identifier::Identifier;
pub use non_blank_string::NonBlankString;
pub use object_ref::ObjectRef;
pub use object_type::ObjectType;

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
