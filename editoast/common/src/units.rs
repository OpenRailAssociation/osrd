//! Module to allow the use of serde with uom quantities
//!
//! The serde feature of uom doesn’t allow to specify in which unit the value will be serialized.
//!
//! Two helpers are provided for convenience:
//! * `unit::new` (e.g. `meter::new(32)`) to build a new quantity from a f64 in the given unit
//! * `unit::from` (e.g. `millimeter::from(length)`) to have the quantity as f64 in the given unit
//!
//! ## Usage
//!
//! ```ignore
//! use editoast_model::units::*;
//! #[derive(Debug, Serialize)]
//! struct Train {
//!     // This means that serde with read and write the velocity in meters per second
//!     #[serde(with="meter_per_second")]
//!     max_speed: Velocity,
//!     // When using optional values, we must add `default` and use ::option unit
//!     // See https://stackoverflow.com/a/44303505
//!     #[serde(default, with="meter::option")]
//!     length: Option<Length>,
//! }
//!
//! impl Train {
//!     fn from_meter_per_seconds(mps: f64) -> Self {
//!         Self {
//!             max_speed: meter_per_second::new(mps),
//!         }
//!     }
//!
//!     fn print(&self) {
//!         println!("The max speed is: {} km/h", kilometer_per_hour::from(self.max_speed));
//!     }
//! }
//! ```

/// Re-export the Quantities that are used in OSRD
pub mod quantities {
    pub use uom::si::f64::Acceleration;
    pub use uom::si::f64::Length;
    pub use uom::si::f64::Mass;
    pub use uom::si::f64::Time;
    pub use uom::si::f64::Velocity;
    pub type SolidFriction = uom::si::f64::Force;
    pub type SolidFrictionPerWeight = uom::si::f64::Acceleration;
    pub type ViscosityFriction = uom::si::f64::MassRate;
    pub type ViscosityFrictionPerWeight = uom::si::f64::Frequency;
    pub type AerodynamicDrag = uom::si::f64::LinearMassDensity;
    pub type AerodynamicDragPerWeight = uom::si::f64::LinearNumberDensity;
    pub type Deceleration = uom::si::f64::Acceleration;
}

macro_rules! quantity_to_path {
    (Length, $unit:ident) => {
        uom::si::length::$unit
    };
    (Velocity, $unit:ident) => {
        uom::si::velocity::$unit
    };
    (Acceleration, $unit:ident) => {
        uom::si::acceleration::$unit
    };
    (Mass, $unit:ident) => {
        uom::si::mass::$unit
    };
    (SolidFriction, $unit:ident) => {
        uom::si::force::$unit
    };
    (ViscosityFriction, $unit:ident) => {
        uom::si::mass_rate::$unit
    };
    (ViscosityFrictionPerWeight, $unit:ident) => {
        uom::si::frequency::$unit
    };
    (AerodynamicDrag, $unit:ident) => {
        uom::si::linear_mass_density::$unit
    };
    (AerodynamicDragPerWeight, $unit:ident) => {
        uom::si::linear_number_density::$unit
    };
    (Time, $unit:ident) => {
        uom::si::time::$unit
    };
}

macro_rules! define_unit {
    ($unit:ident, $quantity:ident) => {
        pub mod $unit {
            use super::*;
            use serde::Deserialize;
            use serde::Deserializer;
            use serde::Serialize;
            use serde::Serializer;
            type Unit = quantity_to_path!($quantity, $unit);
            pub type ReprType = f64;

            pub fn serialize<S>(value: &$quantity, serializer: S) -> Result<S::Ok, S::Error>
            where
                S: Serializer,
            {
                value.get::<Unit>().serialize(serializer)
            }

            pub fn deserialize<'de, D>(deserializer: D) -> Result<$quantity, D::Error>
            where
                D: Deserializer<'de>,
            {
                let value = ReprType::deserialize(deserializer)?;
                Ok($quantity::new::<Unit>(value))
            }

            pub fn new(value: ReprType) -> $quantity {
                $quantity::new::<Unit>(value)
            }

            pub fn from(qty: $quantity) -> ReprType {
                qty.get::<Unit>()
            }

            pub fn hash<H: std::hash::Hasher>(value: &$quantity, state: &mut H) {
                crate::hash_float::<5, H>(&from(*value), state);
            }

            pub mod option {
                use super::*;
                pub type ReprType = Option<super::ReprType>;

                pub fn serialize<S>(
                    value: &Option<$quantity>,
                    serializer: S,
                ) -> Result<S::Ok, S::Error>
                where
                    S: Serializer,
                {
                    value.map(|value| value.get::<Unit>()).serialize(serializer)
                }

                pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<$quantity>, D::Error>
                where
                    D: Deserializer<'de>,
                {
                    let value = Option::deserialize(deserializer)?;
                    Ok(value.map(|value| $quantity::new::<Unit>(value)))
                }

                pub fn new(value: ReprType) -> Option<$quantity> {
                    value.map(|v| $quantity::new::<Unit>(v))
                }

                pub fn from(qty: Option<$quantity>) -> ReprType {
                    qty.map(|q| q.get::<Unit>())
                }

                pub fn hash<H: std::hash::Hasher>(value: &Option<$quantity>, state: &mut H) {
                    super::hash(&value.unwrap_or_default(), state);
                }
            }

            pub mod u64 {
                use super::*;

                pub fn serialize<S>(value: &$quantity, serializer: S) -> Result<S::Ok, S::Error>
                where
                    S: Serializer,
                {
                    (value.get::<Unit>() as u64).serialize(serializer)
                }

                pub fn deserialize<'de, D>(deserializer: D) -> Result<$quantity, D::Error>
                where
                    D: Deserializer<'de>,
                {
                    super::deserialize(deserializer)
                }

                pub mod option {
                    use super::*;
                    pub type ReprType = Option<super::ReprType>;

                    pub fn serialize<S>(
                        value: &Option<$quantity>,
                        serializer: S,
                    ) -> Result<S::Ok, S::Error>
                    where
                        S: Serializer,
                    {
                        value
                            .map(|value| value.get::<Unit>() as u64)
                            .serialize(serializer)
                    }

                    pub fn deserialize<'de, D>(
                        deserializer: D,
                    ) -> Result<Option<$quantity>, D::Error>
                    where
                        D: Deserializer<'de>,
                    {
                        super::super::option::deserialize(deserializer)
                    }
                }
            }
        }
    };
}

// Any new value here must also be added in editoast_derive/src/annotate_units.rs
use quantities::*;
define_unit!(meter, Length);
define_unit!(millimeter, Length);
define_unit!(meter_per_second, Velocity);
define_unit!(meter_per_second_squared, Acceleration);
define_unit!(kilogram, Mass);
define_unit!(newton, SolidFriction);
define_unit!(kilogram_per_second, ViscosityFriction);
define_unit!(hertz, ViscosityFrictionPerWeight);
define_unit!(kilogram_per_meter, AerodynamicDrag);
define_unit!(per_meter, AerodynamicDragPerWeight);
define_unit!(second, Time);
define_unit!(millisecond, Time);
