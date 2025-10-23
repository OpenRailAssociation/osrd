package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.path.implementations.ChunkPath
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.sumDistances

/**
 * A `TrainPath` describes the path taken by a train and its properties. It is built in a way that
 * can easily be mapped to train simulations, where we track the distance travelled by the train
 * head.
 *
 * `Offset<TrainPath>` is the correct typing to locate elements on a path.
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
    fun subPath(from: Offset<TrainPath>?, to: Offset<TrainPath>?): TrainPath

    fun getTypedLength(): Length<TrainPath>

    /** Returns a copy with the specified routes instead */
    override fun withRoutes(routes: List<RouteId>): TrainPath

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

fun TrainPath.getLegacyChunkPath(): ChunkPath {
    val chunkRanges = getChunks()
    val beginOffset = chunkRanges.first().objectBegin.cast<BlockPath>()
    // Poorly optimized, we could avoid the loop if we had infra access.
    // Should be good enough for short-lived backward compatibility method.
    val endOffset = beginOffset + chunkRanges.map { it.length }.sumDistances()
    return ChunkPath(
        chunks = chunkRanges.map { it.value },
        beginOffset = beginOffset,
        endOffset = endOffset,
    )
}

fun TrainPath.getLegacyBlockPath(): List<BlockId> {
    // Legacy block list excluded blocks that were only used in 0-length segments
    return getBlocks().filter { !it.isSinglePoint() }.map { it.value }
}

fun TrainPath.getLegacyRoutePath(): List<RouteId> {
    // Legacy route list excluded routes that were only used in 0-length segments
    return getRoutes().filter { !it.isSinglePoint() }.map { it.value }
}
