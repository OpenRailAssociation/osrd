package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.utils.units.Offset

/**
 * Describes all the path covered by the train. Includes all of `TrainPath`, plus some extra
 * sections around backtrack locations. If a train goes up to a point and turns around:
 * ```
 *                         backtrack
 *                         location
 * ========================>|
 * -------------------------|-----    track section
 * <============############|
 *              ^   train   ^
 *              ^   length  ^
 *             new         old
 *             head        head
 * ```
 *
 * The area marked as `####` is only covered by `TrainPath` in the "left to right" direction, but
 * `TrainCoveredPath` also contains it in the "right to left" direction, after the backtrack
 * location.
 *
 * Note: currently, at the train first departure, the train "appears out of a portal" at the start
 * of its path. If we wanted to fix that, this class would be the place to handle it. But it's not
 * currently planned, as it would take a lot of changes across all of OSRD.
 */
class TrainCoveredPath {

    /**
     * Underlying train path, excluding the area covered by the train in the post-backtrack
     * direction.
     */
    fun getTrainPath(): TrainPath {
        TODO()
    }

    /** Access all backtrack locations, including path segments that are skipped in `TrainPath`. */
    fun getBacktracks(): List<Backtrack> {
        TODO()
    }

    data class Backtrack(
        // Or `Offset<TrainPath>`? Either would work
        val offset: Offset<TrainCoveredPath>,

        // Describes the path from the previous train head to the new train head, in the
        // post-backtrack direction.
        // It feels like the easiest way to communicate "sequence of tracks + routes + blocks" with
        // easily accessible properties, but it might be confusing?
        val skippedPathSegment: TrainPath,
    )

    /** May not be needed? */
    fun getFullBlocks(): LinearObjectMap<BlockRange> {
        TODO()
    }

    /** May not be needed? */
    fun getFullRoutes(): LinearObjectMap<RouteRange> {
        TODO()
    }

    /** May not be needed? */
    fun getFullChunks(): LinearObjectMap<DirChunkRange> {
        TODO()
    }

    /** Basic offset conversion */
    fun toTrainPathOffset(offset: Offset<TrainCoveredPath>): Offset<TrainPath> {
        TODO()
    }

    /** Basic offset conversion */
    fun fromTrainPathOffset(offset: Offset<TrainPath>): Offset<TrainCoveredPath> {
        TODO()
    }
}
