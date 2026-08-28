package fr.sncf.osrd.trainsim

import fr.sncf.osrd.envelope_sim.Action
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.IntegrationStep
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.etcs.BrakingType
import fr.sncf.osrd.utils.toString
import kotlin.collections.windowed
import kotlin.math.max
import kotlin.math.min

internal class PreciseIntegrationStep(
    val timeDelta: PreciseDuration,
    val positionDelta: PreciseDistance,
    val startSpeed: PreciseSpeed,
    val endSpeed: PreciseSpeed,
    val acceleration: PreciseAcceleration,
) {
    fun truncate(startPos: PreciseDistance, newEndPos: PreciseDistance): PreciseIntegrationStep {
        require(startPos < newEndPos)

        val endPos = startPos + positionDelta
        if (endPos <= newEndPos) {
            return this
        }

        val newPositionDelta = newEndPos - startPos
        val timeDelta = newPositionDelta * timeDelta / positionDelta
        val newEndSpeed = startSpeed + acceleration * timeDelta

        return PreciseIntegrationStep(
            timeDelta,
            newPositionDelta,
            startSpeed,
            newEndSpeed,
            acceleration,
        )
    }

    fun truncate(startTime: PreciseDuration, newEndTime: PreciseDuration): PreciseIntegrationStep {
        require(startTime < newEndTime)

        if (startTime + timeDelta <= newEndTime) {
            return this
        }

        val newTimeDelta = newEndTime - startTime
        val newEndSpeed = startSpeed + acceleration * newTimeDelta
        val newPositionDelta = newTimeDelta * (startSpeed + newEndSpeed) / 2

        require(newPositionDelta < positionDelta)

        return PreciseIntegrationStep(
            newTimeDelta,
            newPositionDelta,
            startSpeed,
            newEndSpeed,
            acceleration,
        )
    }
}

internal fun IntegrationStep.toMicros(): PreciseIntegrationStep =
    PreciseIntegrationStep(
        timeDelta = timeDelta.seconds,
        positionDelta = positionDelta.meters,
        startSpeed = startSpeed.metersPerSecond,
        endSpeed = endSpeed.metersPerSecond,
        acceleration = acceleration.metersPerSecond2,
    )

data class PantographState(
    /** Position of the pantograph, between 0.0 (fully down) and 1.0 (fully up) */
    val position: Double,
    val goingUp: Boolean,
) {
    init {
        require(position in 0.0..1.0) { "position must be between 0.0 and 1.0" }
    }

    override fun toString(): String =
        if (position == 1.0 && goingUp) {
            "UP"
        } else if (position == 0.0 && !goingUp) {
            "DOWN"
        } else if (goingUp) {
            "MOVING_UP(${(position * 100).toString(2)}%)"
        } else {
            "MOVING_DOWN(${(position * 100).toString(2)}%)"
        }

    companion object {
        fun up(): PantographState = PantographState(position = 1.0, goingUp = true)
    }

    fun merge(other: PantographState): PantographState =
        PantographState(
            position = min(position, other.position),
            goingUp = goingUp && other.goingUp,
        )

    /** make the pantograph go down without advancing time */
    fun lower(): PantographState = copy(goingUp = false)

    /** make the pantograph go up without advancing time */
    fun raise(): PantographState = copy(goingUp = true)

    fun advance(dt: PreciseDuration, rollingStock: PhysicsRollingStock): PantographState =
        if (goingUp) {
            val raisePantographTime =
                rollingStock.raisePantographTime ?: return copy(position = 1.0)
            copy(position = min(position + (dt.seconds / raisePantographTime), 1.0))
        } else {
            val lowerPantographTime =
                rollingStock.lowerPantographTime ?: return copy(position = 0.0)
            copy(position = max(position - (dt.seconds / lowerPantographTime), 0.0))
        }

    fun isUp(): Boolean = position == 1.0
}

