//! Editoast System of Quantities (ESQ). Subset of the International System of Quantities (ISQ)
//! that uses different default units per quantity (ex: length defaults to millimeter) in order
//! to be able to represent any quantity that we might treat using integers instead of floats.

pub mod acceleration;
pub mod amount_of_substance;
pub mod electric_current;
pub mod force;
pub mod frequency;
pub mod length;
pub mod linear_mass_density;
pub mod linear_number_density;
pub mod luminous_intensity;
pub mod mass;
pub mod mass_rate;
pub mod thermodynamic_temperature;
pub mod time;
pub mod velocity;

system! {
    /// [Editoast System of Quantities](https://jcgm.bipm.org/vim/en/1.6.html) (ISQ).
    ///
    /// ## Generic Parameters
    /// * `L`: Length dimension.
    /// * `M`: Mass dimension.
    /// * `T`: Time dimension.
    /// * `I`: Electric current dimension.
    /// * `Th`: Thermodynamic temperature dimension.
    /// * `N`: Amount of substance dimension.
    /// * `J`: Luminous intensity dimension.
    /// * `K`: Kind.
    quantities: ESQ {
        /// Length, one of the base quantities in the ESQ, denoted by the symbol L. The base unit
        /// for length is millimeter.
        length: millimeter, L;
        /// Mass, one of the base quantities in the ESQ, denoted by the symbol M. The base unit
        /// for mass is kilogram.
        mass: kilogram, M;
        /// Time, one of the base quantities in the ESQ, denoted by the symbol T. The base unit
        /// for time is the millisecond.
        time: millisecond, T;
        /// Electric current, one of the base quantities in the ESQ, denoted by the symbol I. The
        /// base unit for electric current is ampere.
        electric_current: ampere, I;
        /// Thermodynamic temperature, one of the base quantities in the ESQ, denoted by the symbol
        /// Th (Θ). The base unit for thermodynamic temperature is kelvin.
        thermodynamic_temperature: kelvin, Th;
        /// Amount of substance, one of the base quantities in the ESQ, denoted by the symbol N.
        /// The base unit for amount of substance is mole.
        amount_of_substance: mole, N;
        /// Luminous intensity, one of the base quantities in the ESQ, denoted by the symbol J. The
        /// base unit for luminous intensity is candela.
        luminous_intensity: candela, J;
    }
    units: U {
        // Base units
        mod length::Length,
        mod mass::Mass,
        mod time::Time,
        mod electric_current::ElectricCurrent,
        mod thermodynamic_temperature::ThermodynamicTemperature,
        mod amount_of_substance::AmountOfSubstance,
        mod luminous_intensity::LuminousIntensity,
        // Composed units
        mod velocity::Velocity, // TODO switch to meter per second
        mod acceleration::Acceleration, // TODO switch to meter per second squared
        mod force::Force, // TODO switch to kg.m.s-2
        mod mass_rate::MassRate,
        mod frequency::Frequency,
        mod linear_mass_density::LinearMassDensity,
        mod linear_number_density::LinearNumberDensity,
    }
}

pub mod u64 {
    mod editoast_units_system {
        pub use super::super::*;
    }
    ESQ!(self::editoast_units_system, u64);

    // Editoast aliases for existing units
    pub type SolidFriction = crate::unit_system::u64::Force;
    pub type SolidFrictionPerWeight = crate::unit_system::u64::Acceleration;
    pub type Deceleration = crate::unit_system::u64::Acceleration;
    pub type ViscosityFriction = crate::unit_system::u64::MassRate;
    pub type ViscosityFrictionPerWeight = crate::unit_system::u64::Frequency;
    pub type AerodynamicDrag = crate::unit_system::u64::LinearMassDensity;
    pub type AerodynamicDragPerWeight = crate::unit_system::u64::LinearNumberDensity;
}

#[cfg(test)]
mod tests {
    use crate::unit_system::{length::millimeter, u64};

    #[test]
    fn u64_storage_for_millimeter_is_lossless() {
        assert_eq!(u64::Length::new::<millimeter>(1).get::<millimeter>(), 1);
    }
}
