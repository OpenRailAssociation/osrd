//! Velocity (base unit meter per second, m · s⁻¹).

quantity! {
    /// Velocity (base unit meter per second, m · s⁻¹).
    quantity: Velocity; "velocity";
    /// Dimension of velocity, LT⁻¹ (base unit meter per second, m · s⁻¹).
    dimension: ESQ<
        P1,     // length
        Z0,     // mass
        N1>;    // time
    units {
        @kilometer_per_hour: 1000.0/3600.0; "km/h", "kilometer per hour", "kilometers per hour";
        @meter_per_second: 1.0; "m/s", "meter per second", "meters per second";
    }
}
