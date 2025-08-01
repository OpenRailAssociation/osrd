package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Offset

interface TrainPath : PhysicsPath, PathProperties {
    fun subPath(from: Offset<TrainPath>?, to: Offset<TrainPath>?): TrainPath

    fun getBlocks(): DistanceRangeMap<BlockRange>

    fun getRoutes(): DistanceRangeMap<RouteRange>

    fun getChunks(): DistanceRangeMap<DirChunkRange>
    // To be expanded as needed with other linear objects
}

fun concat(vararg paths: TrainPath): TrainPath {
    TODO("Necessary for actual backtracks, not necessary earlier than that")
}

data class GenericLinearRange<ValueType, OffsetType>(
    val value: ValueType,
    val from: Offset<OffsetType>,
    val to: Offset<OffsetType>,
) {
    val length = to - from
}

typealias LinearObjectRange<T> = GenericLinearRange<StaticIdx<T>, T>

typealias LinearDirObjectRange<T> = GenericLinearRange<DirStaticIdx<T>, T>

typealias RouteRange = LinearObjectRange<Route>

typealias BlockRange = LinearObjectRange<Block>

typealias DirChunkRange = LinearDirObjectRange<TrackChunk>