/**
 * In constraint implementations, avoid the use of the primary constructor. Instead, use [brake],
 * [coast] and [accelerate] with the [copy] method. This is because new fields may be required in
 * the future, or old fields removed.
 */
data class TrainState(
    val time: PreciseDuration,
    val position: PreciseDistance,
    val speed: PreciseSpeed,
    val pantograph: PantographState = PantographState.up(),
) {
    init {
        require(time >= 0.microseconds) { "train time must be positive or zero" }
        require(position >= 0.micrometers) { "train position must be positive or zero" }
        require(speed >= 0.micrometersPerSecond) { "train speed must be positive or zero" }
    }

    companion object {
        val zero: TrainState =
            TrainState(
                time = 0.microseconds,
                position = 0.micrometers,
                speed = 0.micrometersPerSecond,
                pantograph = PantographState.up(),
            )
    }

    fun isBefore(other: TrainState): Boolean =
        this.position <= other.position && this.time <= other.time

    /**
     * Merge two states such that the result is the least constrained while still being more
     * constrained than both arguments.
     *
     * TODO document/define this better
     */
    fun merge(previous: TrainState, mostConstrained: TrainState?): TrainState {
        if (mostConstrained == null) {
            return this
        }

        val timeDelta = time - previous.time
        val constrainedTimeDelta = mostConstrained.time - previous.time

        val acceleration = (speed - previous.speed) / timeDelta
        val constrainedAcceleration =
            (mostConstrained.speed - previous.speed) / constrainedTimeDelta
        val newAcceleration = min(acceleration, constrainedAcceleration)

        // Use max instead of min, since going with the lesser acceleration for
        // the longest time is more constrained than going with the lesser
        // acceleration for the shortest time. Also, using min would make smaller
        // and smaller steps in case the accelerating step has the shortest dt.
        val newTime = max(time, mostConstrained.time)
        var newTimeDelta = newTime - previous.time

        var newSpeed = previous.speed + newAcceleration * newTimeDelta

        if (newSpeed < 0.micrometersPerSecond) {
            // Linear interpolate instant when the train stops
            newTimeDelta =
                newTime * previous.speed / (previous.speed - newSpeed) -
                    previous.time * previous.speed / (previous.speed - newSpeed)
            newSpeed = 0.micrometersPerSecond
        }

        val newPosition = previous.position + (previous.speed + newSpeed) * newTimeDelta / 2

        val newPantograph = pantograph.merge(mostConstrained.pantograph) // TODO interpoler le temps

        return TrainState(
            time = newTime,
            position = newPosition,
            speed = newSpeed,
            pantograph = newPantograph,
        )
    }

    fun accelerate(context: EnvelopeSimContext): TrainState {
        val action =
            if (pantograph.isUp() || context.rollingStock.isThermal) {
                Action.ACCELERATE
            } else {
                Action.COAST
            }
        val s =
            TrainPhysicsIntegrator.step(
                    context,
                    position.meters,
                    speed.metersPerSecond,
                    action,
                    directionSign = +1.0,
                )
                .toMicros()
        return TrainState(
            time = time + s.timeDelta,
            position = position + s.positionDelta,
            speed = s.endSpeed,
            pantograph = PantographState.up(),
        )
    }

    fun coast(context: EnvelopeSimContext): TrainState {
        val s =
            TrainPhysicsIntegrator.step(
                    context,
                    position.meters,
                    speed.metersPerSecond,
                    Action.COAST,
                    directionSign = +1.0,
                )
                .toMicros()
        return TrainState(
            time = time + s.timeDelta,
            position = position + s.positionDelta,
            speed = s.endSpeed,
            pantograph = PantographState.up(),
        )
    }

    fun brake(context: EnvelopeSimContext): TrainState {
        val s =
            TrainPhysicsIntegrator.step(
                    context,
                    position.meters,
                    speed.metersPerSecond,
                    Action.BRAKE,
                    directionSign = +1.0,
                )
                .toMicros()
        return TrainState(
            time = time + s.timeDelta,
            position = position + s.positionDelta,
            speed = s.endSpeed,
            pantograph = PantographState.up(),
        )
    }

    fun truncate(oldState: TrainState, newEndPos: PreciseDistance): TrainState {
        require(oldState.isBefore(this))
        require(oldState.position <= newEndPos)

        if (position <= newEndPos || time == oldState.time) {
            return this
        }

        val oldStep =
            PreciseIntegrationStep(
                timeDelta = time - oldState.time,
                positionDelta = position - oldState.position,
                startSpeed = oldState.speed,
                endSpeed = speed,
                acceleration = (speed - oldState.speed) / (time - oldState.time),
            )
        val newStep = oldStep.truncate(oldState.position, newEndPos)
        val truncated =
            TrainState(
                time = oldState.time + newStep.timeDelta,
                position = oldState.position + newStep.positionDelta,
                speed = newStep.endSpeed,
                pantograph = pantograph, // TODO interpoler le temps
            )

        require(truncated.isBefore(this))
        require(oldState.isBefore(truncated))

        return truncated
    }

    fun truncate(oldState: TrainState, newEndTime: PreciseDuration): TrainState {
        require(oldState.isBefore(this))
        require(oldState.time <= newEndTime)

        if (time <= newEndTime || time == oldState.time) {
            return this
        }

        val oldStep =
            PreciseIntegrationStep(
                timeDelta = time - oldState.time,
                positionDelta = position - oldState.position,
                startSpeed = oldState.speed,
                endSpeed = speed,
                acceleration = (speed - oldState.speed) / (time - oldState.time),
            )
        val newStep = oldStep.truncate(oldState.time, newEndTime)
        val truncated =
            TrainState(
                time = oldState.time + newStep.timeDelta,
                position = oldState.position + newStep.positionDelta,
                speed = newStep.endSpeed,
                pantograph = pantograph, // TODO interpoler le temps
            )

        require(truncated.isBefore(this))
        require(oldState.isBefore(truncated))

        return truncated
    }

    fun truncate(oldState: TrainState, speedCurve: Curve): TrainState {
        require(oldState.isBefore(this))

        if (position <= oldState.position) {
            return this
        }

        val point =
            speedCurve.intersectsAt(
                x1 = oldState.position.micrometers,
                y1 = oldState.speed.micrometersPerSecond,
                x2 = position.micrometers,
                y2 = speed.micrometersPerSecond,
            ) ?: return this

        val newEndPos = point.x.micrometers
        val newEndSpeed = point.y.micrometersPerSecond
        val newTimeDelta =
            if (newEndSpeed + oldState.speed <= 4.micrometersPerSecond) {
                return oldState
            } else {
                // This is like (2*newPositionDelta)/(newEndSpeed+startSpeed),
                // but with less likeliness of timeDelta becoming zero.
                newEndPos / (newEndSpeed + oldState.speed) -
                    oldState.position / (newEndSpeed + oldState.speed)
            }

        val truncated =
            copy(time = oldState.time + newTimeDelta, position = newEndPos, speed = newEndSpeed)

        require(oldState.isBefore(truncated))
        require(truncated.isBefore(this))

        return truncated
    }
}

