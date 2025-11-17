//! Frequency (base unit hertz, s⁻¹).

quantity! {
    /// Frequency (base unit hertz, s⁻¹).
    quantity: Frequency; "frequency";
    /// Dimension of frequency, T⁻¹ (base unit hertz, s⁻¹).
    dimension: ESQ<
        Z0,     // length
        Z0,     // mass
        N1,     // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        Z0,     // amount of substance
        Z0>;    // luminous intensity
    units {
        /// The hertz is one cycle per second.
        @hertz: prefix!(none); "Hz", "hertz", "hertz";
    }
}
