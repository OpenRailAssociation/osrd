package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.sim_infra.impl.PathImpl
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.DistanceRangeMap

data class WithOffset<T>(
    val value: T,
    val offset: Distance,
)
typealias IdxWithOffset<T> = WithOffset<StaticIdx<T>>

interface Path {
    fun getSlopes(): DistanceRangeMap<Double>
    fun getOperationalPointParts(): List<IdxWithOffset<OperationalPointPart>>
    // TODO: (need extra data in the new infra)
    // fun getGradients(path: Path): DistanceRangeMap<Double>
    // fun getCurves(path: Path): DistanceRangeMap<Double>
    // fun getGeo(path: Path): LineString
    // fun getLoadingGauge(path: Path): DistanceRangeMap<Map<LoadingGaugeConstraint>>
    // fun getCatenary(path: Path): DistanceRangeMap<List<String>>
}

fun pathOf(
    infra: TrackProperties,
    chunks: DirStaticIdxList<TrackChunk>,
    beginOffset: Distance,
    endOffset: Distance,
): Path {
    return PathImpl(infra, chunks, beginOffset, endOffset)
}