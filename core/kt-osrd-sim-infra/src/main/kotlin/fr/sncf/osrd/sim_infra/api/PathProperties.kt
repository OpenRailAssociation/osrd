package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.impl.PathPropertiesImpl
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.sim_infra.impl.buildChunkPath
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset

data class IdxWithOffset<T, U>(
    val value: StaticIdx<T>,
    val offset: Offset<U>,
)

typealias IdxWithPathOffset<T> = IdxWithOffset<T, Path>

data class TrackLocation(
    @get:JvmName("getTrackId") val trackId: TrackSectionId,
    @get:JvmName("getOffset") val offset: Offset<TrackSection>
)

/**
 * A marker type for Length and Offset. "Path" *mostly* refers to "BlockPath", where start is the
 * beginning of the first block (NOT the real start of the train).
 */
// TODO: rename this to BlockPath and make sure it's used appropriately
sealed interface Path

/**
 * A marker type for Length and Offset. In TravelledPath, start refers to the real start of the head
 * of the train.
 */
sealed interface TravelledPath

@Suppress("INAPPLICABLE_JVM_NAME")
interface PathProperties {
    fun getSlopes(): DistanceRangeMap<Double>

    fun getOperationalPointParts(): List<IdxWithPathOffset<OperationalPointPart>>

    fun getGradients(): DistanceRangeMap<Double>

    fun getCurves(): DistanceRangeMap<Double>

    fun getGeo(): LineString

    fun getLoadingGauge(): DistanceRangeMap<LoadingGaugeConstraint>

    fun getElectrification(): DistanceRangeMap<Set<String>>

    fun getNeutralSections(): DistanceRangeMap<NeutralSection>

    @JvmName("getSpeedLimitProperties")
    fun getSpeedLimitProperties(
        trainTag: String?,
        temporarySpeedLimitManager: TemporarySpeedLimitManager?
    ): DistanceRangeMap<SpeedLimitProperty>

    fun getZones(): DistanceRangeMap<ZoneId>

    @JvmName("getLength") fun getLength(): Distance

    @JvmName("getTrackLocationAtOffset")
    fun getTrackLocationAtOffset(pathOffset: Offset<Path>): TrackLocation

    @JvmName("getTrackLocationOffset")
    fun getTrackLocationOffset(location: TrackLocation): Offset<Path>?

    fun <T> getRangeMapFromUndirected(
        getData: (chunkId: TrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T>

    fun withRoutes(routes: List<RouteId>): PathProperties
}

/**
 * Build a Path from chunks and offsets, filtering the chunks outside the offsets. A list of
 * non-overlapping routes along the path can be provided to accommodate with route-dependant speed
 * sections. This list of routes can be empty because this information is not necessary or not
 * available in some contexts, such as unit tests. It is, however, required if speed limits are
 * computed along that path.
 */
fun buildPathPropertiesFrom(
    infra: RawSignalingInfra,
    chunks: DirStaticIdxList<TrackChunk>,
    pathBeginOffset: Offset<Path>,
    pathEndOffset: Offset<Path>,
    routes: List<RouteId>? = null,
): PathProperties {
    val chunkPath = buildChunkPath(infra, chunks, pathBeginOffset, pathEndOffset)
    return makePathProperties(infra, chunkPath, routes)
}

@JvmName("makePathProperties")
fun makePathProperties(
    infra: RawSignalingInfra,
    chunkPath: ChunkPath,
    routes: List<RouteId>? = null,
    temporarySpeedLimitManager: TemporarySpeedLimitManager? = null,
): PathProperties {
    return PathPropertiesImpl(infra, chunkPath, routes)
}

/** For java interoperability purpose */
@JvmName("makePathPropertiesWithRouteNames")
fun makePathPropertiesWithRouteNames(
    infra: RawSignalingInfra,
    chunkPath: ChunkPath,
    routes: List<String>
): PathProperties {
    return makePathProperties(infra, chunkPath, routes.map { r -> infra.getRouteFromName(r) })
}

/** For java interoperability purpose */
@JvmName("makeTrackLocation")
fun makeTrackLocation(track: TrackSectionId, offset: Offset<TrackSection>): TrackLocation {
    return TrackLocation(track, offset)
}

/**
 * For java interoperability purpose. An optional inline return type can't be handled by java when
 * it's generic.
 */
@JvmName("getTrackLocationOffsetOrThrow")
fun getTrackLocationOffsetOrThrow(path: PathProperties, location: TrackLocation): Offset<Path> {
    return path.getTrackLocationOffset(location)
        ?: throw RuntimeException("Can't find location on path")
}
