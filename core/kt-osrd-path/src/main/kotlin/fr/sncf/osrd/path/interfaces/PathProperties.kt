package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.path.implementations.ChunkPath
import fr.sncf.osrd.path.implementations.PathPropertiesImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset

data class IdxWithOffset<T, U>(val value: StaticIdx<T>, val offset: Offset<U>)

typealias IdxWithBlockPathOffset<T> = IdxWithOffset<T, BlockPath>

typealias IdxWithTravelledPathOffset<T> = IdxWithOffset<T, TravelledPath>

data class TrackLocation(val trackId: TrackSectionId, val offset: Offset<TrackSection>)

/**
 * A marker type for Length and Offset. In BlockPath, start refers to the beginning of the first
 * block (NOT the real start of the train).
 */
sealed interface BlockPath

/**
 * A marker type for Length and Offset. In TravelledPath, start refers to the real start of the head
 * of the train.
 */
// TODO path migration: remove TravelledPath entirely
typealias TravelledPath = TrainPath

@Suppress("INAPPLICABLE_JVM_NAME")
interface PathProperties {
    fun getSlopes(): DistanceRangeMap<Double>

    fun getOperationalPointParts(): List<IdxWithTravelledPathOffset<OperationalPointPart>>

    fun getGradients(): DistanceRangeMap<Double>

    fun getCurves(): DistanceRangeMap<Double>

    fun getGeo(): LineString

    fun getLoadingGauge(): DistanceRangeMap<LoadingGaugeConstraint>

    fun getElectrification(): DistanceRangeMap<Set<String>>

    fun getNeutralSections(): DistanceRangeMap<NeutralSection>

    fun getSpeedLimitProperties(
        trainTag: String?,
        temporarySpeedLimitManager: TemporarySpeedLimitManager?,
    ): DistanceRangeMap<SpeedLimitProperty>

    fun getZones(): DistanceRangeMap<ZoneId>

    fun getLength(): Distance

    fun getTrackLocationAtOffset(pathOffset: Offset<TravelledPath>): TrackLocation

    fun getTrackLocationOffset(location: TrackLocation): Offset<TravelledPath>?

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
internal fun makePathProperties(
    infra: RawSignalingInfra,
    chunkPath: ChunkPath,
    routes: List<RouteId>? = null,
): PathProperties {
    return PathPropertiesImpl(infra, chunkPath, routes)
}
