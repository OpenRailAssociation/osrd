package fr.sncf.osrd.path.interfaces

import com.google.common.collect.RangeMap
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

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

    fun getBlocks(): LinearObjectMap<BlockRange>

    fun getRoutes(): LinearObjectMap<RouteRange>

    fun getChunks(): LinearObjectMap<DirChunkRange>
    // To be expanded as needed with other linear objects
}

fun concat(vararg paths: TrainPath): TrainPath {
    TODO("Required for actual backtracks, not necessary earlier than that")
}

data class GenericLinearRange<ValueType, OffsetType>(
    val value: ValueType,
    val from: Offset<OffsetType>,
    val to: Offset<OffsetType>,
) {
    val length = to - from

    init {
        require(length >= 0.meters)
    }
}

// We'd normally use `DistanceRangeMap` here, but supporting zero-length ranges is required.
// Note: kotlin doesn't allow type arguments on type parameters, so we can't easily make it explicit
// that T is meant to be a `GenericLinearRange` without having repeated parameters
typealias LinearObjectMap<T> = RangeMap<Offset<TrainPath>, T>

typealias LinearObjectRange<T> = GenericLinearRange<StaticIdx<T>, T>

typealias LinearDirObjectRange<T> = GenericLinearRange<DirStaticIdx<T>, T>

typealias RouteRange = LinearObjectRange<Route>

typealias BlockRange = LinearObjectRange<Block>

typealias DirChunkRange = LinearDirObjectRange<TrackChunk>
