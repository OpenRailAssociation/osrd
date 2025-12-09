//! Velocity (base unit meter per second, m · s⁻¹).

quantity! {
    /// Velocity (base unit meter per second, m · s⁻¹).
    quantity: Velocity; "velocity";
    /// Dimension of velocity, LT⁻¹ (base unit meter per second, m · s⁻¹).
    dimension: ESQ<
        P1,     // length
        Z0,     // mass
        N1,     // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        Z0,     // amount of substance
        Z0>;    // luminous intensity
    units {
        @kilometer_per_second: 1000.0; "km/s", "kilometer per second",
            "kilometers per second";
        @meter_per_second: 1.0; "m/s", "meter per second", "meters per second";
    }
}
