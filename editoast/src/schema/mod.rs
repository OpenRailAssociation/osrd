mod errors;
mod railjson;
pub mod track_section;
pub mod v2;

pub use errors::InfraError;
pub use errors::InfraErrorType;
pub use railjson::RailJson;
pub use railjson::RAILJSON_VERSION;
pub use track_section::TrackSection;

cfg_if! {
    if #[cfg(test)] {
        pub use track_section::{Curve, Slope};
    }
}

editoast_common::schemas! {
    editoast_schemas::schemas(),
}
