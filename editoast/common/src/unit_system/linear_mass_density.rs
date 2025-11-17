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
        @kilogram_per_meter: prefix!(none); "kg/m", "kilogram per meter", "kilograms per meter";
    }
}
