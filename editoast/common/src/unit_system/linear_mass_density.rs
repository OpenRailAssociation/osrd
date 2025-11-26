//! Linear mass density (base unit kilogram per meter, m⁻¹ · kg).

quantity! {
    /// Linear mass density (base unit kilogram per meter, m⁻¹ · kg).
    quantity: LinearMassDensity; "linear mass density";
    /// Dimension of linear mass density, L⁻¹M (base unit kilogram per meter, m⁻¹ · kg).
    dimension: ESQ<
        N1,     // length
        P1,     // mass
        Z0>;     // time

    units {
        @kilogram_per_meter: 1.0; "kg/m", "kilogram per meter", "kilograms per meter";
    }
}
