//! Linear mass density (base unit kilogram per meter, kg·m⁻¹).
//!
//! It has the same dimension as aerodynamic drag, also known as coefficient C.
//! A typical value is 0.036 daN/(km/h)².
quantity! {
    /// Linear mass density (base unit kilogram per meter, kg·m⁻¹).
    quantity: LinearMassDensity; "linear mass density";
    /// Dimension of linear mass density, L⁻¹M (base unit kilogram per meter, kg·m⁻¹).
    dimension: ESQ<
        N1,     // length
        P1,     // mass
        Z0>;     // time

    units {
        @kilogram_per_meter: 1.0; "kg·m⁻¹", "kilogram per meter", "kilograms per meter";
        @newton_per_meter_per_second_squared: 1.0; "N·(m/s)⁻²", "newton per meter per second squared", "newtons per meter per second squared";
        @newton_per_kilometer_per_hour_squared: 12960.0; "kN·(km/h)⁻²", "kilonewton per kilometer per hour squared", "kilonewtons per kilometer per hour squared";
    }
}
