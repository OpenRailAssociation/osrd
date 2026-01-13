package fr.sncf.osrd.envelope_sim.etcs

import fr.sncf.osrd.railjson.schema.rollingstock.RJSEtcsBrakeParams
import kotlin.math.abs

/**
 * Braking parameters for ERTMS ETCS Level 2 Commented with their names in ETCS specification
 * document `SUBSET-026-3 v400.pdf` from the file at
 * https://www.era.europa.eu/system/files/2023-09/index004_-_SUBSET-026_v400.zip
 */
class EtcsBrakeParams(
    /** A_brake_emergency: the emergency deceleration curve (values > 0 m/s²) */
    private val gammaEmergency: SpeedIntervalValueCurve,
    /** A_brake_service: the full service deceleration curve (values > 0 m/s²) */
    private val gammaService: SpeedIntervalValueCurve,
    /**
     * A_brake_normal_service: the normal service deceleration curve used to compute guidance curve
     * (values > 0 m/s²)
     */
    private val gammaNormalService: SpeedIntervalValueCurve,
    /**
     * Kdry_rst: the rolling stock deceleration correction factors for dry rails Boundaries should
     * be the same as gammaEmergency Values (no unit) should be contained in [0, 1]
     */
    private val kDry: SpeedIntervalValueCurve,
    /**
     * Kwet_rst: the rolling stock deceleration correction factors for wet rails Boundaries should
     * be the same as gammaEmergency Values (no unit) should be contained in [0, 1]
     */
    private val kWet: SpeedIntervalValueCurve,
    /**
     * Kn+: the correction acceleration factor on normal service deceleration in positive gradients
     * Values (in m/s²) should be contained in [0, 10]
     */
    private val kNPos: SpeedIntervalValueCurve,
    /**
     * Kn-: the correction acceleration factor on normal service deceleration in negative gradients
     * Values (in m/s²) should be contained in [0, 10]
     */
    private val kNNeg: SpeedIntervalValueCurve,
    /**
     * T_traction_cut_off: time delay in s from the traction cut-off command to the moment the
     * acceleration due to traction is zero
     */
    val tTractionCutOff: Double,
    /** T_bs1: time service break in s used for SBI1 computation */
    val tBs1: Double,
    /** T_bs2: time service break in s used for SBI2 computation */
    val tBs2: Double,
    /** T_be: safe brake build up time in s */
    val tBe: Double,
) {
    /** See Subset §3.13.6.2.1.4. */
    fun getSafeBrakingAcceleration(speed: Double): Double {
        val aBrakeEmergency = getEmergencyBrakingDeceleration(speed)
        val kDry = getRollingStockCorrectionFactorDry(speed)
        val kWet = getRollingStockCorrectionFactorWet(speed)
        return kDry * (kWet + mNvavadh * (1 - kWet)) * aBrakeEmergency
    }

    private fun getEmergencyBrakingDeceleration(speed: Double): Double {
        return gammaEmergency.getValue(speed)
    }

    /**
     * Corresponds to the correction factor of the emergency brake deceleration on dry tracks. The
     * confidence level mNvebcl is the confidence level that the corresponding deceleration can be
     * reached, but does not impact the calculation of kDry. See Subset §3.13.6.2.1.7.
     */
    private fun getRollingStockCorrectionFactorDry(speed: Double): Double {
        return kDry.getValue(speed)
    }

    /** Corresponds to the correction factor of the emergency brake deceleration on wet tracks. */
    private fun getRollingStockCorrectionFactorWet(speed: Double): Double {
        return kWet.getValue(speed)
    }

    fun getServiceBrakingAcceleration(speed: Double): Double {
        return gammaService.getValue(speed)
    }

    fun getNormalServiceBrakingAcceleration(speed: Double): Double {
        return gammaNormalService.getValue(speed)
    }

    /**
     * Gradient acceleration correction using on-board correction factors kN+ and kN-. See Subset,
     * §3.13.6.4.2 and §3.13.6.4.3.
     */
    fun getGradientAccelerationCorrection(grade: Double, speed: Double): Double {
        val k = if (grade >= 0) kNPos.getValue(speed) else kNNeg.getValue(speed)
        return -k * grade / 1000
    }

    class SpeedIntervalValueCurve(
        /**
         * Speed in m/s (sorted ascending). External bounds are implicit to
         * [0, rolling_stock.max_speed]
         */
        var boundaries: DoubleArray,
        /**
         * Interval values (unit to be made explicit at use) There must be one more value than
         * boundaries
         */
        var values: DoubleArray,
    ) {
        fun getValue(speed: Double): Double {
            assert(values.size == boundaries.size + 1)
            var index = 0
            val absSpeed = abs(speed)
            for (boundary in boundaries) {
                if (absSpeed <= boundary) {
                    return values[index]
                }
                index++
            }
            return values[index]
        }
    }
}

/** National Default Value: Available Adhesion. Found in Subset Appendix A.3.2 table. */
private const val mNvavadh = 0.0

fun RJSEtcsBrakeParams.toEtcsBrakeParams(): EtcsBrakeParams =
    EtcsBrakeParams(
        gammaEmergency = gammaEmergency.toSpeedIntervalValueCurve(),
        gammaService = gammaService.toSpeedIntervalValueCurve(),
        gammaNormalService = gammaNormalService.toSpeedIntervalValueCurve(),
        kDry = kDry.toSpeedIntervalValueCurve(),
        kWet = kWet.toSpeedIntervalValueCurve(),
        kNPos = kNPos.toSpeedIntervalValueCurve(),
        kNNeg = kNNeg.toSpeedIntervalValueCurve(),
        tTractionCutOff = tTractionCutOff,
        tBs1 = tBs1,
        tBs2 = tBs2,
        tBe = tBe,
    )

fun RJSEtcsBrakeParams.RJSSpeedIntervalValueCurve.toSpeedIntervalValueCurve():
    EtcsBrakeParams.SpeedIntervalValueCurve =
    EtcsBrakeParams.SpeedIntervalValueCurve(boundaries = boundaries, values = values)
