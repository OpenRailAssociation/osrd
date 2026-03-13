package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.OffsetRange
import fr.sncf.osrd.utils.units.meters

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

fun concat(vararg paths: TrainPath): TrainPath {
    TODO("Required for actual backtracks, not necessary earlier than that")
}

// Extension functions that help with backward compatibility.
// These should only exist during the migration to enable more local changes,
// to allow partial migration while still having a working core.
// Every call site will become a bug once we have backtracks.
// TODO path migration: remove these.

fun TrainPath.getLegacyBlockPath(): List<BlockId> {
    // Legacy block list excluded blocks that were only used in 0-length segments
    return getBlocks().filter { !it.isSinglePoint() }.map { it.value }
}

fun TrainPath.getLegacyRoutePath(): List<RouteId> {
    // Legacy route list excluded routes that were only used in 0-length segments
    return getRoutes().filter { !it.isSinglePoint() }.map { it.value }
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
fun TrainPath.splitAtBacktracks(): List<TrainPath> {
    val res = mutableListOf<TrainPath>()
    var currentBeginOffset = Offset.zero<PhysicsPath>()
    for (backtrackLocation in getBacktrackLocations()) {
        if (backtrackLocation == currentBeginOffset || backtrackLocation == this.getLength())
            continue
        res.add(
            subPath(
                from = currentBeginOffset,
                to = backtrackLocation,
                includeExactStart = currentBeginOffset == Offset.zero<TrainPath>(),
                includeExactEnd = false,
            )
        )
        currentBeginOffset = backtrackLocation
    }
    res.add(
        subPath(
            from = currentBeginOffset,
            to = getLength(),
            includeExactStart = currentBeginOffset == Offset.zero<TrainPath>(),
            includeExactEnd = true,
        )
    )
    return res
}

/**
 * Retrieve the boundaries of the non-backtracking sub-path that contains the offset. Considering
 * backtracking locations as part of the next straight sub-path.
 */
fun TrainPath.getNonBacktrackingSubPathBoundariesContainingOffset(
    offset: Offset<PhysicsPath>
): OffsetRange<PhysicsPath> {
    require(offset <= getLength())
    for (it in getBacktrackLocations().withIndex()) {
        if (it.value > offset) {
            val start = getBacktrackLocations().getOrNull(it.index - 1) ?: Offset(0.meters)
            return OffsetRange(start, it.value)
        }
    }
    val start = getBacktrackLocations().lastOrNull() ?: Offset(0.meters)
    return OffsetRange(start, getLength())
}