class Driver(
    /**
     * Maximum acceleration in the driver can perform.
     *
     * This may be higher than the rolling stock's maximum acceleration, in which case this value
     * has no effect.
     */
    val maxAcceleration: PreciseAcceleration? = null,

    /**
     * Maximum deceleration in the driver can perform.
     *
     * This may be higher than the rolling stock's maximum deceleration, in which case this value
     * has no effect.
     */
    val maxDeceleration: PreciseAcceleration? = null,

    /**
     * Ratio between the self-imposed speed limit and the railway-imposed speed limit.
     *
     * Must be strictly positive. If [vMaxFactor] is one, then the driver may reach and will respect
     * speed limits. When [vMaxFactor] is lower, the driver won't reach speed limits. When higher,
     * the driver will violate speed limits.
     */
    var vMaxFactor: Double = 1.0,

    /**
     * Length of the rolling stock according to the driver.
     *
     * Used e.g. when instructions only apply after the full rolling stock has passed a signal.
     */
    val perceivedStockLength: PreciseDistance? = null,

    /** Factor between `0.0` and `1.0` to apply to the path's sight distance */
    val sightDistanceFactor: Double = 1.0,
    val sightDistance: PreciseDistance? = null,
) {
    init {
        require(vMaxFactor > 0.0)
    }

    companion object {
        fun default(): Driver {
            return Driver(
                maxAcceleration = 700.micrometersPerSecond2,
                maxDeceleration = 700.micrometersPerSecond2,
                vMaxFactor = 1.0,
                perceivedStockLength = 700.0.meters,
                sightDistanceFactor = 1.0,
                sightDistance = 700.0.meters,
            )
        }
    }
}

