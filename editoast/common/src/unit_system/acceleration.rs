//! Acceleration (base unit meter per second squared, m · s⁻²).
//!
//! It has the same dimension as solid friction per weight.
//! A typical value is 0.05 m/s² for acceleration and 1 daN/t for solid friction per weight.
quantity! {
    /// Acceleration (base unit meter per second squared, m · s⁻²).
    quantity: Acceleration; "acceleration";
    /// Dimension of acceleration, LT⁻² (base unit meter per second squared, m · s⁻²).
    dimension: ESQ<
        P1,     // length
        Z0,     // mass
        N2>;    // time

    units {
         @meter_per_second_squared: 1.0; "m·s⁻²", "meter per second squared", "meters per second squared";
         @newton_per_kg: 1.0; "N·kg⁻¹", "newton per kilogram", "newtons per kilogram";
         @newton_per_ton: 1.0E-3; "N·t⁻¹", "newton per ton", "newtons per ton";
    }
}
