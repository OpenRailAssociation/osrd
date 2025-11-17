//! Linear number density (base unit 1 per meter, m⁻¹).

quantity! {
    /// Linear number density (base unit 1 per meter, m⁻¹).
    quantity: LinearNumberDensity; "linear number density";
    /// Dimension of linear number density, L⁻¹ (base 1 unit per meter, m⁻¹).
    dimension: ESQ<
        N1,     // length
        Z0,     // mass
        Z0>;    // time
    units {
        @per_meter: prefix!(none); "m⁻¹", "per meter", "per meter";
    }
}
