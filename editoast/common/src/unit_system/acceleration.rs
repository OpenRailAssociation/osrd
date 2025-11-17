//! Acceleration (base unit meter per second squared, m · s⁻²).

quantity! {
    /// Acceleration (base unit millimeter per second squared, m · s⁻²).
    quantity: Acceleration; "acceleration";
    /// Dimension of acceleration, LT⁻² (base unit meter per second squared, m · s⁻²).
    dimension: ESQ<
        P1,     // length
        Z0,     // mass
        N2,     // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        Z0,     // amount of substance
        Z0>;    // luminous intensity
    units {
        @millimeter_per_second_squared: prefix!(milli); "mm/s²", "millimeter per second squared",
            "millimeters per second squared";
        @meter_per_second_squared: prefix!(none); "m/s²", "meter per second squared",
            "meters per second squared";
    }
}
