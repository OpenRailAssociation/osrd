package fr.sncf.osrd.envelope_sim.etcs

/**
 * Formulas are found in `SUBSET-026-3v400.pdf` from the file at
 * https://www.era.europa.eu/system/files/2023-09/index004_-_SUBSET-026_v400.zip and in
 * `SUBSET-041_v400.pdf` from the file at
 * https://www.era.europa.eu/system/files/2023-09/index014_-_SUBSET-041_v400.pdf
 */

/**
 * National Default Value: permission to inhibit the compensation of the speed measurement accuracy.
 * See Subset 026: table in Appendix A.3.2.
 */
const val Q_NVINHSMICPERM = false

/**
 * National Default Value: permission to follow release speed at 40km/h near the EoA. See Subset
 * 026: table in Appendix A.3.2.
 */
const val NATIONAL_RELEASE_SPEED = 40.0 / 3.6 // m/s

/**
 * Estimated acceleration during tBerem, worst case scenario (aEst2 is between 0 and 0.4), expressed
 * in m/s². See Subset 026: §3.13.9.3.2.9.
 */
const val A_EST_2 = 0.4

/** See Subset 026: table in Appendix A.3.1. */
const val DV_EBI_MIN = 7.5 / 3.6 // m/s
const val DV_EBI_MAX = 15.0 / 3.6 // m/s
const val V_EBI_MIN = 110.0 / 3.6 // m/s
const val V_EBI_MAX = 210.0 / 3.6 // m/s
const val T_WARNING = 2.0 // s
const val T_DRIVER = 4.0 // s
const val M_ROTATING_MIN = 2.0 // %
const val M_ROTATING_MAX = 15.0 // %

/** See Subset 041: §5.3.1.2. */
const val V_URA_MIN_LIMIT = 30 / 3.6 // m/s
const val V_URA_MAX_LIMIT = 500 / 3.6 // m/s
const val V_URA_MIN = 2 / 3.6 // m/s
const val V_URA_MAX = 12 / 3.6 // m/s

/** See Subset 041: §5.3.1.2. */
fun vUra(speed: Double): Double {
    return interpolateLinearSpeed(speed, V_URA_MIN_LIMIT, V_URA_MAX_LIMIT, V_URA_MIN, V_URA_MAX)
}

/** See Subset 026: §3.13.9.3.2.10. */
fun vDelta0(speed: Double): Double {
    return if (!Q_NVINHSMICPERM) vUra(speed) else 0.0
}

/** See Subset 026: §3.13.9.2.3. */
fun dvEbi(speed: Double): Double {
    return interpolateLinearSpeed(speed, V_EBI_MIN, V_EBI_MAX, DV_EBI_MIN, DV_EBI_MAX)
}

/**
 * The linear curve is the following: below minSpeedLimit = minSpeed, above maxSpeedLimit =
 * maxSpeed, in between is a linear curve. This method takes a speed input and converts it
 * accordingly.
 */
private fun interpolateLinearSpeed(
    speed: Double,
    minSpeedLimit: Double,
    maxSpeedLimit: Double,
    minSpeed: Double,
    maxSpeed: Double,
): Double {
    return if (speed <= minSpeedLimit) minSpeed
    else if (speed < maxSpeedLimit)
        (maxSpeed - minSpeed) / (maxSpeedLimit - minSpeedLimit) * (speed - minSpeedLimit) + minSpeed
    else maxSpeed
}
