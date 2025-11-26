//! Linear number density (base unit 1 per meter, m⁻¹).

/// Kind of constituent concentration in chemical mixtures, which separates mass concentration
/// from mass density. This `Kind` is also applied to molar concentration and to catalytic
/// activity concentration.
pub trait ConstituentConcentrationKind: uom::Kind {}

quantity! {
    /// Linear number density (base unit 1 per meter, m⁻¹).
    quantity: LinearNumberDensity; "linear number density";
    /// Dimension of linear number density, L⁻¹ (base 1 unit per meter, m⁻¹).
    dimension: ESQ<
        N1,     // length
        Z0,     // mass
        Z0,     // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        Z0,     // amount of substance
        Z0>;    // luminous intensity
    kind: dyn ConstituentConcentrationKind;
    units {
        @per_nanometer: 1.0; "nm⁻¹", "per nanometer", "per nanometer";
        @per_millimeter: 1.0E3; "mm⁻¹", "per millimeter", "per millimeter";
        @per_meter: 1.0E6; "m⁻¹", "per meter", "per meter";
    }
}
