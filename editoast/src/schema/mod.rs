mod errors;
pub mod operational_point;
mod railjson;
mod route;
mod speed_section;
mod switch;
pub mod track_section;
pub mod utils;
pub mod v2;

use editoast_schemas::primitives::OSRDIdentified;
use editoast_schemas::primitives::ObjectType;
pub use errors::InfraError;
pub use errors::InfraErrorType;
pub use operational_point::OperationalPoint;
pub use operational_point::OperationalPointExtensions;
pub use operational_point::OperationalPointIdentifierExtension;
pub use operational_point::OperationalPointPart;
pub use railjson::RailJson;
pub use railjson::RAILJSON_VERSION;
pub use route::Route;
pub use speed_section::Speed;
pub use speed_section::SpeedSection;
pub use switch::Switch;
pub use track_section::TrackSection;

cfg_if! {
    if #[cfg(test)] {
        pub use track_section::{Curve, Slope};
    }
}

use crate::infra_cache::operation;

editoast_common::schemas! {
    utils::schemas(),
    editoast_schemas::schemas(),
    operation::schemas(),
}
