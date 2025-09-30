//! Train simulation

#![warn(missing_docs)]

pub use crate::integration::step;
pub use crate::range_map::RangeMap;

mod integration;
mod range_map;
