//! Editoast System of Quantities (ESQ). Subset of the International System of Quantities (ISQ)
//! that uses different default units per quantity (ex: length defaults to millimeter) in order
//! to be able to represent any quantity that we might treat using integers instead of floats.

// There are other base quantities defined in uom, but we don’t need them
// such as current, light intensity, temperature and amount of substance.
// Future quantities might need them and we will need to expand ESQ with them as required.
pub mod length;
pub mod mass;
pub mod time;

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
        mod length::Length,
        mod mass::Mass,
        mod time::Time,
    }
}

pub mod quantities {
    ESQ!(self::super, f64);
}
