package fr.sncf.osrd.train

import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock.CurvesAndConditions
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock.InfraConditions
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock.TractiveEffortPoint
import fr.sncf.osrd.envelope_sim.etcs.EtcsBrakeParams
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.legacy_objects.electrification.Electrified
import fr.sncf.osrd.path.legacy_objects.electrification.Neutral
import fr.sncf.osrd.path.legacy_objects.electrification.NonElectrified
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import java.util.*
import kotlin.math.abs

/** The immutable characteristics of a specific train. */
data class RollingStock
@JvmOverloads
constructor(
    val id: String?,
    /** the length of the train, in meters. */
    override val length: Double,
    /** The mass of the train, in kilograms. */
    override val mass: Double,
    /**
     * Inertia coefficient. The mass alone isn't sufficient to compute accelerations, as the wheels
     * and internals also need force to get spinning. This coefficient can be used to account for
     * the difference. It's without unit.
     */
    val inertiaCoefficient: Double,
    /** in newtons */
    val A: Double,
    /** in newtons / (m/s) */
    val B: Double,
    /** in newtons / (m/s^2) */
    val C: Double,
    /** The max speed of the train, in meters per seconds. */
    override val maxSpeed: Double,
    /**
     * The time the train takes to start up, in seconds. During this time, the train's maximum
     * acceleration is limited.
     */
    val startUpTime: Double,
    /** The acceleration to apply during the startup state. */
    val startUpAcceleration: Double,
    /** The maximum acceleration when the train is in its regular operating mode. */
    val comfortAcceleration: Double,
    /** the deceleration of the train, in m/s^2 */
    val constGamma: Double,
    val optionalEtcsBrakeParams: EtcsBrakeParams?,
    val loadingGaugeType: RJSLoadingGaugeType,
    /**
     * Associates a speed to a force.
     * https://en.wikipedia.org/wiki/Tractive_force#Tractive_effort_curves
     */
    private val modes: Map<String, ModeEffortCurves>,
    private val defaultMode: String,
    @JvmField val basePowerClass: String?,
    @JvmField val powerRestrictions: Map<String, String> = mapOf(),
    val electricalPowerStartUpTime: Double? = 0.0,
    override val raisePantographTime: Double? = 0.0,
    val supportedSignalingSystems: Array<String>,
) : PhysicsRollingStock {
    /** Defined as mass * inertiaCoefficient */
    override val inertia: Double = mass * inertiaCoefficient

    override val etcsBrakeParams: EtcsBrakeParams
        get() = optionalEtcsBrakeParams!!

    init {
        assert(
            !this.isElectric ||
                (this.electricalPowerStartUpTime != null && this.raisePantographTime != null)
        ) {
            "Electrical power start up time and Raise pantograph time must be defined for an electric train"
        }
    }

    /**
     * Gets the rolling resistance at a given speed, which is a force that always goes opposite to
     * the train's movement direction
     */
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

    override fun mapTractiveEffortCurves(
        electrificationMap: DistanceRangeMap<Electrification>,
        comfort: Comfort?,
    ): CurvesAndConditions {
        val conditionsUsed = DistanceRangeMapImpl<InfraConditions>()
        val curves = DistanceRangeMapImpl<Array<TractiveEffortPoint>>()

        electrificationMap.forEach { lower, upper, electrification ->
            val curveAndCond = findTractiveEffortCurve(comfort, electrification)
            curves.put(lower, upper, curveAndCond.curve)
            conditionsUsed.put(lower, upper, curveAndCond.cond)
        }
        return CurvesAndConditions(curves, conditionsUsed)
    }

    @JvmRecord
    data class ModeEffortCurves(
        val isElectric: Boolean,
        val defaultCurve: Array<TractiveEffortPoint>,
        val curves: Array<ConditionalEffortCurve>,
    )

    @JvmRecord
    data class ConditionalEffortCurve(
        val cond: EffortCurveConditions,
        val curve: Array<TractiveEffortPoint>,
    ) {
        fun scale(lambda: Double): ConditionalEffortCurve {
            return ConditionalEffortCurve(cond, scaleCurve(curve, lambda))
        }
    }

    @JvmRecord
    data class EffortCurveConditions(
        @JvmField val comfort: Comfort?,
        @JvmField val electricalProfile: String?,
        @JvmField val powerRestriction: String?,
    ) {
        /**
         * Returns true if the conditions are met If comfort condition is null then it matches any
         * comfort, same for electrical profile
         */
        fun match(other: EffortCurveConditions): Boolean {
            return (this.comfort == null || other.comfort == this.comfort) &&
                (this.electricalProfile == null ||
                    this.electricalProfile == other.electricalProfile) &&
                (this.powerRestriction == null || this.powerRestriction == other.powerRestriction)
        }
    }

    @JvmRecord
    private data class CurveAndCondition(
        val curve: Array<TractiveEffortPoint>,
        val cond: InfraConditions,
    )

    override val deceleration: Double = -constGamma

    /**
     * Returns whether the train should coast while crossing this neutral section or use its
     * (thermal) traction
     */
    private fun shouldCoast(n: Neutral, comfort: Comfort?): Boolean {
        val overlappedCurve = findTractiveEffortCurve(comfort, n.overlappedElectrification)
        return modes[overlappedCurve.cond.mode]!!.isElectric
    }

    /**
     * Returns the tractive effort curve that matches best, along with the electrification
     * conditions that matched
     */
    private fun findTractiveEffortCurve(
        comfort: Comfort?,
        electrification: Electrification,
    ): CurveAndCondition {
        if (electrification is Neutral) {
            return if (shouldCoast(electrification, comfort)) {
                CurveAndCondition(COASTING_CURVE, InfraConditions(null, null, null))
            } else {
                findTractiveEffortCurve(comfort, electrification.overlappedElectrification)
            }
        }
        if (electrification is NonElectrified) {
            return CurveAndCondition(
                modes[defaultMode]!!.defaultCurve,
                InfraConditions(defaultMode, null, null),
            )
        }

        val electrified = electrification as Electrified

        val usedMode = if (modes.containsKey(electrified.mode)) electrified.mode else defaultMode
        val mode: ModeEffortCurves = modes[usedMode]!!
        val chosenCond =
            EffortCurveConditions(comfort, electrified.profile, electrified.powerRestriction)
        // Get first matching curve
        for (condCurve in mode.curves) {
            if (condCurve.cond.match(chosenCond)) {
                return CurveAndCondition(
                    condCurve.curve,
                    InfraConditions(
                        usedMode,
                        condCurve.cond.electricalProfile,
                        condCurve.cond.powerRestriction,
                    ),
                )
            }
        }
        return CurveAndCondition(mode.defaultCurve, InfraConditions(usedMode, null, null))
    }

    /**
     * Returns the tractive effort curves corresponding to the electrical conditions map with
     * neutral sections
     *
     * @param electrificationMap The map of electrification conditions to use
     * @param comfort The comfort level to get the curves for
     */
    fun addNeutralSystemTimes(
        electrificationMap: DistanceRangeMap<Electrification>,
        comfort: Comfort,
        curvesUsed: DistanceRangeMap<Array<TractiveEffortPoint>>,
    ): DistanceRangeMap<Array<TractiveEffortPoint>> {
        val newCurves = DistanceRangeMapImpl<Array<TractiveEffortPoint>>()
        newCurves.putMany(curvesUsed)

        electrificationMap.forEach { lower, upper, value ->
            if (value is Neutral) {
                if (!shouldCoast(value, comfort)) {
                    return@forEach
                }
                // estimate the distance during which the train will be coasting, due to having
                // respected the neutral section
                val curveAndCondition = findTractiveEffortCurve(comfort, value)
                if (curveAndCondition.cond.mode == null) { // The train is effectively coasting
                    newCurves.put(lower, upper, curveAndCondition.curve)
                }
            }
        }
        return newCurves
    }

    val modeNames: Set<String>
        get() = modes.keys

    val isThermal: Boolean
        /** Return whether this rolling stock's default mode is thermal */
        get() = !modes[defaultMode]!!.isElectric

    val isElectric: Boolean
        /** Return whether this rolling stock's has an electric mode */
        get() = modes.values.stream().anyMatch(ModeEffortCurves::isElectric)

    fun scalePower(lambda: Double): RollingStock {
        if (lambda == 1.0) return this
        val newModes = HashMap<String, ModeEffortCurves>(modes)
        for (entry in newModes.entries) {
            val value = entry.value

            entry.setValue(
                ModeEffortCurves(
                    value.isElectric,
                    scaleCurve(value.defaultCurve, lambda),
                    value.curves.map { it.scale(lambda) }.toTypedArray(),
                )
            )
        }
        return copy(modes = newModes)
    }
}

private val COASTING_CURVE = arrayOf(TractiveEffortPoint(0.0, 0.0), TractiveEffortPoint(1.0, 0.0))

private fun scaleCurve(
    old: Array<TractiveEffortPoint>,
    lambda: Double,
): Array<TractiveEffortPoint> {
    return old.map { TractiveEffortPoint(it.speed, it.maxEffort * lambda) }.toTypedArray()
}
