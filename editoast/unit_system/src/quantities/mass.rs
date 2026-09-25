//! Mass (base unit kilogram, kg).
quantity! {
    /// Mass (base unit kilogram, kg).
    quantity: Mass; "mass";
    /// Dimension of mass, M (base unit kilogram, kg).
    dimension: ESQ<
        Z0,     // length
        P1,     // mass
        Z0>;    // time

    units {
        @ton: 1.0E3; "t", "ton", "tons";
        @kilogram: 1.0; "kg", "kilogram", "kilograms";
    }
}
