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
    pub use crate::unit_system::i64::*;
    // Editoast aliases for existing units
    pub type SolidFriction = Force;
    pub type SolidFrictionPerWeight = Acceleration;
    pub type Deceleration = Acceleration;
    pub type ViscosityFriction = MassRate;
    pub type ViscosityFrictionPerWeight = Frequency;
    pub type AerodynamicDrag = LinearMassDensity;
    pub type AerodynamicDragPerWeight = LinearNumberDensity;
}

macro_rules! quantity_to_path {
    (Length, $unit:ident) => {
        crate::unit_system::length::$unit
    };
    (Velocity, $unit:ident) => {
        crate::unit_system::velocity::$unit
    };
    (Acceleration, $unit:ident) => {
        crate::unit_system::acceleration::$unit
    };
    (Mass, $unit:ident) => {
        crate::unit_system::mass::$unit
    };
    (SolidFriction, $unit:ident) => {
        crate::unit_system::force::$unit
    };
    (ViscosityFriction, $unit:ident) => {
        crate::unit_system::mass_rate::$unit
    };
    (ViscosityFrictionPerWeight, $unit:ident) => {
        crate::unit_system::frequency::$unit
    };
    (AerodynamicDrag, $unit:ident) => {
        crate::unit_system::linear_mass_density::$unit
    };
    (AerodynamicDragPerWeight, $unit:ident) => {
        crate::unit_system::linear_number_density::$unit
    };
    (Time, $unit:ident) => {
        crate::unit_system::time::$unit
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
            pub type ReprType = i64;

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
            }

            pub mod f64 {
                use super::*;

                pub fn serialize<S>(value: &$quantity, serializer: S) -> Result<S::Ok, S::Error>
                where
                    S: Serializer,
                {
                    (value.get::<Unit>() as f64).serialize(serializer)
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
                        value.map(|value| value.get::<Unit>()).serialize(serializer)
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
define_unit!(millimeter, Length);
define_unit!(meter, Length);
define_unit!(meter_per_second, Velocity);
define_unit!(meter_per_second_squared, Acceleration);
define_unit!(millimeter_per_second_squared, Acceleration);
define_unit!(kilogram, Mass);
define_unit!(newton, SolidFriction);
define_unit!(milligram_per_second, ViscosityFriction);
define_unit!(gram_per_second, ViscosityFriction);
define_unit!(kilogram_per_second, ViscosityFriction);
define_unit!(millihertz, ViscosityFrictionPerWeight);
define_unit!(hertz, ViscosityFrictionPerWeight);
define_unit!(milligram_per_meter, AerodynamicDrag);
define_unit!(gram_per_meter, AerodynamicDrag);
define_unit!(kilogram_per_meter, AerodynamicDrag);
define_unit!(per_nanometer, AerodynamicDragPerWeight);
define_unit!(per_millimeter, AerodynamicDragPerWeight);
define_unit!(per_meter, AerodynamicDragPerWeight);
define_unit!(second, Time);
define_unit!(millisecond, Time);
