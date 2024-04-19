mod railjson;
pub mod track_section;
pub mod v2;

pub use railjson::RailJson;
pub use railjson::RAILJSON_VERSION;
pub use track_section::TrackSection;

cfg_if! {
    if #[cfg(test)] {
        pub use track_section::{Curve, Slope};
    }
}
