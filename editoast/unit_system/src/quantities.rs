//! Editoast System of Quantities (ESQ). Subset of the International System of Quantities (ISQ)
//! that, for now, uses the same base units (meter, kilogram, second) and only defines the
//! quantities used in Editoast. It will later allow us to change the base units in order to
//! represent any quantity that we might treat using integers instead of floats.

// There are other base quantities defined in the ISQ, such as electric current, luminous
// intensity, thermodynamic temperature and amount of substance, but we don’t need them.
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
    /// [Editoast System of Quantities](https://jcgm.bipm.org/vim/en/1.6.html) (ESQ).
    ///
    /// It only defines a subset of the quantities of the International System of Quantities
    /// (ISQ) provided by uom.
    ///
    /// ## Generic Parameters
    /// * `L`: Length dimension.
    /// * `M`: Mass dimension.
    /// * `T`: Time dimension.
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
        mod velocity::Velocity,
        mod acceleration::Acceleration,
        mod force::Force,
        mod mass_rate::MassRate,
        mod frequency::Frequency,
        mod linear_mass_density::LinearMassDensity,
        mod linear_number_density::LinearNumberDensity,
    }
}

ESQ!(self, f64);
// Editoast aliases for existing units
pub type Offset = Time;
pub type SolidFriction = Force;
pub type SolidFrictionPerWeight = Acceleration;
pub type Deceleration = Acceleration;
pub type ViscosityFriction = MassRate;
pub type ViscosityFrictionPerWeight = Frequency;
pub type AerodynamicDrag = LinearMassDensity;
pub type AerodynamicDragPerWeight = LinearNumberDensity;
