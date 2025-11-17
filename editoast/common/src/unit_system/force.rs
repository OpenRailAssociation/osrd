//! Force (base unit newton, kg · m · s⁻²).

quantity! {
    /// Force (base unit newton, kg · m · s⁻²).
    quantity: Force; "force";
    /// Dimension of force, LMT⁻² (base unit newton, kg · m · s⁻²).
    dimension: ESQ<
        P1,     // length
        P1,     // mass
        N2,     // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        Z0,     // amount of substance
        Z0>;    // luminous intensity
    units {
        /// Derived unit of force.
        @newton: prefix!(none); "N", "newton", "newtons";
    }
}
