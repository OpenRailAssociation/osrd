use super::BufferStop;
use super::Detector;
use super::Electrification;
use super::NeutralSection;
use super::OperationalPoint;
use super::Route;
use super::Signal;
use super::SpeedSection;
use super::TrackNode;
use super::TrackNodeType;
use super::TrackSection;
use crate::primitives::OSRDIdentified;
use crate::primitives::OSRDObject;
use crate::primitives::ObjectType;

editoast_common::schemas! {
    InfraObject,
}

#[derive(Debug, Clone, PartialEq, serde::Deserialize, serde::Serialize, utoipa::ToSchema)]
#[serde(tag = "obj_type", deny_unknown_fields)]
pub enum InfraObject {
    TrackSection { railjson: TrackSection },
    Signal { railjson: Signal },
    NeutralSection { railjson: NeutralSection },
    SpeedSection { railjson: SpeedSection },
    TrackNode { railjson: TrackNode },
    TrackNodeType { railjson: TrackNodeType },
    Detector { railjson: Detector },
    BufferStop { railjson: BufferStop },
    Route { railjson: Route },
    OperationalPoint { railjson: OperationalPoint },
    Electrification { railjson: Electrification },
}

impl InfraObject {
    pub fn get_obj(&self) -> &dyn OSRDObject {
        match self {
            InfraObject::TrackSection { railjson: obj } => obj,
            InfraObject::Signal { railjson: obj } => obj,
            InfraObject::NeutralSection { railjson: obj } => obj,
            InfraObject::SpeedSection { railjson: obj } => obj,
            InfraObject::TrackNode { railjson: obj } => obj,
            InfraObject::TrackNodeType { railjson: obj } => obj,
            InfraObject::Detector { railjson: obj } => obj,
            InfraObject::BufferStop { railjson: obj } => obj,
            InfraObject::Route { railjson: obj } => obj,
            InfraObject::OperationalPoint { railjson: obj } => obj,
            InfraObject::Electrification { railjson: obj } => obj,
        }
    }

    pub fn get_data(&self) -> serde_json::Value {
        match self {
            InfraObject::TrackSection { railjson: obj } => serde_json::to_value(obj),
            InfraObject::Signal { railjson: obj } => serde_json::to_value(obj),
            InfraObject::SpeedSection { railjson: obj } => serde_json::to_value(obj),
            InfraObject::NeutralSection { railjson: obj } => serde_json::to_value(obj),
            InfraObject::TrackNode { railjson: obj } => serde_json::to_value(obj),
            InfraObject::TrackNodeType { railjson: obj } => serde_json::to_value(obj),
            InfraObject::Detector { railjson: obj } => serde_json::to_value(obj),
            InfraObject::BufferStop { railjson: obj } => serde_json::to_value(obj),
            InfraObject::Route { railjson: obj } => serde_json::to_value(obj),
            InfraObject::OperationalPoint { railjson: obj } => serde_json::to_value(obj),
            InfraObject::Electrification { railjson: obj } => serde_json::to_value(obj),
        }
        .unwrap()
    }
}

impl OSRDIdentified for InfraObject {
    fn get_id(&self) -> &String {
        self.get_obj().get_id()
    }
}

impl OSRDObject for InfraObject {
    fn get_type(&self) -> ObjectType {
        self.get_obj().get_type()
    }
}

impl From<TrackSection> for InfraObject {
    fn from(track: TrackSection) -> Self {
        InfraObject::TrackSection { railjson: track }
    }
}

impl From<Electrification> for InfraObject {
    fn from(electrification: Electrification) -> Self {
        InfraObject::Electrification {
            railjson: electrification,
        }
    }
}

impl From<Signal> for InfraObject {
    fn from(signal: Signal) -> Self {
        InfraObject::Signal { railjson: signal }
    }
}

impl From<SpeedSection> for InfraObject {
    fn from(speedsection: SpeedSection) -> Self {
        InfraObject::SpeedSection {
            railjson: speedsection,
        }
    }
}

impl From<NeutralSection> for InfraObject {
    fn from(neutralsection: NeutralSection) -> Self {
        InfraObject::NeutralSection {
            railjson: neutralsection,
        }
    }
}

impl From<TrackNode> for InfraObject {
    fn from(track_node: TrackNode) -> Self {
        InfraObject::TrackNode { railjson: track_node }
    }
}

impl From<TrackNodeType> for InfraObject {
    fn from(tracknodetype: TrackNodeType) -> Self {
        InfraObject::TrackNodeType {
            railjson: tracknodetype,
        }
    }
}

impl From<Detector> for InfraObject {
    fn from(detector: Detector) -> Self {
        InfraObject::Detector { railjson: detector }
    }
}

impl From<BufferStop> for InfraObject {
    fn from(bufferstop: BufferStop) -> Self {
        InfraObject::BufferStop {
            railjson: bufferstop,
        }
    }
}

impl From<Route> for InfraObject {
    fn from(route: Route) -> Self {
        InfraObject::Route { railjson: route }
    }
}

impl From<OperationalPoint> for InfraObject {
    fn from(operationalpoint: OperationalPoint) -> Self {
        InfraObject::OperationalPoint {
            railjson: operationalpoint,
        }
    }
}
