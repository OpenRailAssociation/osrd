//! Linear mass density (base unit kilogram per meter, m⁻¹ · kg).

quantity! {
    /// Linear mass density (base unit kilogram per meter, m⁻¹ · kg).
    quantity: LinearMassDensity; "linear mass density";
    /// Dimension of linear mass density, L⁻¹M (base unit kilogram per meter, m⁻¹ · kg).
    dimension: ESQ<
        N1,     // length
        P1,     // mass
        Z0,     // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        Z0,     // amount of substance
        Z0>;    // luminous intensity
    units {
        @milligram_per_meter: 1.0; "mg/m", "milligram per meter", "milligrams per meter";
        @gram_per_meter: 1.0E3; "g/m", "gram per meter", "rams per meter";
        @kilogram_per_meter: 1.0E6; "kg/m", "kilogram per meter", "kilograms per meter";
    }
}
