package fr.sncf.osrd.path.implementations

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.RangeMap
import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.DirChunkRange
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.GenericLinearRange
import fr.sncf.osrd.path.interfaces.RouteRange
import fr.sncf.osrd.path.interfaces.TrackLocation
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.ZonePathRange
import fr.sncf.osrd.path.interfaces.ZoneRange
import fr.sncf.osrd.sim_infra.api.LoadingGaugeConstraint
import fr.sncf.osrd.sim_infra.api.NeutralSection
import fr.sncf.osrd.sim_infra.api.OperationalPointPartId
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.sim_infra.api.SpeedLimitProperty
import fr.sncf.osrd.sim_infra.api.TrackChunkId
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

/**
 * This class is a view on a train path, it's very similar to `originalPath.subPath(begin, end)`.
 * But it keeps track of the original path when accessing grade data outside the new range.
 */
data class PathViewWithFullSlopes(
    val originalPath: TrainPath,
    val begin: Offset<TrainPath>,
    val end: Offset<TrainPath>,
) : TrainPath {
    override val length: Double
        get() = (end - begin).meters

    val subPath by lazy { originalPath.subPath(begin, end) }

    override fun getAverageGrade(begin: Double, end: Double): Double {
        return originalPath.getAverageGrade(begin + this.begin.meters, end + this.begin.meters)
    }

    override fun getMinGrade(begin: Double, end: Double): Double {
        return originalPath.getMinGrade(begin + this.begin.meters, end + this.begin.meters)
    }

    override fun getElectrificationMap(
        basePowerClass: String?,
        powerRestrictionMap: RangeMap<Double, String>?,
        powerRestrictionToPowerClass: Map<String, String>?,
        ignoreElectricalProfiles: Boolean,
    ): ImmutableRangeMap<Double, Electrification> {
        return subPath.getElectrificationMap(
            basePowerClass,
            powerRestrictionMap,
            powerRestrictionToPowerClass,
            ignoreElectricalProfiles,
        )
    }

    override fun subPath(from: Offset<TrainPath>?, to: Offset<TrainPath>?): TrainPath {
        return subPath.subPath(from, to)
    }

    override fun withRoutes(routes: List<RouteId>): TrainPath {
        return PathViewWithFullSlopes(originalPath.withRoutes(routes), begin, end)
    }

    override fun getBacktrackLocations(): List<Offset<TrainPath>> {
        return subPath.getBacktrackLocations()
    }

    override fun getBlocks(): List<BlockRange> {
        return subPath.getBlocks()
    }

    override fun getRoutes(): List<RouteRange> {
        return subPath.getRoutes()
    }

    override fun getChunks(): List<DirChunkRange> {
        return subPath.getChunks()
    }

    override fun getZonePaths(): List<ZonePathRange> {
        return subPath.getZonePaths()
    }

    override fun getZoneRanges(): List<ZoneRange> {
        return subPath.getZoneRanges()
    }

    override fun getSlopes(): DistanceRangeMap<Double> {
        return subPath.getSlopes()
    }

    override fun getOperationalPointParts():
        List<GenericLinearRange.LocatedObject<OperationalPointPartId>> {
        return subPath.getOperationalPointParts()
    }

    override fun getGradients(): DistanceRangeMap<Double> {
        return subPath.getGradients()
    }

    override fun getCurves(): DistanceRangeMap<Double> {
        return subPath.getCurves()
    }

    override fun getGeo(): LineString {
        return subPath.getGeo()
    }

    override fun getLoadingGauge(): DistanceRangeMap<LoadingGaugeConstraint> {
        return subPath.getLoadingGauge()
    }

    override fun getElectrification(): DistanceRangeMap<Set<String>> {
        return subPath.getElectrification()
    }

    override fun getNeutralSections(): DistanceRangeMap<NeutralSection> {
        return subPath.getNeutralSections()
    }

    override fun getSpeedLimitProperties(
        trainTag: String?,
        temporarySpeedLimitManager: TemporarySpeedLimitManager?,
    ): DistanceRangeMap<SpeedLimitProperty> {
        return subPath.getSpeedLimitProperties(trainTag, temporarySpeedLimitManager)
    }

    override fun getZones(): DistanceRangeMap<ZoneId> {
        return subPath.getZones()
    }

    override fun getLength(): Length<TrainPath> {
        return subPath.getLength()
    }

    override fun getTrackLocationAtOffset(pathOffset: Offset<TrainPath>): TrackLocation {
        return subPath.getTrackLocationAtOffset(pathOffset)
    }

    override fun <T> getRangeMapFromUndirected(
        getData: (chunkId: TrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T> {
        return subPath.getRangeMapFromUndirected(getData)
    }
}
