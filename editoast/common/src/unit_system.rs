//! Editoast System of Quantities (ESQ). Subset of the International System of Quantities (ISQ)
//! that uses different default units per quantity (ex: length defaults to millimeter) in order
//! to be able to represent any quantity that we might treat using integers instead of floats.

// There are other base quantities defined in uom, but we don’t need them
// such as current, light intensity, temperature and amount of substance.
// Future quantities might need them and we will need to expand ESQ with them as required.
pub mod acceleration;
pub mod force;
pub mod frequency;
pub mod length;
pub mod linear_mass_density;
pub mod linear_number_density;
pub mod mass;
pub mod mass_rate;
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
        /// for length is meter.
        length: meter, L;
        /// Mass, one of the base quantities in the ESQ, denoted by the symbol M. The base unit
        /// for mass is kilogram.
        mass: kilogram, M;
        /// Time, one of the base quantities in the ESQ, denoted by the symbol T. The base unit
        /// for time is the second.
        time: second, T;
    }
    units: U {
        // Base units
        mod length::Length,
        mod mass::Mass,
        mod time::Time,
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

pub mod quantities {
    ESQ!(self::super, f64);
    // Editoast aliases for existing units
    pub type SolidFriction = Force;
    pub type SolidFrictionPerWeight = Acceleration;
    pub type Deceleration = Acceleration;
    pub type ViscosityFriction = MassRate;
    pub type ViscosityFrictionPerWeight = Frequency;
    pub type AerodynamicDrag = LinearMassDensity;
    pub type AerodynamicDragPerWeight = LinearNumberDensity;
}
