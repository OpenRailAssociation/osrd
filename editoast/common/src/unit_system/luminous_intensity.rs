//! Luminous intensity (base unit candela, cd).

quantity! {
    /// Luminous intensity (base unit candela, cd).
    quantity: LuminousIntensity; "luminous intensity";
    /// Dimension of luminous intensity, J (base unit candela, cd).
    dimension: ESQ<
        Z0,     // length
        Z0,     // mass
        Z0,     // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        Z0,     // amount of substance
        P1>;    // luminous intensity
    units {
        /// The candela is the SI unit of luminous intensity in a given direction. It is defined by
        /// taking the fixed numerical value of the luminous efficacy of monochromatic radiation of
        /// frequency 540 × 10¹² Hz, *K*<sub>cd</sub>, to be 683 when expressed in the unit lm W⁻¹,
        /// which is equal to cd sr W⁻¹, or cd sr kg⁻¹ m⁻² s³, where the kilogram, meter, and second
        /// are defined in terms of *h*, *c* and ∆*ν*<sub>Cs</sub>.
        @candela: prefix!(none); "cd", "candela", "candelas";
    }
}
