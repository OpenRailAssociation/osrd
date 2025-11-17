quantity! {
    /// Mass (base unit kilogram, kg).
    quantity: Mass; "mass";
    /// Mass dimension, kg.
    dimension: ESQ<
        Z0,     // length
        P1,     // mass
        Z0,     // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        Z0,     // amount of substance
        Z0>;    // luminous intensity

    units {
        @kilogram: 1.0; "kg", "kilogram", "kilograms";
    }
}
