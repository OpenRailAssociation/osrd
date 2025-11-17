//! Force (base unit newton, kg · m · s⁻²).

quantity! {
    /// Force (base unit newton, kg · m · s⁻²).
    quantity: Force; "force";
    /// Dimension of force, LMT⁻² (base unit newton, kg · m · s⁻²).
    dimension: ESQ<
        P1,     // length
        P1,     // mass
        N2>;    // time
    units {
        /// Derived unit of force.
        @newton: prefix!(none); "N", "newton", "newtons";
    }
}
