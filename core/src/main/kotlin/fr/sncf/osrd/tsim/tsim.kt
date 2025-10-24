package fr.sncf.osrd.tsim

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import fr.sncf.osrd.envelope_sim.*
import fr.sncf.osrd.envelope_sim.etcs.BrakingType
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.train.RollingStock

typealias Seconds = Double

typealias Meters = Double

typealias MetersPerSecond = Double

typealias SecondArray = DoubleArray

typealias MeterArray = DoubleArray

typealias MeterPerSecondArray = DoubleArray

data class Instructions(
    /**
     * Most-Restrictive Speed Profile.
     *
     * This doesn't need to account for the train's max speed.
     */
    // ?? ImmutableRangeMap inherits RangeMap and not the other way around?
    val mrsp: RangeMap<Meters, MetersPerSecond> = ImmutableRangeMap.of(),

    /**
     * Ranges of the path that aren't electrified.
     *
     * Maps ranges of the path to whether the neutral zone requires lowering the pantograph.
     */
    val neutralZones: RangeMap<Meters, Boolean> = ImmutableRangeMap.of(),

    // TODO Stop?
)

internal class DecelerationTarget(
    /** Target position where [speed] must be reached. */
    val position: Meters,

    /** Braking type used to achieve the target [speed], or `null` if coasting */
    val brake: BrakingType?,

    /** Target speed to reach at [position] */
    val speed: MetersPerSecond,
)

/**
 * A 2D curve.
 *
 * This class represents a list of 2D points `(xs[i],ys[i])` connected by straight lines. [xs] and
 * [ys] must have the same size. The elements of [xs] are expected to be strictly increasing.
 */
internal class Curve(val xs: DoubleArray, val ys: DoubleArray) {
    init {
        require(xs.size == ys.size) { "xs and ys must be the same size" }
    }

    val size: Int
        get() = xs.size

    /**
     * Linear intERPolation of the Y value of the curve at the given [x] position
     *
     * If [x] is out of bounds, returns the first or the last value of [ys].
     */
    fun lerp(x: Double): Double {
        // Edge cases where we don't have two points to interpolate
        if (x >= xs.last()) {
            return ys.last()
        }
        if (x <= xs.first()) {
            return ys.first()
        }

        val result = xs.binarySearch(x)
        if (result >= 0) {
            // Landed right on a point of the curve
            return ys[result]
        }

        // Index where `x` should be inserted in `xs` to preserve order. It is
        // ensured to be higher than 1 and lower than `size-1`, otherwise `x`
        // is lower than `x.first()` or higher than `xs.last()` and these cases
        // are handled above.
        val hi = -result - 1

        val lo = hi - 1

        return ys[lo] + (ys[hi] - ys[lo]) * (x - xs[lo]) / (xs[hi] - xs[lo])
    }
}

/**
 * Context of a simulation, caching expensive values for a given [path], rolling [stock] and
 * tractive [effortCurveMap].
 */
class Context(
    val path: PhysicsPath,
    val stock: RollingStock,
    val effortCurveMap: RangeMap<Meters, Array<PhysicsRollingStock.TractiveEffortPoint>>,
) {
    /**
     * Maps [DecelerationTarget]s to [Curve]s that specify the highest speed the rolling [stock] can
     * have at each given position in order to reach the speed target with the given brakes.
     *
     * The curve ends right on the speed target, and starts right before the speed limit is lower
     * than the rolling stock's max speed.
     */
    private val decelerationCurves = mutableMapOf<DecelerationTarget, Curve>()

    internal fun decelerationCurve(target: DecelerationTarget, dt: Seconds): Curve {
        var curve = decelerationCurves[target]
        if (curve != null) {
            return curve
        }

        val evsimCtx = EnvelopeSimContext(stock, path, dt, effortCurveMap)
        val action = if (target.brake != null) Action.BRAKE else Action.COAST

        var position = target.position
        var speed = target.speed
        var stepCount = 0
        stepCount++ // count the step (target.position, target.speed)
        while (speed < stock.maxSpeed) {
            val s =
                TrainPhysicsIntegrator.step(evsimCtx, position, speed, action, -1.0, target.brake)
            assert(s.timeDelta == dt)
            position += s.positionDelta
            speed = s.endSpeed
            stepCount++
        }

        val positions = MeterArray(stepCount)
        val speeds = MeterPerSecondArray(stepCount)

        var i = stepCount - 1
        positions[i] = target.position
        speeds[i] = target.speed
        while (i > 0) {
            i--
            val s =
                TrainPhysicsIntegrator.step(
                    evsimCtx,
                    positions[i + 1],
                    speeds[i + 1],
                    action,
                    -1.0,
                    target.brake,
                )
            positions[i] = positions[i + 1] + s.positionDelta
            speeds[i] = s.endSpeed
        }

        curve = Curve(positions, speeds)
        decelerationCurves[target] = curve
        return curve
    }
}

/**
 * Simulate a given rolling stock going along a given path starting at [position] and going at
 * [speed] for a given time [dt].
 *
 * The context [ctx] may be reused between calls to improve performance.
 */
fun step(
    ctx: Context,
    instructions: Instructions,

    /** Must be strictly positive */
    dt: Seconds,

    /** Must be positive */
    position: Meters,

    /** Must be positive */
    speed: MetersPerSecond,
): IntegrationStep {
    require(dt > 0.0) { "dt must be strictly positive" }
    require(position >= 0.0) { "position must be positive" }
    require(speed >= 0.0) { "speed must be positive" }

    // TODO update mrsp to account for the whole stock length

    var action = Action.ACCELERATE

    val mrsp = instructions.mrsp.subRangeMap(Range.greaterThan(position))
    if ((mrsp.get(position) ?: Double.POSITIVE_INFINITY) < speed) {
        action = Action.BRAKE
    } else {
        for (speedRestriction in mrsp.asMapOfRanges()) {
            val range = speedRestriction.key
            val maxSpeed = speedRestriction.value
            val target =
                DecelerationTarget(
                    position = range.lowerEndpointOrInf(),
                    brake = BrakingType.CONSTANT,
                    speed = maxSpeed,
                )
            val c = ctx.decelerationCurve(target, dt)
            val speedLimitAtStockHead = c.lerp(position)
            if (speed >= speedLimitAtStockHead) {
                action = Action.BRAKE
                break
            }
        }
    }

    val evsimCtx = EnvelopeSimContext(ctx.stock, ctx.path, dt, ctx.effortCurveMap)
    val s =
        TrainPhysicsIntegrator.step(evsimCtx, position, speed, action, 1.0, BrakingType.CONSTANT)

    // TODO correct step s according to mrsp

    return s
}
