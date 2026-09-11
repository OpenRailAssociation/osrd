//! Acceleration (base unit meter per second squared, m · s⁻²).

quantity! {
    /// Acceleration (base unit meter per second squared, m · s⁻²).
    quantity: Acceleration; "acceleration";
    /// Dimension of acceleration, LT⁻² (base unit meter per second squared, m · s⁻²).
    dimension: ESQ<
        P1,     // length
        Z0,     // mass
        N2>;    // time

    units {
        @meter_per_second_squared: 1.0; "m/s²", "meter per second squared", "meters per second squared";
    }
}
