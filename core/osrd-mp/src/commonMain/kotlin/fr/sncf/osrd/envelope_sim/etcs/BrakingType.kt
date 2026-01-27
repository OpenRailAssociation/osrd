package fr.sncf.osrd.envelope_sim.etcs

/**
 * Formulas are found in `SUBSET-026-3v400.pdf` from the file at
 * https://www.era.europa.eu/system/files/2023-09/index004_-_SUBSET-026_v400.zip
 */
enum class BrakingType {
    /** Constant deceleration */
    CONSTANT,
    /** Emergency Brake Deceleration */
    EBD,
    /** Emergency Brake Intervention */
    EBI,
    /** Service Brake Deceleration */
    SBD,
    /** Service Brake Intervention 1 - SBI curve computed from SBD */
    SBI_1,
    /** Service Brake Intervention 2 - SBI curve computed from EBD */
    SBI_2,
    /** Guidance */
    GUI,
    /** Permitted Speed before applying minimum with guidance */
    PRE_PS,
    /** Permitted Speed */
    PS,
    /** Indication */
    IND,
}
