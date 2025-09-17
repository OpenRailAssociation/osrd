package fr.sncf.osrd.stdcm.graph.engineering_allowance

import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate.EnvelopePoint
import fr.sncf.osrd.stdcm.graph.STDCMGraph
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.sqrt

/** Run a very simplified simulation with a constant acceleration value. */
fun runSimplifiedSimulation(
    acceleration: Double,
    finalSpeed: Double,
    distance: Double,
): SummarizedSimulationResult {
    // Derived from kinetic equations
    var initialSpeed = sqrt(finalSpeed * finalSpeed - 2 * acceleration * distance)
    if (initialSpeed.isNaN()) {
        // Intersection with 0
        initialSpeed = 0.0
    }
    val time = abs((initialSpeed - finalSpeed) / acceleration)
    return SummarizedSimulationResult(initialSpeed, time)
}

/**
 * Similar function as above, computes a simplified simulation using basic kinetic equations. Here
 * we compute the travel time over some known distance, with first a speed plateau and then a
 * deceleration. The exact transition isn't known, but we know the start/end speed and acceleration.
 */
fun simplifiedSpeedPlateauThenDeceleration(
    acceleration: Double,
    initialSpeed: Double,
    finalSpeed: Double,
    distance: Double,
): Double {
    require(initialSpeed > 0.0)
    require(finalSpeed >= 0.0)
    require(initialSpeed > finalSpeed)
    require(distance > 0.0)

    val constSpeedTime = distance / initialSpeed
    val addedDecelerationTime =
        (initialSpeed - finalSpeed).pow(2.0) / abs(2.0 * acceleration * initialSpeed)
    return constSpeedTime + addedDecelerationTime
}

/**
 * Iterates (time, speed, position) points over a given envelope (backwards). Points are placed
 * exactly $distance apart, last point may be closer. Much faster than repeated `interpolate` calls.
 */
internal fun fixedDistanceBackwardsEnvelopeIteration(
    envelope: EnvelopeTimeInterpolate,
    distance: Double,
): Sequence<EnvelopePoint> = sequence {
    val points = envelope.iteratePoints().asReversed()
    var prevPoint = points[0]
    yield(prevPoint)
    if (points.size == 1) return@sequence

    var nextPoint = points[1]
    var nextPointIndex = 1
    var position = envelope.endPos - distance
    while (position > 0) {
        while (position < nextPoint.position) {
            prevPoint = points[nextPointIndex]
            nextPointIndex++
            nextPoint = points[nextPointIndex]
        }
        val relativeDistance =
            positive((position - prevPoint.position) / (nextPoint.position - prevPoint.position))
        yield(
            EnvelopePoint(
                prevPoint.time + relativeDistance * (nextPoint.time - prevPoint.time),
                prevPoint.speed + relativeDistance * (nextPoint.speed - prevPoint.speed),
                position,
            )
        )
        position -= distance
    }
    yield(points.last())
}

/** For sanity checks that don't take an extra line each time. */
internal fun positive(value: Double, epsilon: Double = 0.1): Double {
    assert(value >= -epsilon)
    return value
}

/**
 * For a given travel time over a given duration, returns the duration with standard allowance
 * included.
 */
internal fun scaleAllowanceTime(graph: STDCMGraph?, time: Double, distance: Distance): Double {
    val allowanceValue = graph?.standardAllowance ?: return time
    return time + allowanceValue.getAllowanceTime(time, distance.meters)
}
