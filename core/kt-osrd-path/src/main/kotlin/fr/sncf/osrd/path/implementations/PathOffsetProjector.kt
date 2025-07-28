package fr.sncf.osrd.path.implementations

import fr.sncf.osrd.path.interfaces.FullBlockPath
import fr.sncf.osrd.path.interfaces.FullRoutePath
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset

/**
 * This class is in charge of all projections across path types. For now the only implemented
 * projections are to and from FullRoutePath (as we can project every offset type into this one with
 * no data loss). Remaining conversions can be added as needed by chaining the other ones.
 */
data class PathOffsetProjector(
    /** List of all backtrack locations on the path. */
    val backtrackLocations: List<BacktrackLocation>,
    /** Offset of the first block start on the route path */
    val firstBlockOffset: Offset<FullRoutePath>,

    // val coveredPathBeginOffset: Offset<FullBlockPath>,
    // val rollingStockLength: Distance,
) {

    /** Contains all the data we need to convert offsets around and after backtracking locations. */
    data class BacktrackLocation(
        /** Exact location where the (old) train head stops, defined on route path. */
        val exactRouteOffset: Offset<FullRoutePath>,
        /** Remaining length of the current block when the train stops. */
        val remainingBlockAfterBacktrack: Distance,
        /**
         * Length of the blocks that will be fully skipped and aren't part of the block path. Can be
         * at the end of the current route or at the start of the next one (or both).
         */
        val skippedBlocksAroundBacktrack: Distance,

        // val skippedNextRoute: Distance,
    ) {
        val blockBacktrackStart =
            Offset<FullRoutePath>(exactRouteOffset.distance + remainingBlockAfterBacktrack)

        // TODO: add constructors, especially with infra and block/route lists
    }

    // TODO: add convenient constructors

    fun routeToBlock(routeOffset: Offset<FullRoutePath>): Offset<FullBlockPath> {
        var currentOffsetDiff = firstBlockOffset.distance
        for (backtrack in backtrackLocations) {
            // As absolute route offset
            val blockBacktrackStart =
                backtrack.exactRouteOffset + backtrack.remainingBlockAfterBacktrack
            val blockBacktrackEnd = blockBacktrackStart + backtrack.skippedBlocksAroundBacktrack

            if (blockBacktrackStart > routeOffset) break // Next backtrack is beyond the input

            if (routeOffset in blockBacktrackStart..blockBacktrackEnd) {
                // Input is in a range that's in the route path but not in the block path:
                // result clipped to the start of that range
                val backtrackStartOnBlock =
                    Offset<FullBlockPath>(blockBacktrackStart.distance - currentOffsetDiff)
                return backtrackStartOnBlock
            }

            currentOffsetDiff += backtrack.skippedBlocksAroundBacktrack
        }
        return Offset(routeOffset.distance - currentOffsetDiff)
    }

    fun blockToRoute(blockOffset: Offset<FullBlockPath>): Offset<FullRoutePath> {
        var currentOffsetDiff = firstBlockOffset.distance
        for (backtrack in backtrackLocations) {
            val blockBacktrackStart = backtrack.blockBacktrackStart

            if (blockBacktrackStart.distance > blockOffset.distance + currentOffsetDiff)
                break // Next backtrack is beyond the input

            currentOffsetDiff += backtrack.skippedBlocksAroundBacktrack
        }
        return Offset(blockOffset.distance + currentOffsetDiff)
    }

    // TODO: add remaining conversions to/from FullRoutePath
}
