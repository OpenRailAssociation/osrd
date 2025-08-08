package fr.sncf.osrd.utils

import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate.EnvelopePoint
import java.util.*
import kotlin.collections.ArrayList
import kotlin.math.abs

/**
 * Simplifies a curve, given a distance function and a maximum error. This function is an iterative
 * implementation of the Ramer-Douglas-Peucker algorithm.
 *
 * @param <PointT> the types of the curve's points
 * @param points the list of points
 * @param epsilon the max error
 * @param distFunction the distance function, which is given two reference points and a deviating
 *   one
 * @return a simplified curve </PointT>
 */
fun <PointT> simplifyCurveByRdp(
    points: List<PointT>,
    epsilon: Double,
    distFunction: RDPDist<PointT>,
): ArrayList<PointT> {
    val deleted = BooleanArray(points.size)

    val stack = ArrayDeque<PendingRange>()
    stack.add(PendingRange(0, points.size - 1))

    while (!stack.isEmpty()) {
        val cur = stack.pop()
        var maxDist = 0.0
        var index = cur.start

        for (i in index + 1 until cur.end) {
            if (deleted[i]) continue
            val d = distFunction.dist(points[i], points[cur.start], points[cur.end])
            if (d <= maxDist) continue
            index = i
            maxDist = d
        }

        if (maxDist > epsilon) {
            stack.add(PendingRange(cur.start, index))
            stack.add(PendingRange(index, cur.end))
        } else {
            for (i in cur.start + 1 until cur.end) deleted[i] = true
        }
    }

    val res = ArrayList<PointT>()
    for (i in points.indices) if (!deleted[i]) res.add(points[i])
    return res
}

fun interface RDPDist<PointT> {
    fun dist(point: PointT, start: PointT, end: PointT): Double
}

private class PendingRange(val start: Int, val end: Int)

fun simplifyEnvelopePoints(
    points: List<EnvelopePoint>,
    speedScaling: Double = 1.0,
    timeScaling: Double = 0.0,
    epsilon: Double = 1.0,
): ArrayList<EnvelopePoint> {
    return simplifyCurveByRdp(points, epsilon) { point, start, end ->
        if (arePositionsEqual(start.position, end.position)) {
            return@simplifyCurveByRdp abs(point.speed - start.speed) * speedScaling +
                abs(point.time - start.time) * timeScaling
        }
        val projSpeed =
            start.speed +
                (point.position - start.position) * (end.speed - start.speed) /
                    (end.position - start.position)
        val projTime =
            start.time +
                (point.position - start.position) * (end.time - start.time) /
                    (end.position - start.position)
        return@simplifyCurveByRdp abs(point.speed - projSpeed) * speedScaling +
            abs(point.time - projTime) * timeScaling
    }
}
