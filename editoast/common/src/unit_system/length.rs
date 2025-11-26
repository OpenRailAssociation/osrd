//! Length (base unit meter, m).
quantity! {
    /// Length (base unit meter, m).
    quantity: Length; "length";
    /// Dimension of length, L (base unit meter, m).
    dimension: ESQ<
        P1,     // length
        Z0,     // mass
        Z0>;    // time

    units {
        @meter: 1.0; "m", "meter", "meters";
        @millimeter: 1.0E-3; "mm", "millimeter", "millimeters";
    }
}
