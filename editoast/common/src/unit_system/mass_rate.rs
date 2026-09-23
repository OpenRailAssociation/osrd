//! Mass rate (base unit kilogram per second, kg · s⁻¹).
//!
//! It has the same dimension as viscosity friction.
//! A typical value is 1.6 daN/(km/h), or 0.44 daN/(m/s).
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
        @kilogram_per_second: 1.0; "kg·s⁻¹", "kilogram per second", "kilograms per second";
        @newton_per_meter_per_second: 1.0; "N·(m/s)⁻¹", "newton per meter per second", "newtons per meter per second";
        @newton_per_kilometer_per_hour: 3.6; "N·(km/h)⁻¹", "newton per kilometer per hour", "newtons per kilometer per hour";
    }
}
