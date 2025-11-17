quantity! {
    /// Length (base unit millimeter, mm).
    quantity: Length; "length";
    /// Length dimension, mm.
    dimension: ESQ<
        P1,     // length
        Z0,     // mass
        Z0>;    // time

    units {
        @meter: 1.0; "m", "meter", "meters";
        @millimeter: 1.0E-3; "mm", "millimeter", "millimeters";
    }
}
