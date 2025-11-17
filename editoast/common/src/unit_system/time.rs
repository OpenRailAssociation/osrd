//! Time (base unit second, s).
quantity! {
    /// Time (base unit second, s).
    quantity: Time; "time";
    /// Dimension of time, T (base unit second, s).
    dimension: ESQ<
        Z0,     // length
        Z0,     // mass
        P1>;    // time

    units {
        @second: 1.0; "s", "second", "seconds";
        @millisecond: 1.0E-3; "ms", "millisecond", "milliseconds";
    }
}