/** A constraint that may influence the driving of the train. */
interface Constraint {
    /**
     * Apply the constraint given the [currentState] of the train and return potential states of the
     * train after `dt` where `dt` is between 0.0 exclusive and `context.timeStep` inclusive.
     */
    fun enactDecision(context: EnvelopeSimContext, currentState: TrainState): List<TrainState> =
        listOf()

    /**
     * Apply the constraint given the [currentState] of the train and return the state of the train
     * at `potentialState.time`.
     */
    fun truncateStep(
        context: EnvelopeSimContext,
        currentState: TrainState,
        mergedState: TrainState,
    ): TrainState = mergedState
}

interface Updatable {
    fun update(oldState: TrainState, newState: TrainState)

    fun reset()
}

/**
 * Speed limit signal
 *
 * From [start] to [end], the train must go no higher than [limit].
 */
data class SpeedLimitedZone(
    val start: PreciseDistance,
    val end: PreciseDistance,
    val limit: PreciseSpeed,
) : SpeedConstraint {
    init {
        require(start < end) { "speed limit zone start must be strictly lower than end" }
    }

    override fun speedCurves(context: EnvelopeSimContext, currentState: TrainState): List<Curve> =
        listOf(
            decelerationCurve(context, start, limit * context.driver.vMaxFactor) +
                Vec2(
                    end.micrometers,
                    (limit.micrometersPerSecond * context.driver.vMaxFactor).toLong(),
                )
        )
}

/**
 * Start of a neutral zone
 *
 * From [start] on, the train has no access to electricity. If [lowerPantograph] is `true`, the
 * pantograph must begin to lower no further than [start].
 */
