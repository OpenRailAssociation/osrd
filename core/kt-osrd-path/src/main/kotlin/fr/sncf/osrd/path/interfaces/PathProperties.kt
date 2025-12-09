package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

data class TrackLocation(val trackId: TrackSectionId, val offset: Offset<TrackSection>)

@Suppress("INAPPLICABLE_JVM_NAME")
interface PathProperties {
    fun getSlopes(): DistanceRangeMap<Double>

    fun getOperationalPointParts(): List<GenericLinearRange.LocatedObject<OperationalPointPartId>>

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

    fun getLength(): Length<TrainPath>

    fun getTrackLocationAtOffset(pathOffset: Offset<TrainPath>): TrackLocation

    fun <T> getRangeMapFromUndirected(
        getData: (chunkId: TrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T>

    fun withRoutes(routes: List<RouteId>): PathProperties
}
