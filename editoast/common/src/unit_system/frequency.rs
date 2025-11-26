//! Frequency (base unit hertz, s⁻¹).
//!
//! It has the same dimension as viscosity friction per weight.
//! A typical value is 0.01 daN/km/h/t or 100 mN/km/h/t.
quantity! {
    /// Frequency (base unit hertz, s⁻¹).
    quantity: Frequency; "frequency";
    /// Dimension of frequency, T⁻¹ (base unit hertz, s⁻¹).
    dimension: ESQ<
        Z0,     // length
        Z0,     // mass
        N1>;    // time

    units {
        @hertz: 1.0; "Hz", "hertz", "hertz";
         @newton_per_meter_per_second_per_kilogram: 1.0; "N·(m/s)⁻¹·kg⁻¹", "newton per meter per second per kilogram", "newtons per meter per second per kilogram";
    }
}
