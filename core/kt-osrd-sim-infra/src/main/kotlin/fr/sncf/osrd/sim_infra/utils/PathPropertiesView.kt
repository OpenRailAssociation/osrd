package fr.sncf.osrd.sim_infra.utils

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/**
 * This class is used to create a PathProperties from a slice of an existing PathProperties.
 *
 * This implementation is *not* optimized, deep copies are made at every call. It can be improved by
 * implementing actual views on DistanceRangeMaps if the performance cost is measurable.
 */
data class PathPropertiesView(
    val base: PathProperties,
    val startOffset: Offset<Path>,
    val endOffset: Offset<Path>
) : PathProperties {
    override fun getSlopes(): DistanceRangeMap<Double> {
        return sliceRangeMap(base.getSlopes())
    }

    override fun getOperationalPointParts(): List<IdxWithPathOffset<OperationalPointPart>> {
        return base
            .getOperationalPointParts()
            .map { IdxWithOffset(it.value, it.offset - startOffset.distance) }
            .filter { it.offset >= Offset(0.meters) && it.offset.distance <= getLength() }
    }

    override fun getGradients(): DistanceRangeMap<Double> {
        return sliceRangeMap(base.getGradients())
    }

    override fun getCurves(): DistanceRangeMap<Double> {
        return sliceRangeMap(base.getCurves())
    }

    override fun getGeo(): LineString {
        val baseLength = base.getLength().meters
        return base
            .getGeo()
            .slice(startOffset.distance.meters / baseLength, endOffset.distance.meters / baseLength)
    }

    override fun getLoadingGauge(): DistanceRangeMap<LoadingGaugeConstraint> {
        return sliceRangeMap(base.getLoadingGauge())
    }

    override fun getElectrification(): DistanceRangeMap<String> {
        return sliceRangeMap(base.getElectrification())
    }

    override fun getNeutralSections(): DistanceRangeMap<NeutralSection> {
        return sliceRangeMap(base.getNeutralSections())
    }

    override fun getSpeedLimitProperties(trainTag: String?): DistanceRangeMap<SpeedLimitProperty> {
        return sliceRangeMap(base.getSpeedLimitProperties(trainTag))
    }

    override fun getLength(): Distance {
        return endOffset - startOffset
    }

    override fun getTrackLocationAtOffset(pathOffset: Offset<Path>): TrackLocation {
        return base.getTrackLocationAtOffset(pathOffset - startOffset.distance)
    }

    override fun getTrackLocationOffset(location: TrackLocation): Offset<Path>? {
        val baseResult = base.getTrackLocationOffset(location) ?: return null
        if (baseResult < startOffset || baseResult > endOffset) return null
        return baseResult - startOffset.distance
    }

    override fun <T> getRangeMapFromUndirected(
        getData: (chunkId: TrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T> {
        return sliceRangeMap(base.getRangeMapFromUndirected(getData))
    }

    private fun <T> sliceRangeMap(map: DistanceRangeMap<T>): DistanceRangeMap<T> {
        if (
            map.isEmpty() ||
                (startOffset.distance == 0.meters && endOffset.distance == map.upperBound())
        )
            return map
        val res = map.clone()
        res.shiftPositions(-startOffset.distance)
        val length = endOffset.distance - startOffset.distance
        res.truncate(0.meters, length)
        return res
    }

    override fun withRoutes(routes: List<RouteId>): PathProperties {
        return PathPropertiesView(base.withRoutes(routes), startOffset, endOffset)
    }
}
