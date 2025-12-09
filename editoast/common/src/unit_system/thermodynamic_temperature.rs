/// Kind of thermodynamic temperature.
pub trait TemperatureKind:
    uom::marker::Mul
    + uom::marker::MulAssign
    + uom::marker::Div
    + uom::marker::DivAssign
    + uom::marker::Rem
    + uom::marker::RemAssign
{
}

quantity! {
    /// Thermodynamic temperature (base unit kelvin, K).
    quantity: ThermodynamicTemperature; "thermodynamic temperature";
    /// Dimension of thermodynamic temperature, Th (base unit kelvin, K).
    dimension: ESQ<
        Z0,     // length
        Z0,     // mass
        Z0,     // time
        Z0,     // electric current
        P1,     // thermodynamic temperature
        Z0,     // amount of substance
        Z0>;    // luminous intensity
    kind: dyn self::TemperatureKind;
    units {
        /// The kelvin is the SI unit of thermodynamic temperature. It is defined by taking the
        /// fixed numerical value of the Boltzmann constant *k* to be 1.380 649 × 10⁻²³ when
        /// expressed in the unit J K⁻¹, which is equal to kg m² s⁻² K⁻¹, where the kilogram, meter,
        /// and second are defined in terms of *h*, *c*, and ∆*ν*<sub>Cs</sub>.
        @kelvin: 1.0; "K", "kelvin", "kelvins";
    }
}
