package fr.sncf.osrd.tsim

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.envelope_sim.*
import fr.sncf.osrd.envelope_sim.etcs.BrakingType
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.train.RollingStock
import java.util.function.BiFunction

typealias Seconds = Double

typealias Meters = Double

typealias MetersPerSecond = Double

typealias SecondArray = DoubleArray

typealias MeterArray = DoubleArray

typealias MeterPerSecondArray = DoubleArray

/**
 * Update a [RangeMap] representing a Speed Profile, accounting for the length of the rolling stock.
 *
 * The given [RangeMap] contains the ranges on the path with speed limits (indicated by signs or
 * signals). The returned [RangeMap] will report, for given positions of the rolling stock's head,
 * ranges on the path where the rolling stock cannot exceed a certain speed limit, because even if
 * pass the sign, as long as its tail is behind the sign the speed limit is still enforced.
 */
fun RangeMap<Meters, MetersPerSecond>.withStockLength(
    stockLength: Meters
): RangeMap<Meters, MetersPerSecond> {
    val map = TreeRangeMap.create<Meters, MetersPerSecond>()
    for (entry in asMapOfRanges()) {
        val range = entry.key
        val speedLimit = entry.value

        // The speed limit is enforced as long as part of the rolling stock is behind the reset sign
        // TODO what's the name of the sign that reset a speed limit?
        val enforcementRange =
            Range.closed(range.lowerEndpointOrInf(), range.upperEndpointOrInf() + stockLength)
        val newSubMap = ImmutableRangeMap.builder<Meters, MetersPerSecond>()
        newSubMap.put(enforcementRange, speedLimit)

        // Other, more restrictive speed limits might be in place
        for (e in map.subRangeMap(enforcementRange).asMapOfRanges()) {
            if (e.value < speedLimit) {
                newSubMap.put(e.key, e.value)
            }
        }

        map.putAll(newSubMap.build())
    }
    return map
}

/**
 * A [RangeMap] of neutral zones accounting for the positions of the pantographs on the rolling
 * stock.
 *
 * This class will report, for given positions of its head, ranges on the path where the rolling
 * stock isn't electrified.
 *
 * This is meant to be immutable (but isn't because [ImmutableRangeMap] inherits from [RangeMap] and
 * not the other way around)
 */
class NeutralZonesWithPantographs(
    /** ranges on the path with neutral zones */
    private val inner: RangeMap<Meters, Boolean>,

    /**
     * list of positions of pantographs, where 0.0 is the head of the stock and `stock.length` is
     * its tail
     */
    vararg pantographPositions: Meters,
) : RangeMap<Meters, Boolean> {
    private val frontPantograph: Meters = pantographPositions.maxOrNull()!!
    private val rearPantograph: Meters = pantographPositions.minOrNull()!!

    constructor() : this(inner = ImmutableRangeMap.of(), 0.0)

    override fun get(head: Meters): Boolean? = getEntry(head)?.value

    override fun getEntry(head: Meters): Map.Entry<Range<Meters>?, Boolean>? =
        inner
            .subRangeMap(Range.closed(head - frontPantograph, head - rearPantograph))
            .asMapOfRanges()
            .maxByOrNull { entry -> entry.value }

    override fun span(): Range<Meters> = inner.span()

    override fun put(range: Range<Meters>, value: Boolean): Unit =
        throw UnsupportedOperationException()

    override fun putCoalescing(range: Range<Meters>, value: Boolean): Unit =
        throw UnsupportedOperationException()

    override fun putAll(rangeMap: RangeMap<Meters, out Boolean>): Unit =
        throw UnsupportedOperationException()

    override fun clear() = inner.clear()

    override fun remove(range: Range<Meters>): Unit = throw UnsupportedOperationException()

    override fun merge(
        range: Range<Meters>,
        value: Boolean?,
        remappingFunction: BiFunction<in Boolean, in Boolean?, out Boolean?>,
    ): Unit = throw UnsupportedOperationException()

    override fun asMapOfRanges(): Map<Range<Meters>?, Boolean> {
        TODO("Not yet implemented")
    }

    override fun asDescendingMapOfRanges(): Map<Range<Meters>?, Boolean> {
        TODO("Not yet implemented")
    }

    override fun subRangeMap(range: Range<Meters>): RangeMap<Meters, Boolean> =
        NeutralZonesWithPantographs(inner.subRangeMap(range), frontPantograph, rearPantograph)
}

/**
 * Update a [RangeMap] representing neutral zones along a path, to account for the position of the
 * pantographs on the rolling stock.
 *
 * This is needed to account for neutral zones that require lowering pantographs: they must be
 * lowered before going TODO: can they be lowered last minute, eg the pantograph is on the back, the
 * train head is in the neutral zone and the pantograph is lowered right before it goes in too?
 */
fun RangeMap<Meters, Boolean>.withPantographPositions(
    vararg positions: Meters
): NeutralZonesWithPantographs = NeutralZonesWithPantographs(this, *positions)

data class Instructions(
    /**
     * Most-Restrictive Speed Profile.
     *
     * Maps positions of the head of the train along the path to the highest allowed speed.
     *
     * This doesn't need to account for the train's max speed.
     */
    val mrsp: RangeMap<Meters, MetersPerSecond> = TreeRangeMap.create(),

    /**
     * Ranges of the path that aren't electrified.
     *
     * Maps ranges of the path to whether the neutral zone requires lowering the pantograph.
     */
    val neutralZones: NeutralZonesWithPantographs = NeutralZonesWithPantographs(),

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
