//! Train simulation

#![warn(missing_docs)]

pub use crate::integration::Action;
pub use crate::integration::BrakingType;
pub use crate::integration::DavisCoefficients;
pub use crate::integration::Direction;
pub use crate::integration::Electrification;
pub use crate::integration::Electrified;
pub use crate::integration::IntegrationStep;
pub use crate::integration::Neutral;
pub use crate::integration::RollingStock;
pub use crate::integration::TractiveEffortPoint;
pub use crate::integration::TrainPath;
pub use crate::integration::step;
pub use crate::range_map::RangeMap;

mod integration;
mod range_map;
