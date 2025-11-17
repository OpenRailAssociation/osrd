//! Editoast System of Quantities (ESQ). Subset of the International System of Quantities (ISQ)
//! that, for now, uses the same base units (meter, kilogram, second) and only defines the
//! quantities used in Editoast. It will later allow us to change the base units in order to
//! represent any quantity that we might treat using integers instead of floats.

// There are other base quantities defined in the ISQ, such as electric current, luminous
// intensity, thermodynamic temperature and amount of substance, but we don’t need them.
// Future quantities might need them and we will need to expand ESQ with them as required.
pub mod length;
pub mod mass;
pub mod time;

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
        mod length::Length,
        mod mass::Mass,
        mod time::Time,
    }
}

pub mod quantities {
    ESQ!(self::super, f64);
}

pub fn quantity_eq<D, U, V>(a: &Quantity<D, U, V>, b: &Quantity<D, U, V>) -> bool
where
    D: Dimension + ?Sized,
    U: Units<V> + ?Sized,
    V: uom::num_traits::Num + uom::num_traits::float::TotalOrder + uom::Conversion<V>,
{
    crate::float_eq(&a.value, &b.value)
}
