package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.impl.PathImpl
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.meters

data class IdxWithOffset<T>(
    val value: StaticIdx<T>,
    val offset: Distance,
)

interface Path {
    fun getSlopes(): DistanceRangeMap<Double>
    fun getOperationalPointParts(): List<IdxWithOffset<OperationalPointPart>>
    fun getGradients(): DistanceRangeMap<Double>
    fun getCurves(): DistanceRangeMap<Double>
    fun getGeo(): LineString
    fun getLoadingGauge(): DistanceRangeMap<LoadingGaugeConstraint>
    fun getCatenary(): DistanceRangeMap<String>
}

/** Build a Path from chunks and offsets, filtering the chunks outside the offsets */
fun buildPathFrom(
    infra: TrackProperties,
    chunks: DirStaticIdxList<TrackChunk>,
    beginOffset: Distance,
    endOffset: Distance,
): Path {
    val filteredChunks = mutableDirStaticIdxArrayListOf<TrackChunk>()
    var totalLength = 0.meters
    var mutBeginOffset = beginOffset
    var mutEndOffset = endOffset
    for (dirChunkId in chunks) {
        if (totalLength >= endOffset)
            break
        val length = infra.getTrackChunkLength(dirChunkId.value)
        if (totalLength + length >= beginOffset)
            filteredChunks.add(dirChunkId)
        else {
            mutBeginOffset -= length
            mutEndOffset -= length
        }
        totalLength += length
    }
    return PathImpl(infra, filteredChunks, mutBeginOffset, mutEndOffset)
}