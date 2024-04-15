mod buffer_stop;
mod detector;
mod electrification;
mod errors;
pub mod operational_point;
mod railjson;
mod route;
mod signal;
mod speed_section;
mod switch;
mod switch_type;
pub mod track_section;
pub mod utils;
pub mod v2;

pub use buffer_stop::BufferStop;
pub use buffer_stop::BufferStopCache;
pub use detector::Detector;
pub use detector::DetectorCache;
use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::ObjectType;
pub use electrification::Electrification;
pub use errors::InfraError;
pub use errors::InfraErrorType;
pub use operational_point::OperationalPoint;
pub use operational_point::OperationalPointCache;
pub use operational_point::OperationalPointExtensions;
pub use operational_point::OperationalPointIdentifierExtension;
pub use operational_point::OperationalPointPart;
pub use railjson::RailJson;
pub use railjson::RAILJSON_VERSION;
pub use route::Route;
pub use signal::LogicalSignal;
pub use signal::Signal;
pub use signal::SignalCache;
pub use signal::SignalExtensions;
pub use signal::SignalSncfExtension;
pub use speed_section::Speed;
pub use speed_section::SpeedSection;
pub use switch::Switch;
pub use switch::SwitchCache;
pub use switch_type::builtin_node_types_list;
pub use switch_type::Crossing;
pub use switch_type::DoubleSlipSwitch;
pub use switch_type::Link;
pub use switch_type::PointSwitch;
pub use switch_type::SingleSlipSwitch;
pub use switch_type::SwitchType;
pub use track_section::TrackSection;
pub use track_section::TrackSectionCache;

cfg_if! {
    if #[cfg(test)] {
        pub use operational_point::OperationalPointPartCache;
        pub use switch_type::SwitchPortConnection;
        pub use track_section::{Curve, Slope};
        pub use buffer_stop::BufferStopExtension;
    }
}

use crate::infra_cache::operation;

editoast_common::schemas! {
    utils::schemas(),
    editoast_schemas::schemas(),
    operation::schemas(),
}
