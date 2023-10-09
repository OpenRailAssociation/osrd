package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.impl.NeutralSection
import fr.sncf.osrd.sim_infra.impl.PathPropertiesImpl
import fr.sncf.osrd.sim_infra.impl.buildChunkPath
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed

data class IdxWithOffset<T>(
    @get:JvmName("getValue")
    val value: StaticIdx<T>,
    @get:JvmName("getOffset")
    val offset: Distance,
)

data class TrackLocation(
    @get:JvmName("getTrackId")
    val trackId: TrackSectionId,
    @get:JvmName("getOffset")
    val offset: Offset<TrackSection>
)

@Suppress("INAPPLICABLE_JVM_NAME")
interface PathProperties {
    fun getSlopes(): DistanceRangeMap<Double>
    fun getOperationalPointParts(): List<IdxWithOffset<OperationalPointPart>>
    fun getGradients(): DistanceRangeMap<Double>
    fun getCurves(): DistanceRangeMap<Double>
    fun getGeo(): LineString
    fun getLoadingGauge(): DistanceRangeMap<LoadingGaugeConstraint>
    @JvmName("getCatenary")
    fun getCatenary(): DistanceRangeMap<String>
    @JvmName("getNeutralSections")
    fun getNeutralSections(): DistanceRangeMap<NeutralSection>
    @JvmName("getSpeedLimits")
    fun getSpeedLimits(trainTag: String?): DistanceRangeMap<Speed>
    @JvmName("getLength")
    fun getLength(): Distance
    @JvmName("getTrackLocationAtOffset")
    fun getTrackLocationAtOffset(pathOffset: Distance): TrackLocation
    @JvmName("getTrackLocationOffset")
    fun getTrackLocationOffset(location: TrackLocation): Distance?
    fun <T> getRangeMapFromUndirected(getData: (chunkId: TrackChunkId) -> DistanceRangeMap<T>): DistanceRangeMap<T>
}

/** Build a Path from chunks and offsets, filtering the chunks outside the offsets */
@JvmName("buildPathPropertiesFrom")
fun buildPathPropertiesFrom(
    infra: TrackProperties,
    chunks: DirStaticIdxList<TrackChunk>,
    pathBeginOffset: Distance,
    pathEndOffset: Distance,
): PathProperties {
    val chunkPath = buildChunkPath(infra, chunks, pathBeginOffset, pathEndOffset)
    return makePathProperties(infra, chunkPath)
}

@JvmName("makePathProperties")
fun makePathProperties(infra: TrackProperties, chunkPath: ChunkPath): PathProperties {
    return PathPropertiesImpl(infra, chunkPath)
}

/** For java interoperability purpose */
@JvmName("makeTrackLocation")
fun makeTrackLocation(track: TrackSectionId, offset: Offset<TrackSection>): TrackLocation {
    return TrackLocation(track, offset)
}
