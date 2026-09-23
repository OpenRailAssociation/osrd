//! Force (base unit newton, kg · m · s⁻²).
//!
//! It represents the traction force of a train.
//! It has the same dimensions as solid friction (resistance to movement) also known as coefficient A.
//! A typical value is 100 kN.
quantity! {
    /// Force (base unit newton, kg · m · s⁻²).
    quantity: Force; "force";
    /// Dimension of force, LMT⁻² (base unit newton, kg · m · s⁻²).
    dimension: ESQ<
        P1,     // length
        P1,     // mass
        N2>;    // time

    units {
        @newton: 1.0; "N", "newton", "newtons";
        @kilonewton: 1.0E3; "kN", "kilonewton", "kilonewtons";
    }
}
