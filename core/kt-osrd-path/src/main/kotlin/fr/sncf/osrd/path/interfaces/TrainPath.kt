package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.units.Offset

/**
 * A `TrainPath` describes the path taken by a train and its properties. It is built in a way that
 * can easily be mapped to train simulations, where we track the distance travelled by the train
 * head.
 *
 * `Offset<PhysicsPath>` is the correct typing to locate elements on a path.
 *
 * We consider that 1m of train path means 1m of train movement, not necessarily 1m of actual track
 * length. Specifically, when a train turns around at a station, no distance is travelled. See
 * below, where a train goes up to a point and turn around:
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
 * What we consider the "train path" is marked with `===>` symbols. The area covered by the train
 * itself ('#') is excluded from the path after turning around. 1m after the backtrack offset is
 * already `train length + 1m` away from the previous location.
 *
 * `getBlocks` and similar methods only return block ranges that are part of the train path. This
 * may include partial blocks, especially at the edges of the path or around backtracks.
 */
interface TrainPath : PhysicsPath, PathProperties {
    fun subPath(
        from: Offset<PhysicsPath>?,
        to: Offset<PhysicsPath>?,
        includeExactStart: Boolean = true,
        includeExactEnd: Boolean = true,
    ): TrainPath

    /** Returns a copy with the specified routes instead */
    override fun withRoutes(routes: List<RouteId>): TrainPath

    fun getBacktrackLocations(): List<Offset<PhysicsPath>>

    fun getBlocks(): List<BlockRange>

    fun getRoutes(): List<RouteRange>

    fun getChunks(): List<DirChunkRange>

    fun getZonePaths(): List<ZonePathRange>

    fun getZoneRanges(): List<ZoneRange>
    // To be expanded as needed with other linear objects
}

/**
 * Split the path at each backtrack location, converting a path that may have backtracks into a list
 * of paths that don't have any. Zero-length ranges are removed at backtrack locations, to avoid
 * leaving traces of the path across the backtrack location.
 *
 * Note: for typing consistency, all subpath become their own references for their
 * `Offset<PhysicsPath>`. Projecting onto the original path requires some extra effort. If this
 * becomes an issue, some tooling can be added.
 */
fun TrainPath.splitAtBacktracks(): List<PathFragment> {
    val res = mutableListOf<PathFragment>()
    var currentBeginOffset = Offset.zero<PhysicsPath>()
    for (backtrackLocation in getBacktrackLocations()) {
        if (backtrackLocation == currentBeginOffset || backtrackLocation == this.getLength())
            continue
        res.add(
            PathFragment(
                subPath(
                    from = currentBeginOffset,
                    to = backtrackLocation,
                    includeExactStart = currentBeginOffset == Offset.zero<TrainPath>(),
                    includeExactEnd = false,
                ),
                currentBeginOffset,
            )
        )
        currentBeginOffset = backtrackLocation
    }
    res.add(
        PathFragment(
            subPath(
                from = currentBeginOffset,
                to = getLength(),
                includeExactStart = currentBeginOffset == Offset.zero<TrainPath>(),
                includeExactEnd = true,
            ),
            currentBeginOffset,
        )
    )
    return res
}

/**
 * Output of [splitAtBacktracks]. Note: the typing isn't ideal here. The path fragment is a
 * TrainPath and has its own `Offset<PhysicsPath>`, but they don't refer to the "outer" train path.
 * We can't have the usual type safety.
 */
data class PathFragment(val pathFragment: TrainPath, val fragmentStartOffset: Offset<PhysicsPath>)
