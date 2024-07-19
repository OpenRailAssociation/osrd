package fr.sncf.osrd.api.pathfinding

import fr.sncf.osrd.geom.Point
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.math.min

/**
 * This is a function object that estimates the remaining distance to the closest target point,
 * using geo data. It is used as heuristic for A*.
 */
class RemainingDistanceEstimator(
    private val blockInfra: BlockInfra,
    private val rawInfra: RawSignalingInfra,
    edgeLocations: Collection<PathfindingEdgeLocationId<Block>>,
    private val remainingDistance: Distance
) {
    private val targets: MutableCollection<Point> = ArrayList()

    init {
        for (edgeLocation in edgeLocations) {
            val point =
                blockOffsetToPoint(blockInfra, rawInfra, edgeLocation.edge, edgeLocation.offset)
            // Avoid adding duplicate geo points to the target list
            val isDuplicate = targets.any { point.distanceAsMeters(it) < DISTANCE_THRESHOLD }
            if (!isDuplicate) targets.add(point)
        }
    }

    fun apply(edge: BlockId, offset: Offset<Block>): Distance {
        var resMeters = Double.POSITIVE_INFINITY
        val point = blockOffsetToPoint(blockInfra, rawInfra, edge, offset)
        for (target in targets) resMeters = min(resMeters, point.distanceAsMeters(target))

        return resMeters.meters + remainingDistance
    }

    companion object {
        /** Targets closer than this threshold will be merged together */
        private const val DISTANCE_THRESHOLD = 1.0
    }
}

/**
 * Compute the minimum geo distance between two steps. Expected to be used when instantiating the
 * heuristic, to estimate the remaining total distance for any step.
 */
fun minDistanceBetweenSteps(
    blockInfra: BlockInfra,
    rawInfra: RawSignalingInfra,
    step1: Collection<PathfindingEdgeLocationId<Block>>,
    step2: Collection<PathfindingEdgeLocationId<Block>>
): Distance {
    val step1Points = step1.map { blockOffsetToPoint(blockInfra, rawInfra, it.edge, it.offset) }
    val step2Points = step2.map { blockOffsetToPoint(blockInfra, rawInfra, it.edge, it.offset) }
    var res = Double.POSITIVE_INFINITY
    for (point1 in step1Points) {
        for (point2 in step2Points) {
            res = min(res, point1.distanceAsMeters(point2))
        }
    }

    return res.meters
}

/** Converts a block and offset from its start into a geo point */
private fun blockOffsetToPoint(
    blockInfra: BlockInfra,
    rawInfra: RawSignalingInfra,
    blockIdx: BlockId,
    pointOffset: Offset<Block>
): Point {
    // Ideally, we would just call `makePathProps(blockId).getGeo()` to get geo data for the block.
    // But that introduces a lot of overhead (building the path and projecting the results),
    // which results in a net performance loss when using the heuristic.
    // This implementation is more verbose but quite lightweight.
    // TODO: maybe investigate where the path overhead is coming from, it may not be normal

    var pathOffset = 0.meters
    for (chunk in blockInfra.getTrackChunksFromBlock(blockIdx)) {
        val chunkLength = rawInfra.getTrackChunkLength(chunk.value)
        if (pathOffset + chunkLength.distance < pointOffset.distance) {
            pathOffset += chunkLength.distance
            continue
        }

        val remainingOffsetOnBlock = pointOffset.distance - pathOffset
        val chunkOffset =
            if (chunk.direction == Direction.INCREASING) {
                remainingOffsetOnBlock
            } else {
                chunkLength.distance - remainingOffsetOnBlock
            }
        val lineString = rawInfra.getTrackChunkGeom(chunk.value)
        return lineString.interpolateNormalized(chunkOffset.meters / chunkLength.distance.meters)
    }
    throw RuntimeException("Unreachable (block offset outside of block)")
}
