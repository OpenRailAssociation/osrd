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
        @milligram_per_second: 1000.0/ 1.0; "mg/s", "milligram per second", "milligrams per second";
        @gram_per_second: 1.0E3/ 1.0; "g/s", "gram per second",
            "kilograms per second";
        @kilogram_per_second: 1.0E6/ 1.0; "kg/s", "kilogram per second",
            "kilograms per second";
    }
}
