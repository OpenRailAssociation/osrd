package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.envelope_sim.PhysicsRollingStock.CurvesAndConditions
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock.TractiveEffortPoint
import fr.sncf.osrd.envelope_sim.etcs.EtcsBrakeParams
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.Distance
import kotlin.math.abs
import kotlin.math.max

class SimpleRollingStock(
    /** the length of the train, in meters. */
    override val length: Double,
    /** The mass of the train, in kilograms. */
    override val mass: Double,
    /**
     * Inertia coefficient. The mass alone isn't sufficient to compute accelerations, as the wheels
     * and internals also need force to get spinning. This coefficient can be used to account for
     * the difference. It's without unit.
     */
    inertiaCoefficient: Double,
    /** in newtons */
    val A: Double,
    /** in newtons / (m/s) */
    val B: Double,
    /** in newtons / (m/s^2) */
    val C: Double,
    /** The max speed of the train, in meters per seconds. */
    override val maxSpeed: Double,
    /** the deceleration of the train, in m/s^2 */
    constGamma: Double,
) : PhysicsRollingStock {
    /** Defined as mass * inertiaCoefficient */
    override val inertia: Double = mass * inertiaCoefficient

    override fun getRollingResistance(speed: Double): Double {
        var speed = speed
        speed = abs(speed)
        // this formula is called the Davis equation.
        // it's completely empirical, and models the drag and friction forces
        return A + B * speed + C * speed * speed
    }

    override fun getRollingResistanceDeriv(speed: Double): Double {
        var speed = speed
        speed = abs(speed)
        return B + 2 * C * speed
    }

    override val etcsBrakeParams: EtcsBrakeParams
        get() = TODO()

    override val deceleration: Double = -constGamma

    override fun mapTractiveEffortCurves(
        electrificationMap: DistanceRangeMap<Electrification>,
        comfort: Comfort?,
    ): CurvesAndConditions {
        return CurvesAndConditions(distanceRangeMapOf(), distanceRangeMapOf())
    }

    /**
     * The tractive effort curve shape. It can be either linear (effort proportional to speed), or
     * hyperbolic (effort inversely proportional to speed -> constant power)
     */
    enum class CurveShape {
        LINEAR,
        HYPERBOLIC,
    }

    companion object {
        private const val MAX_SPEED = 300 / 3.6

        private fun getEffort(curveShape: CurveShape?, speed: Double, maxSpeed: Double): Double {
            if (curveShape == CurveShape.LINEAR) {
                val maxEffort = 450000.0
                val minEffort = 180000.0
                val coeff = speed / maxSpeed
                return maxEffort + (minEffort - maxEffort) * coeff
            }
            val maxEffort = 3600000.0
            return maxEffort / max(1.0, speed)
        }

        /** Creates the effort speed curve, from a given max speed and curve shape */
        @JvmStatic
        fun createEffortSpeedCurve(
            maxSpeed: Double,
            curveShape: CurveShape,
        ): Array<TractiveEffortPoint> {
            val newEffortCurve = ArrayList<TractiveEffortPoint>()

            var speed = 0
            while (speed < maxSpeed) {
                val effort: Double = getEffort(curveShape, speed.toDouble(), maxSpeed)
                newEffortCurve.add(TractiveEffortPoint(speed.toDouble(), effort))
                speed += 1
            }
            newEffortCurve.add(
                TractiveEffortPoint(maxSpeed, getEffort(curveShape, maxSpeed, maxSpeed))
            )
            return newEffortCurve.toTypedArray<TractiveEffortPoint>()
        }

        /** Creates a range of effort points, from a given max speed and curve shape */
        fun createEffortCurveMap(
            maxSpeed: Double,
            curveShape: CurveShape,
        ): DistanceRangeMap<Array<TractiveEffortPoint>> =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(
                    lower = Distance.ZERO,
                    upper = Distance(Long.MAX_VALUE),
                    value = createEffortSpeedCurve(maxSpeed, curveShape),
                )
            )

        /**
         * ======================================================== Constant rolling stocks and
         * curves
         * ===========================================================
         */
        fun build(length: Double, constGamma: Double): SimpleRollingStock {
            val trainMass = 850000.0 // in kilos
            return SimpleRollingStock(
                length,
                trainMass,
                1.05,
                (0.65 * trainMass) / 100,
                ((0.008 * trainMass) / 100) * 3.6,
                (((0.00012 * trainMass) / 100) * 3.6) * 3.6,
                MAX_SPEED,
                constGamma,
            )
        }

        @JvmField
        val LINEAR_EFFORT_CURVE_MAP: DistanceRangeMap<Array<TractiveEffortPoint>> =
            createEffortCurveMap(MAX_SPEED, CurveShape.LINEAR)

        val HYPERBOLIC_EFFORT_CURVE_MAP: DistanceRangeMap<Array<TractiveEffortPoint>> =
            createEffortCurveMap(MAX_SPEED, CurveShape.HYPERBOLIC)

        val SHORT_TRAIN: SimpleRollingStock = build(1.0, .5)

        @JvmField val STANDARD_TRAIN: SimpleRollingStock = build(400.0, .5)

        val MAX_DEC_TRAIN: SimpleRollingStock = build(400.0, .95)
    }
}
