mod bounding_box;
pub mod duration;
mod object_ref;
mod object_type;
mod zone;

pub use bounding_box::BoundingBox;
pub use duration::PositiveDuration;
pub use object_ref::ObjectRef;
pub use object_type::ObjectType;
pub use zone::Zone;

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
