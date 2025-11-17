quantity! {
    /// Length (base unit millimeter, mm).
    quantity: Length; "length";
    /// Length dimension, mm.
    dimension: ESQ<
        P1,     // length
        Z0,     // mass
        Z0,      // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        Z0,     // amount of substance
        Z0>;    // luminous intensity
    units {
        @meter: 1.0E0; "m", "meter", "meters";
        @millimeter: 1.0E-3; "mm", "millimeter", "millimeters";
    }
}
