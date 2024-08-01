use crate::primitives::Identifier;
use serde::Deserialize;
use serde::Serialize;

use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDObject;
use crate::primitives::ObjectType;
use utoipa::ToSchema;

editoast_common::schemas! {
    Waypoint,
}

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq, Eq, Hash, ToSchema)]
#[serde(tag = "type", deny_unknown_fields)]
pub enum Waypoint {
    BufferStop {
        #[schema(inline)]
        id: Identifier,
    },

    Detector {
        #[schema(inline)]
        id: Identifier,
    },
}

impl Waypoint {
    /// Create a new detector stop waypoint
    pub fn new_detector<T: AsRef<str>>(detector: T) -> Self {
        Self::Detector {
            id: detector.as_ref().into(),
        }
    }

    /// Create a new buffer stop waypoint
    pub fn new_buffer_stop<T: AsRef<str>>(bf: T) -> Self {
        Self::BufferStop {
            id: bf.as_ref().into(),
        }
    }

    /// Return whether the waypoint is a detector
    pub fn is_detector(&self) -> bool {
        matches!(self, Waypoint::Detector { .. })
    }

    // Return whether the waypoint is a buffer stop
    pub fn is_buffer_stop(&self) -> bool {
        matches!(self, Waypoint::BufferStop { .. })
    }
}

impl Default for Waypoint {
    fn default() -> Self {
        Self::Detector {
            id: "InvalidRef".into(),
        }
    }
}

impl OSRDIdentified for Waypoint {
    fn get_id(&self) -> &String {
        match self {
            Waypoint::BufferStop { id } => id,
            Waypoint::Detector { id } => id,
        }
    }
}

impl OSRDObject for Waypoint {
    fn get_type(&self) -> ObjectType {
        match self {
            Waypoint::BufferStop { .. } => ObjectType::BufferStop,
            Waypoint::Detector { .. } => ObjectType::Detector,
        }
    }
}