data class NeutralSection(
    val start: PreciseDistance,
    val end: PreciseDistance,
    /** Whether the pantograph must be lowered when entering the zone */
    val lowerPantograph: Boolean,
) : Constraint, Updatable {
    /** Whether the pantograph has been fully raised after leaving the neutral section */
    private var raisedPantograph: Boolean = false

    override fun reset() {
        raisedPantograph = false
    }

    override fun update(oldState: TrainState, newState: TrainState) {
        raisedPantograph =
            raisedPantograph ||
                (newState.position >= end && (!lowerPantograph || newState.pantograph.isUp()))
    }

    override fun enactDecision(
        context: EnvelopeSimContext,
        currentState: TrainState,
    ): List<TrainState> {
        if (
            currentState.position < start ||
                (currentState.position >= end && (!lowerPantograph || raisedPantograph))
        ) {
            return listOf()
        }

        val nextState = currentState.accelerate(context)

        if (currentState.position >= end) {
            return listOf(
                nextState.copy(
                    pantograph =
                        currentState.pantograph
                            .raise()
                            .advance(nextState.time - currentState.time, context.rollingStock)
                )
            )
        }

        if (nextState.position > end) {
            val oldPositionDelta = nextState.position - currentState.position
            val newPositionDelta = end - currentState.position
            val newTimeDelta =
                (nextState.time - currentState.time) * newPositionDelta / oldPositionDelta
            val newSpeedDelta =
                (nextState.speed - currentState.speed) * newPositionDelta / oldPositionDelta

            return if (newTimeDelta > 0.microseconds) {
                listOf(
                    nextState.copy(
                        time = currentState.time + newTimeDelta,
                        position = end,
                        speed = currentState.speed + newSpeedDelta,
                        pantograph =
                            if (lowerPantograph)
                                currentState.pantograph
                                    .advance(newTimeDelta, context.rollingStock)
                                    .raise()
                            else PantographState.up(),
                    )
                )
            } else if (lowerPantograph) {
                listOf(
                    nextState.copy(
                        pantograph =
                            currentState.pantograph
                                .raise()
                                .advance(nextState.time - currentState.time, context.rollingStock)
                    )
                )
            } else {
                listOf(nextState)
            }
        }

        return if (lowerPantograph) {
            listOf(
                nextState.copy(
                    pantograph =
                        currentState.pantograph
                            .lower()
                            .advance(nextState.time - currentState.time, context.rollingStock)
                )
            )
        } else {
            listOf()
        }
    }

    override fun truncateStep(
        context: EnvelopeSimContext,
        currentState: TrainState,
        mergedState: TrainState,
    ): TrainState {
        if (
            currentState.position >= end ||
                (currentState.position >= start && mergedState.position <= end) ||
                mergedState.position <= start
        ) {
            return mergedState
        }

        if (currentState.position < start) {
            val nextState = mergedState.truncate(currentState, start)
            if (currentState.time < nextState.time) {
                return nextState
            }
        }

        // mergedState.position >= end
        val nextState = mergedState.truncate(currentState, end)
        return if (currentState.time < nextState.time) {
            nextState
        } else {
            mergedState
        }
    }
}

/**
 * Short-slip stop signal
 *
 * When closer than 300 meters from this signal, the train must go no higher than 27kph. When closer
 * than 100 meters from this signal, the train must go no higher than 10kph.
 */
sealed class ShortSlipStop(val position: PreciseDistance) : SpeedConstraint {
    override fun speedCurves(context: EnvelopeSimContext, currentState: TrainState): List<Curve> =
        listOf(
            decelerationCurve(context, position - 300.0.meters, 27.0.kph),
            decelerationCurve(context, position - 100.0.meters, 10.0.kph),
        )
}

/**
 * Stop on the train path.
 *
 * The train must stop at [position] for the duration of [duration].
 */
class Stop(val position: PreciseDistance, val initialDuration: PreciseDuration) :
    SpeedConstraint, Updatable {
    /** The stop duration, or `null` if the stop doesn't apply. */
    private var duration: PreciseDuration? = initialDuration.takeIf { it >= 0.microseconds }

    /** Deceleration curve cache */
    private var stopCurve: Curve? = null

    override fun speedCurves(context: EnvelopeSimContext, currentState: TrainState): List<Curve> {
        if (duration == null) {
            return listOf()
        }

        if (stopCurve == null) {
            stopCurve =
                decelerationCurve(context, position, 0.micrometersPerSecond) +
                    Vec2(Long.MAX_VALUE, 0)
        }

        // This is safe because [Stop.speedCurves] isn't ever set to null outside of initialization
        return listOf(stopCurve!!)
    }

    override fun update(oldState: TrainState, newState: TrainState) {
        val duration = duration ?: return

        val trainCurrentlyStopped =
            oldState.speed == 0.micrometersPerSecond && newState.speed == 0.micrometersPerSecond
        val trainPassedStop = position <= newState.position

        if (trainPassedStop && trainCurrentlyStopped) {
            val dt = newState.time - oldState.time

            // Contrary to where [this.duration] is initialized we filter with a strict inequality
            // here
            this.duration = (duration - dt).takeIf { it > 0.microseconds }
        }
    }

    override fun reset() {
        duration = initialDuration.takeIf { it >= 0.microseconds }
    }

    override fun toString(): String =
        "Stop(position=$position, duration=$initialDuration, remainingDuration=${duration ?: 0.microseconds})"
}

