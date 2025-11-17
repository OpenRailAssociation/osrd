//! Mass rate (base unit kilogram per second, kg · s⁻¹).

quantity! {
    /// Mass rate (base unit kilogram per second, kg · s⁻¹).
    quantity: MassRate; "mass rate";
    /// Dimension of mass rate, MT⁻¹ (base unit kilogram per second, kg · s⁻¹).
    dimension: ESQ<
        Z0,     // length
        P1,     // mass
        N1,     // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        Z0,     // amount of substance
        Z0>;    // luminous intensity
    units {
        /// Derived unit of mass rate.
        @kilogram_per_second: prefix!(kilo) / prefix!(kilo); "kg/s", "kilogram per second",
            "kilograms per second";
    }
}
