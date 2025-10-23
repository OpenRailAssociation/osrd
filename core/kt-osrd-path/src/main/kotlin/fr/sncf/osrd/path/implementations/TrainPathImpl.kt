package fr.sncf.osrd.path.implementations

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.RangeMap
import fr.sncf.osrd.path.interfaces.*
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.makeDirChunk
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Offset.Companion.max
import fr.sncf.osrd.utils.units.Offset.Companion.min
import fr.sncf.osrd.utils.units.meters

/**
 * Basic path, does not support backtracks. Paths with backtracks are meant to be concatenated
 * versions of other path types.
 */
data class TrainPathNoBacktrack(
    private val rawInfra: RawInfra,
    private val blockInfra: BlockInfra,
    private val pathProperties: PathProperties,
    private val routes: List<RouteRange>?,
    private val blocks: List<BlockRange>,
    private val chunks: List<DirChunkRange>,
    private val electricalProfileMapping: ElectricalProfileMapping?,
    // Set to true if the blocks have been generated from the track path. Throws an error if the
    // routes are read. Note: we may eventually want to turn the error into a warning, if we do want
    // approximate blocks along the path (when we lack context and don't have the actual ones).
    // TODO: always forward actual blocks, from pathfinding to any Train Path constructor
    private val haveApproximateBlocks: Boolean,
) : PathProperties by pathProperties, TrainPath {

    private val cachedEnvelopeSimPath by lazy { computeEnvelopeSimPath() }

    private val cachedZonePaths by lazy {
        assert(routes!!.isNotEmpty())
        mapSubObjects(routes, rawInfra::getRoutePath, rawInfra::getZonePathLength)
    }

    private val cachedZoneRanges by lazy {
        cachedZonePaths.map { it.mapValue<ZoneId, Zone>(rawInfra.getZonePathZone(it.value)) }
    }

    init {
        // The sanity checks here are quite exhaustive and might be expensive to compute.
        // Once the path types are stable, we can remove some of the tests.
        fun <ValueType, OffsetType> checkRangeList(
            list: List<GenericLinearRange<ValueType, OffsetType>>,
            objectLength: (ValueType) -> Length<OffsetType>,
        ) {
            var previousRange: GenericLinearRange<ValueType, OffsetType>? = null
            for (range in list) {
                previousRange?.let { require(range.pathBegin == it.pathEnd) }
                require(range.objectBegin >= Offset.zero())
                require(range.objectEnd <= objectLength(range.value))
                previousRange = range
            }
            require(list.first().pathBegin == Offset.zero<TrainPath>())
            require(list.last().pathEnd == getTypedLength())
        }
        routes?.let {
            if (!routes.isEmpty()) checkRangeList(routes) { rawInfra.getRouteLength(it) }
        }
        checkRangeList(blocks) { blockInfra.getBlockLength(it) }
        checkRangeList(chunks) { rawInfra.getTrackChunkLength(it.value) }
    }

    override fun subPath(from: Offset<TrainPath>?, to: Offset<TrainPath>?): TrainPath {
        val fromDist = from ?: Offset(0.meters)
        val toDist = to ?: Offset(getLength())
        return TrainPathNoBacktrack(
            rawInfra = rawInfra,
            blockInfra = blockInfra,
            pathProperties = PathPropertiesView(pathProperties, fromDist.cast(), toDist.cast()),
            routes = routes?.let { linearObjectListSubRange(it, fromDist, toDist) },
            blocks = linearObjectListSubRange(blocks, fromDist, toDist),
            chunks = linearObjectListSubRange(chunks, fromDist, toDist),
            electricalProfileMapping = electricalProfileMapping,
            haveApproximateBlocks = haveApproximateBlocks,
        )
    }

    override fun getTypedLength(): Length<TrainPath> {
        return Length(getLength())
    }

    override fun getBlocks(): List<BlockRange> {
        require(!haveApproximateBlocks)
        return blocks
    }

    override fun getRoutes(): List<RouteRange> = routes!!

    override fun getChunks(): List<DirChunkRange> = chunks

    override fun getZonePaths(): List<ZonePathRange> = cachedZonePaths

    override fun getZoneRanges(): List<ZoneRange> = cachedZoneRanges

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
        return EnvelopeTrainPath.from(rawInfra, this, electricalProfileMapping)
    }

    /** Truncate the list of linear objects, updating the underlying object ranges */
    private fun <ValueType, OffsetType> linearObjectListSubRange(
        list: List<GenericLinearRange<ValueType, OffsetType>>,
        from: Offset<TrainPath>,
        to: Offset<TrainPath>,
    ): List<GenericLinearRange<ValueType, OffsetType>> {
        require(from >= Offset.zero())
        require(to <= getTypedLength())
        return list.mapNotNull { (value, objectBegin, objectEnd, pathBegin, pathEnd) ->
            val truncatedStart = max(from, pathBegin)
            val truncatedEnd = min(to, pathEnd)

            if (truncatedStart > truncatedEnd) return@mapNotNull null

            GenericLinearRange(
                value = value,
                objectBegin = objectBegin + (truncatedStart - pathBegin),
                objectEnd = objectEnd - (pathEnd - truncatedEnd),
                pathBegin = truncatedStart - from.distance,
                pathEnd = truncatedEnd - from.distance,
            )
        }
    }

    override fun withRoutes(routes: List<RouteId>): TrainPath {
        val routeRanges = generateRouteRanges(rawInfra, chunks, routes)
        return copy(routes = routeRanges, pathProperties = pathProperties.withRoutes(routes))
    }

    /** *Debugging purpose*. We try to find the actual names of underlying objects. */
    override fun toString(): String {
        data class PrintableRange<T>(
            val objectBegin: Distance,
            val objectEnd: Distance,
            val pathBegin: Distance,
            val pathEnd: Distance,
            val value: T,
        ) {
            override fun toString(): String {
                return "(path[$pathBegin;$pathEnd]:$value[$objectBegin,$objectEnd])"
            }
        }
        fun <T, U> listToPrintable(
            list: List<GenericLinearRange<T, U>>?,
            toPrintable: (T) -> String,
        ): String {
            return list
                ?.map {
                    PrintableRange(
                        it.objectBegin.distance,
                        it.objectEnd.distance,
                        it.pathBegin.distance,
                        it.pathEnd.distance,
                        toPrintable(it.value),
                    )
                }
                .toString()
        }
        val chunks = listToPrintable(chunks) { makeDirChunk(rawInfra, it).toString() }
        val blocks = listToPrintable(blocks) { "block=${it.index.toInt()}" }
        val routes = listToPrintable(routes) { rawInfra.getRouteName(it) }
        return "$chunks ; blocks=$blocks ; routes=$routes"
    }
}
