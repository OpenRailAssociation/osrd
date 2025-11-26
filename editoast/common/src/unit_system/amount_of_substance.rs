//! Amount of substance (base unit mole, mol).

quantity! {
    /// Amount of substance (base unit mole, mol).
    quantity: AmountOfSubstance; "amount of substance";
    /// Dimension of amount of substance, N (base unit mole, mol).
    dimension: ESQ<
        Z0,     // length
        Z0,     // mass
        Z0,     // time
        Z0,     // electric current
        Z0,     // thermodynamic temperature
        P1,     // amount of substance
        Z0>;    // luminous intensity
    units {
        /// 1. The mole is the SI unit of amount of substance. One mole contains exactly
        ///    6.022 140 76 × 10²³ elementary entities. This number is the fixed numerical value of
        ///    the Avogadro constant, *N*<sub>A</sub>, when expressed in the unit mol⁻¹ and is
        ///    called the Avogadro number.
        /// 2. The amount of substance, symbol *n*, of a system is a measure of the number of
        ///    specified elementary entities. An elementary entity may be an atom, a molecule, an
        ///    ion, an electron, any other particle or specified group of particles.
        @mole: 1.0; "mol", "mole", "moles";
    }
}
