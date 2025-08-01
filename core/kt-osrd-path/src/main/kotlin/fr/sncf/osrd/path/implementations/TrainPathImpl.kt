package fr.sncf.osrd.path.implementations

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.RangeMap
import fr.sncf.osrd.path.interfaces.*
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/**
 * Basic path, does not support backtracks. Paths with backtracks are meant to be concatenated
 * versions of other path types.
 */
data class TrainPathNoBacktrack(
    private val rawInfra: RawInfra,
    private val pathProperties: PathProperties,
    private val routes: DistanceRangeMap<RouteRange>?,
    private val blocks: DistanceRangeMap<BlockRange>,
    private val chunks: DistanceRangeMap<DirChunkRange>,
    private val electricalProfileMapping: ElectricalProfileMapping?,
) : PathProperties by pathProperties, TrainPath {

    private val cachedEnvelopeSimPath by lazy { computeEnvelopeSimPath() }

    init {
        fun <ValueType, OffsetType> checkRangeMap(
            map: DistanceRangeMap<GenericLinearRange<ValueType, OffsetType>>
        ) {
            for (entry in map) require(entry.value.length == (entry.upper - entry.lower))
            require(map.lowerBound() == 0.meters)
            require(map.upperBound() == getLength())
        }
        routes?.let { if (!it.isEmpty()) checkRangeMap(it) }
        checkRangeMap(blocks)
        checkRangeMap(chunks)
    }

    override fun subPath(from: Offset<TrainPath>?, to: Offset<TrainPath>?): TrainPath {
        val fromDist = from ?: Offset(0.meters)
        val toDist = to ?: Offset(getLength())
        return TrainPathNoBacktrack(
            rawInfra = rawInfra,
            pathProperties = PathPropertiesView(pathProperties, fromDist.cast(), toDist.cast()),
            routes = routes?.let { linearObjectSubMap(it, fromDist, toDist) },
            blocks = linearObjectSubMap(blocks, fromDist, toDist),
            chunks = linearObjectSubMap(chunks, fromDist, toDist),
            electricalProfileMapping = electricalProfileMapping,
        )
    }

    override fun getBlocks(): DistanceRangeMap<BlockRange> = blocks

    override fun getRoutes(): DistanceRangeMap<RouteRange> = routes!!

    override fun getChunks(): DistanceRangeMap<DirChunkRange> = chunks

    override val length: Double
        get() = pathProperties.getLength().meters

    override fun getAverageGrade(begin: Double, end: Double): Double {
        return cachedEnvelopeSimPath.getAverageGrade(begin, end)
    }

    override fun getMinGrade(begin: Double, end: Double): Double {
        return cachedEnvelopeSimPath.getMinGrade(begin, end)
    }

    override fun getElectrificationMap(
        basePowerClass: String?,
        powerRestrictionMap: RangeMap<Double, String>?,
        powerRestrictionToPowerClass: Map<String, String>?,
        ignoreElectricalProfiles: Boolean,
    ): ImmutableRangeMap<Double, Electrification> {
        return cachedEnvelopeSimPath.getElectrificationMap(
            basePowerClass,
            powerRestrictionMap,
            powerRestrictionToPowerClass,
            ignoreElectricalProfiles,
        )
    }

    private fun computeEnvelopeSimPath(): PhysicsPath {
        return EnvelopeTrainPath.from(rawInfra, pathProperties, electricalProfileMapping)
    }

    /** Truncate the distance range maps of linear objects, updating the underlying object range */
    private fun <ValueType, OffsetType> linearObjectSubMap(
        map: DistanceRangeMap<GenericLinearRange<ValueType, OffsetType>>,
        from: Offset<TrainPath>,
        to: Offset<TrainPath>,
    ): DistanceRangeMap<GenericLinearRange<ValueType, OffsetType>> {
        val newEntries =
            map.map { entry ->
                    var value = entry.value
                    val (lower, upper, _) = entry
                    val truncatedStartDist = from.distance - lower
                    val truncatedEndDist = upper - to.distance

                    if (truncatedStartDist > 0.meters) {
                        value = value.copy(from = value.from + truncatedStartDist)
                    }
                    if (truncatedEndDist > 0.meters) {
                        value = value.copy(to = value.to - truncatedStartDist)
                    }
                    entry.copy(value = value)
                }
                .filter { it.lower < it.upper }
        var res = distanceRangeMapOf<GenericLinearRange<ValueType, OffsetType>>()
        res.putMany(newEntries)
        res = res.subMap(from.distance, to.distance)
        res.shiftPositions(-from.distance)
        return res
    }
}
