//! Frequency (base unit hertz, s⁻¹).

quantity! {
    /// Frequency (base unit hertz, s⁻¹).
    quantity: Frequency; "frequency";
    /// Dimension of frequency, T⁻¹ (base unit hertz, s⁻¹).
    dimension: ESQ<
        Z0,     // length
        Z0,     // mass
        N1>;    // time

    units {
        /// The hertz is one cycle per second.
        @hertz: prefix!(none); "Hz", "hertz", "hertz";
    }
}
