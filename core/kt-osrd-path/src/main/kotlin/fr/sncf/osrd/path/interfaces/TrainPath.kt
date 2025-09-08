package fr.sncf.osrd.path.interfaces

import com.google.common.collect.RangeMap
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

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

typealias DirTrackRange = LinearObjectRange<TrackSection>
