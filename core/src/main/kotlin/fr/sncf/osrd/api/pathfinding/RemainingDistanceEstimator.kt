package fr.sncf.osrd.api.pathfinding

import fr.sncf.osrd.geom.Point
import fr.sncf.osrd.graph.AStarHeuristicId
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import fr.sncf.osrd.utils.units.Offset

/**
 * This is a function object that estimates the remaining distance to the closest target point,
 * using geo data. It is used as heuristic for A*.
 *
 * **LEGACY**
 *
 * Not currently in used as the geodesic computations are too expensive to compute, resulting in a
 * net performance loss.
 *
 * TODO: before reusing this class, it now needs to return a minimum *time* instead of a distance.
 */
class RemainingDistanceEstimator(
    private val blockInfra: BlockInfra,
    private val rawInfra: RawSignalingInfra,
    edgeLocations: Collection<PathfindingEdgeLocationId<Block>>,
    remainingDistance: Double
) : AStarHeuristicId<Block> {
    private val targets: MutableCollection<Point>
    private val remainingDistance: Double

    /** Constructor */
    init {
        targets = ArrayList()
        for (edgeLocation in edgeLocations) {
            val point =
                blockOffsetToPoint(blockInfra, rawInfra, edgeLocation.edge, edgeLocation.offset)
            // Avoid adding duplicate geo points to the target list
            if (
                targets.stream().noneMatch { target: Point? ->
                    point.distanceAsMeters(target) < DISTANCE_THRESHOLD
                }
            ) {
                targets.add(point)
            }
        }
        this.remainingDistance = remainingDistance
    }

    override fun apply(edge: BlockId, offset: Offset<Block>): Double {
        var resMeters = Double.POSITIVE_INFINITY
        val point = blockOffsetToPoint(blockInfra, rawInfra, edge, offset)
        for (target in targets) resMeters =
            java.lang.Double.min(resMeters, point.distanceAsMeters(target))

        // The costs are doubles to be able to weight them, but we still use millimeters as base
        // unit
        return fromMeters(resMeters).millimeters.toDouble() + remainingDistance
    }

    companion object {
        /** Targets closer than this threshold will be merged together */
        private const val DISTANCE_THRESHOLD = 1.0

        /** Converts a block and offset from its start into a geo point */
        private fun blockOffsetToPoint(
            blockInfra: BlockInfra,
            rawInfra: RawSignalingInfra,
            blockIdx: BlockId,
            pointOffset: Offset<Block>
        ): Point {
            val path = makePathProps(blockInfra, rawInfra, blockIdx)
            val lineString = path.getGeo()
            val normalizedOffset = pointOffset.distance.meters / path.getLength().meters
            return lineString.interpolateNormalized(normalizedOffset)
        }

        /**
         * Compute the minimum geo distance between two steps. Expected to be used when
         * instantiating the heuristic, to estimate the remaining total distance for any step.
         */
        fun minDistanceBetweenSteps(
            blockInfra: BlockInfra,
            rawInfra: RawSignalingInfra,
            step1: Collection<PathfindingEdgeLocationId<Block>>,
            step2: Collection<PathfindingEdgeLocationId<Block>>
        ): Double {
            val step1Points =
                step1
                    .stream()
                    .map { loc: PathfindingEdgeLocationId<Block> ->
                        blockOffsetToPoint(blockInfra, rawInfra, loc.edge, loc.offset)
                    }
                    .toList()
            val step2Points =
                step2
                    .stream()
                    .map { loc: PathfindingEdgeLocationId<Block> ->
                        blockOffsetToPoint(blockInfra, rawInfra, loc.edge, loc.offset)
                    }
                    .toList()
            var res = Double.POSITIVE_INFINITY
            for (point1 in step1Points) {
                for (point2 in step2Points) {
                    res = java.lang.Double.min(res, point1.distanceAsMeters(point2))
                }
            }
            // The costs are doubles to be able to weight them, but we still use millimeters as base
            // unit
            return fromMeters(res).millimeters.toDouble()
        }
    }
}
