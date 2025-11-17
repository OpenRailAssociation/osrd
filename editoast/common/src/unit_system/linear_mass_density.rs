//! Linear mass density (base unit kilogram per meter, m⁻¹ · kg).
//!
//! It has the same dimension as aerodynamic drag, also known as coefficient B
//! A typical value is 0.036 daN/km/h
quantity! {
    /// Linear mass density (base unit kilogram per meter, kg·m⁻¹).
    quantity: LinearMassDensity; "linear mass density";
    /// Dimension of linear mass density, L⁻¹M (base unit kilogram per meter, kg·m⁻¹).
    dimension: ESQ<
        N1,     // length
        P1,     // mass
        Z0>;     // time

    units {
        @kilogram_per_meter: prefix!(none); "kg/m", "kilogram per meter", "kilograms per meter";
    }
}
