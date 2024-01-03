package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.impl.NeutralSection
import fr.sncf.osrd.sim_infra.impl.PathPropertiesImpl
import fr.sncf.osrd.sim_infra.impl.buildChunkPath
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed
import java.lang.RuntimeException

data class IdxWithOffset<T, U>(
    val value: StaticIdx<T>,
    val offset: Offset<U>,
)
typealias IdxWithPathOffset<T> = IdxWithOffset<T, Path>

data class TrackLocation(
    @get:JvmName("getTrackId")
    val trackId: TrackSectionId,
    @get:JvmName("getOffset")
    val offset: Offset<TrackSection>
)

sealed interface Path // Used for typing Length and Offset

@Suppress("INAPPLICABLE_JVM_NAME")
interface PathProperties {
    fun getSlopes(): DistanceRangeMap<Double>
    fun getOperationalPointParts(): List<IdxWithPathOffset<OperationalPointPart>>
    fun getGradients(): DistanceRangeMap<Double>
    fun getCurves(): DistanceRangeMap<Double>
    fun getGeo(): LineString
    fun getLoadingGauge(): DistanceRangeMap<LoadingGaugeConstraint>
    fun getElectrification(): DistanceRangeMap<String>
    fun getNeutralSections(): DistanceRangeMap<NeutralSection>
    @JvmName("getSpeedLimits")
    fun getSpeedLimits(trainTag: String?): DistanceRangeMap<Speed>
    @JvmName("getLength")
    fun getLength(): Length<Path>
    @JvmName("getTrackLocationAtOffset")
    fun getTrackLocationAtOffset(pathOffset: Offset<Path>): TrackLocation
    @JvmName("getTrackLocationOffset")
    fun getTrackLocationOffset(location: TrackLocation): Offset<Path>?
    fun <T> getRangeMapFromUndirected(getData: (chunkId: TrackChunkId) -> DistanceRangeMap<T>): DistanceRangeMap<T>
}

/** Build a Path from chunks and offsets, filtering the chunks outside the offsets */
fun buildPathPropertiesFrom(
    infra: TrackProperties,
    chunks: DirStaticIdxList<TrackChunk>,
    pathBeginOffset: Offset<Path>,
    pathEndOffset: Offset<Path>,
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

/** For java interoperability purpose.
 * An optional inline return type can't be handled by java when it's generic. */
@JvmName("getTrackLocationOffsetOrThrow")
fun getTrackLocationOffsetOrThrow(
    path: PathProperties,
    location: TrackLocation
): Offset<Path> {
    return path.getTrackLocationOffset(location) ?: throw RuntimeException("Can't find location on path")
}