/**
 * Computes the deceleration curves of several [points].
 *
 * Returns a list of [Curve]s matching the given points, in the same order.
 */
private fun computeDecelerationCurves(
    context: EnvelopeSimContext,
    points: Iterable<Pair<PreciseDistance, PreciseSpeed>>,
): List<Curve> {
    val curveEndPosition = points.last().first
    return points.map {
        var curve = decelerationCurve(context, it.first, it.second)
        if (it.first != curveEndPosition) {
            // We only need to fill the deceleration curves that end before the end of the points' x
            // coordinates range
            curve += Vec2(curveEndPosition.micrometers, it.second.micrometersPerSecond)
        }
        curve
    }
}

/**
 * Computes and gathers all valid candidates for the merging of the deceleration [curves].
 *
 * A point is valid if it is below all the other curves.
 *
 * Returns a sorted list (on the x coordinate of each point) of [Pair] containing both the valid
 * point and the curve from which it stems. This will be useful in future processing to determine
 * the intersection between the curves.
 */
private fun computeCandidatePoints(curves: List<Curve>): List<Pair<Vec2, Curve>> {
    val belows = arrayListOf<Pair<Vec2, Curve>>()

    for (curve in curves) {
        for (i in 0..<curve.size) {
            // We can not possibly be out of bounds here since we iterate strictly in bounds
            val point = curve.getPointAt(i)!!
            var underAllOtherCurves = true

            for (otherCurve in curves) {
                if (curve == otherCurve) continue
                if (otherCurve.isBelow(point)) {
                    underAllOtherCurves = false
                    break
                }
            }

            if (underAllOtherCurves) belows += Pair(point, curve)
        }
    }

    return belows.sortedBy { it.first.x }
}

/**
 * Retains the valid candidates from a list of potentially wrong [candidates].
 *
 * If two consecutive points are on the same curve, the first one is valid. Otherwise, the first one
 * is valid, and we need to add a new point at the intersection of both curves.
 *
 * Returns a list of [Vec2] representing all the valid points.
 */
private fun retainValidCandidates(candidates: List<Pair<Vec2, Curve>>): List<Vec2> {
    val retainedPoints = arrayListOf<Vec2>()

    candidates.windowed(2).forEach {
        val curr = it[0]
        val next = it[1]

        if (curr.second == next.second) {
            /* We are on the same curve, keep the point */
            retainedPoints += curr.first
            return@forEach
        }

        /**
         * We change curve between two consecutive points. Add the current point AND the point at
         * the intersection of the curves
         */
        retainedPoints += curr.first

        var segmentStart = curr.second.last(1)
        // This is safe because a `Curve` always has at least one point
        val segmentEnd = curr.second.last()!!

        if (segmentStart == null) {
            // Extend the segment to be constant: [(0, y2), (x2, y2)]
            segmentStart = Vec2(0, segmentEnd.y)
        }

        val segment = Segment(segmentStart, segmentEnd)
        val intersection = next.second.intersectsAt(segment)

        if (intersection != null) {
            retainedPoints += intersection
        }
    }

    // Add the very last point as it will always be the lowest one, and it is skipped during the
    // "windowed" iteration
    retainedPoints += candidates.last().first
    return retainedPoints
}

/**
 * Creates a deceleration curve passing through all the provided (position, speed) [points].
 *
 * Returns the deceleration [Curve].
 */
