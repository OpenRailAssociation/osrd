//! Mass rate (base unit kilogram per second, kg · s⁻¹).

quantity! {
    /// Mass rate (base unit kilogram per second, kg · s⁻¹).
    quantity: MassRate; "mass rate";
    /// Dimension of mass rate, MT⁻¹ (base unit kilogram per second, kg · s⁻¹).
    dimension: ESQ<
        Z0,     // length
        P1,     // mass
        N1>;    // time
    units {
        /// Derived unit of mass rate.
        @kilogram_per_second: prefix!(kilo) / prefix!(kilo); "kg/s", "kilogram per second",
            "kilograms per second";
    }
}
