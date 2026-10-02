//! Linear number density (base unit 1 per meter, m⁻¹).
//!
//! It has the same dimension as aerodynamic drag per weight.
//! A typical value is 0.1 N/(km/h)²/t.
quantity! {
    /// Linear number density (base unit 1 per meter, m⁻¹).
    quantity: LinearNumberDensity; "linear number density";
    /// Dimension of linear number density, L⁻¹ (base unit per meter, m⁻¹).
    dimension: ESQ<
        N1,     // length
        Z0,     // mass
        Z0>;    // time

    units {
        @per_meter: 1.0; "m⁻¹", "per meter", "per meter";
        @newton_per_meter_per_second_squared_per_kilogram: 1.0; "N·(m/s)⁻²·kg⁻¹", "newton per meter per second squared per kilogram", "newtons per meter per second squared per kilogram";
    }
}
