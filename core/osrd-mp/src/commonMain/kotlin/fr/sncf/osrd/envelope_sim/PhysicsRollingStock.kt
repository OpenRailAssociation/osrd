package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.envelope_sim.etcs.EtcsBrakeParams
import fr.sncf.osrd.envelope_sim.etcs.M_ROTATING_MAX
import fr.sncf.osrd.envelope_sim.etcs.M_ROTATING_MIN
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.utils.DistanceRangeMap
import kotlin.jvm.JvmRecord
import kotlin.math.abs

interface PhysicsRollingStock {
    /** The mass of the train, in kilograms */
    val mass: Double

    /** The inertia of the train, in newtons (usually computed from mass * inertiaCoefficient) */
    val inertia: Double

    /** The length of the train, in meters */
    val length: Double

    /** The maximum speed the train can reach, in m/s */
    val maxSpeed: Double

    /** The resistance to movement at a given speed, in newtons */
    fun getRollingResistance(speed: Double): Double

    /** The first derivative of the resistance to movement at a given speed, in kg/s */
    fun getRollingResistanceDeriv(speed: Double): Double

    val etcsBrakeParams: EtcsBrakeParams

    /** The maximum constant deceleration, in m/s^2 */
    val deceleration: Double

    /**
     * Returns the tractive effort curves corresponding to the electrical conditions map. The
     * neutral sections are not extended in this function.
     *
     * @param electrificationMap The map of electrification conditions to use along the path.
     * @param comfort The comfort level to get the curves for.
     */
    fun mapTractiveEffortCurves(
        electrificationMap: DistanceRangeMap<Electrification>,
        comfort: Comfort?,
    ): CurvesAndConditions

    data class CurvesAndConditions(
        val curves: DistanceRangeMap<Array<TractiveEffortPoint>>,
        val conditions: DistanceRangeMap<InfraConditions>,
    )

    @JvmRecord
    data class InfraConditions(
        val mode: String?,
        val electricalProfile: String?,
        val powerRestriction: String?,
    )

    /** The maximum acceleration, in m/s^2, which can be applied at a given speed, in m/s */
    data class TractiveEffortPoint(val speed: Double, val maxEffort: Double)

    companion object {
        /** Get the effort the train can apply at a given speed, in newtons */
        fun getMaxEffort(speed: Double, tractiveEffortCurve: Array<TractiveEffortPoint>): Double {
            var index = 0
            var left = 0
            var right = tractiveEffortCurve.size - 1
            while (left <= right) {
                // this line is to calculate the mean of the two values
                val mid = (left + right) ushr 1
                if (abs(tractiveEffortCurve[mid].speed - abs(speed)) < 0.000001) {
                    index = mid
                    break
                } else if (tractiveEffortCurve[mid].speed < abs(speed)) {
                    left = mid + 1
                    index = left
                } else {
                    right = mid - 1
                }
            }
            if (index == 0) {
                return tractiveEffortCurve[0].maxEffort
            }
            if (index == tractiveEffortCurve.size) {
                return tractiveEffortCurve[index - 1].maxEffort
            }
            val previousPoint = tractiveEffortCurve[index - 1]
            val nextPoint = tractiveEffortCurve[index]
            val coeff =
                (previousPoint.maxEffort - nextPoint.maxEffort) /
                    (previousPoint.speed - nextPoint.speed)
            return previousPoint.maxEffort + coeff * (abs(speed) - previousPoint.speed)
        }

        /**
         * The gradient acceleration of the rolling stock taking its rotating mass into account, in
         * m/s². Grade is in m/km. mRotating (Max or Min) is in %, as seen in ERA braking curves
         * simulation tool v5.1.
         */
        fun getGradientAcceleration(grade: Double): Double {
            val mRotating: Double = if (grade >= 0) M_ROTATING_MAX else M_ROTATING_MIN
            return -TrainPhysicsIntegrator.GRAVITY_ACCELERATION * grade /
                (1000.0 + 10.0 * mRotating)
        }
    }
}
