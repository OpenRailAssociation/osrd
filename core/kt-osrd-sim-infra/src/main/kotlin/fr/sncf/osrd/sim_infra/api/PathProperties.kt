package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.railjson.schema.geom.LineString
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.DistanceRangeMap

data class Path(
    val chunks: DirStaticIdxList<TrackChunk>,
    val beginOffset: Distance,
    val endOffset: Distance,
)

data class WithOffset<T>(
    val value: T,
    val offset: Distance,
)
typealias IdxWithOffset<T> = WithOffset<StaticIdx<T>>

interface PathProperties {
    fun getSlopesOnPath(path: Path): DistanceRangeMap<Double>
    fun getOperationalPointsOnPath(path: Path): List<IdxWithOffset<OperationalPoint>>
    // TODO: (need extra data in the new infra)
    // fun getGradientsOnPath(path: Path): DistanceRangeMap<Double>
    // fun getCurvesOnPath(path: Path): DistanceRangeMap<Double>
    // fun getGeoOnPath(path: Path): LineString
    // fun getLoadingGauge(path: Path): DistanceRangeMap<Map<LoadingGaugeConstraint>>
    // fun getOperationalPointsOnPath(path: Path): List<LocatedIdx<OperationalPoint>>
    // fun getCatenaryOnPath(path: Path): DistanceRangeMap<List<String>>
}