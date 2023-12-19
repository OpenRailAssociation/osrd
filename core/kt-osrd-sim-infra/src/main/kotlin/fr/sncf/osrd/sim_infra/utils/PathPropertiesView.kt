package fr.sncf.osrd.sim_infra.utils

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.NeutralSection
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.meters

/**
 * This class is used to create a PathProperties from a slice of an existing PathProperties.
 *
 * This implementation is *not* optimized, deep copies are made at every call. It should eventually
 * be improved by implementing actual views on DistanceRangeMaps. This should be done as part of the
 * refactor that integrates STDCM with conflict detection, once everything is working properly.
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
            .filter { it.offset >= Offset(0.meters) && it.offset <= getLength() }
    }

    override fun getGradients(): DistanceRangeMap<Double> {
        return sliceRangeMap(base.getGradients())
    }

    override fun getCurves(): DistanceRangeMap<Double> {
        return sliceRangeMap(base.getCurves())
    }

    override fun getGeo(): LineString {
        val baseLength = base.getLength().distance.meters
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

    override fun getSpeedLimits(trainTag: String?): DistanceRangeMap<Speed> {
        return sliceRangeMap(base.getSpeedLimits(trainTag))
    }

    override fun getLength(): Length<Path> {
        return Length(endOffset - startOffset)
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
}