internal fun makeCurve(
    context: EnvelopeSimContext,
    vararg points: Pair<PreciseDistance, PreciseSpeed>,
): Curve {
    val curves = computeDecelerationCurves(context, points.asIterable())
    val belows = computeCandidatePoints(curves)
    val validCandidates = retainValidCandidates(belows)
    return Curve(validCandidates)
}

internal fun decelerationCurve(
    context: EnvelopeSimContext,
    targetPosition: PreciseDistance,
    targetSpeed: PreciseSpeed,
): Curve {
    val maxSpeed = (context.rollingStock.maxSpeed * context.driver.vMaxFactor).metersPerSecond

    var position = targetPosition
    var speed = targetSpeed
    var stepCount = 0
    stepCount++ // count the step (target.position, target.speed)
    while (speed < maxSpeed && position > 0.micrometers) {
        val s =
            TrainPhysicsIntegrator.step(
                    context,
                    position.meters,
                    speed.metersPerSecond,
                    Action.BRAKE,
                    -1.0,
                    BrakingType.CONSTANT,
                )
                .toMicros()
        position += s.positionDelta
        speed = s.endSpeed
        stepCount++
    }

    val positions = LongArray(stepCount)
    val speeds = LongArray(stepCount)

    var i = stepCount - 1
    positions[i] = targetPosition.micrometers
    speeds[i] = targetSpeed.micrometersPerSecond
    while (i > 0) {
        i--
        val s =
            TrainPhysicsIntegrator.step(
                    context,
                    positions[i + 1].micrometers.meters,
                    speeds[i + 1].micrometers.meters,
                    Action.BRAKE,
                    -1.0,
                    BrakingType.CONSTANT,
                )
                .toMicros()
        positions[i] = positions[i + 1] + s.positionDelta.micrometers
        speeds[i] = min(s.endSpeed, maxSpeed).micrometersPerSecond
    }

    val curve = Curve(positions, speeds)

    if (positions.size > 1 && positions[0] < 0) {
        // Clamp at x = 0 in case the integration step goes out of the curve
        val positionDiff = positions[0] - positions[1]
        val speedDiff = speeds[0] - speeds[1]
        val speedToZero = (positions[1] * speedDiff) / positionDiff
        val speedAtZero = speeds[1] + speedToZero
        curve.xs[0] = 0
        curve.ys[0] = speedAtZero
    }

    return curve
}

fun step(
    context: EnvelopeSimContext,
    constraints: Iterable<Constraint>,
    currentState: TrainState,
    tracer: Tracer? = null,
): TrainState {
    tracer?.stepStart(currentState)

    val mergedState =
        constraints
            .asSequence()
            .flatMap {
                val nextStates = it.enactDecision(context, currentState)

                tracer?.decisions(it, nextStates)

                for (nextState in nextStates) {
                    require(currentState.position <= nextState.position) {
                        "constraint $it made train go backwards"
                    }
                    require(currentState.time < nextState.time) {
                        "constraint $it didn't advance time"
                    }
                    require(nextState.time - currentState.time <= context.timeStep.seconds) {
                        "constraint $it advanced too much time"
                    }
                }

                nextStates
            }
            .reduceOrNull { mostConstrained, decision ->
                decision.merge(currentState, mostConstrained)
            } ?: return currentState.accelerate(context)

    tracer?.mergedState(mergedState)

    val maxSpeed = context.rollingStock.maxSpeed.metersPerSecond
    require(mergedState.speed <= maxSpeed || currentState.speed > maxSpeed) {
        "train is going too fast"
    }

    val truncatedState =
        constraints
            .fold(mergedState) { mergedState, constraint ->
                val truncatedState = constraint.truncateStep(context, currentState, mergedState)

                require(currentState.position <= truncatedState.position) { "train went backwards" }
                require(currentState.time < truncatedState.time) { "step didn't advance time" }

                truncatedState
            }
            .truncate(currentState, context.path.length.meters)

    tracer?.truncatedState(truncatedState)

    return truncatedState
}
