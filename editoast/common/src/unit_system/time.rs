quantity! {
    /// Time (base unit millisecond, ms).
    quantity: Time; "time";
    /// Time dimension, s.
    dimension: ESQ<
        Z0,     // length
        Z0,     // mass
        P1,     // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        Z0,     // amount of substance
        Z0>;    // luminous intensity
    units {
        @second: 1.0; "s", "second", "seconds";
        @millisecond: 1.0E-3; "ms", "millisecond", "milliseconds";
    }
}
