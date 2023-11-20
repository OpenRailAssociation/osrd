package fr.sncf.osrd.api.pathfinding

import fr.sncf.osrd.geom.Point
import fr.sncf.osrd.graph.AStarHeuristic
import fr.sncf.osrd.graph.Pathfinding.EdgeLocation
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters

/** This is a function object that estimates the remaining distance to the closest target point,
 * using geo data. It is used as heuristic for A*.  */
class RemainingDistanceEstimator(
    private val blockInfra: BlockInfra,
    private val rawInfra: RawSignalingInfra,
    edgeLocations: Collection<EdgeLocation<BlockId>>,
    remainingDistance: Double
) : AStarHeuristic<BlockId> {
    private val targets: MutableCollection<Point>
    private val remainingDistance: Double

    /** Constructor  */
    init {
        targets = ArrayList()
        for (edgeLocation in edgeLocations) {
            val point = blockOffsetToPoint(blockInfra, rawInfra, edgeLocation.edge, edgeLocation.offset)
            // Avoid adding duplicate geo points to the target list
            if (targets.stream().noneMatch { target: Point? -> point.distanceAsMeters(target) < DISTANCE_THRESHOLD }) {
                targets.add(point)
            }
        }
        this.remainingDistance = remainingDistance
    }

    override fun apply(edge: BlockId, offset: Distance): Double {
        var resMeters = Double.POSITIVE_INFINITY
        val point = blockOffsetToPoint(blockInfra, rawInfra, edge, offset)
        for (target in targets)
            resMeters = java.lang.Double.min(resMeters, point.distanceAsMeters(target))

        // The costs are doubles to be able to weight them, but we still use millimeters as base unit
        return fromMeters(resMeters).millimeters.toDouble() + remainingDistance
    }

    companion object {
        /** Targets closer than this threshold will be merged together  */
        private const val DISTANCE_THRESHOLD = 1.0

        /** Converts a route and offset from its start into a geo point  */
        private fun blockOffsetToPoint(
            blockInfra: BlockInfra,
            rawInfra: RawSignalingInfra,
            blockIdx: BlockId,
            pointOffset: Distance
        ): Point {
            val path = makePathProps(blockInfra, rawInfra, blockIdx)
            val lineString = path.getGeo()
            val normalizedOffset = pointOffset.meters / path.getLength().meters
            return lineString.interpolateNormalized(normalizedOffset)
        }

        /** Compute the minimum geo distance between two steps.
         * Expected to be used when instantiating the heuristic,
         * to estimate the remaining total distance for any step.  */
        fun minDistanceBetweenSteps(
            blockInfra: BlockInfra,
            rawInfra: RawSignalingInfra,
            step1: Collection<EdgeLocation<BlockId>>,
            step2: Collection<EdgeLocation<BlockId>>
        ): Double {
            val step1Points = step1.stream()
                .map { loc: EdgeLocation<BlockId> -> blockOffsetToPoint(blockInfra, rawInfra, loc.edge, loc.offset) }
                .toList()
            val step2Points = step2.stream()
                .map { loc: EdgeLocation<BlockId> -> blockOffsetToPoint(blockInfra, rawInfra, loc.edge, loc.offset) }
                .toList()
            var res = Double.POSITIVE_INFINITY
            for (point1 in step1Points) {
                for (point2 in step2Points) {
                    res = java.lang.Double.min(res, point1.distanceAsMeters(point2))
                }
            }
            // The costs are doubles to be able to weight them, but we still use millimeters as base unit
            return fromMeters(res).millimeters.toDouble()
        }
    }
}
