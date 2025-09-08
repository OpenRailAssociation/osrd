package fr.sncf.osrd.path.implementations

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
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
    private val routes: LinearObjectMap<RouteRange>?,
    private val blocks: LinearObjectMap<BlockRange>,
    private val chunks: LinearObjectMap<DirChunkRange>,
    private val electricalProfileMapping: ElectricalProfileMapping?,
    // Set to true if the blocks have been generated from the track path. Throws an error if the
    // routes are read. Note: we may eventually want to turn the error into a warning, if we do want
    // approximate blocks along the path (when we lack context and don't have the actual ones).
    // TODO: always forward actual blocks, from pathfinding to any Train Path constructor
    private val haveApproximateBlocks: Boolean,
) : PathProperties by pathProperties, TrainPath {

    private val cachedEnvelopeSimPath by lazy { computeEnvelopeSimPath() }

    init {
        // The sanity checks here are quite exhaustive and might be expensive to compute.
        // Once the path types are stable, we can remove some of the tests.
        fun <ValueType, OffsetType> checkRangeMap(
            map: LinearObjectMap<GenericLinearRange<ValueType, OffsetType>>,
            objectLength: (ValueType) -> Length<OffsetType>,
        ) {
            val entries = map.asMapOfRanges()
            for ((key, value) in entries) {
                require(value.length == (key.upperEndpoint() - key.lowerEndpoint()))
                require(value.from >= Offset.zero())
                require(value.to <= objectLength(value.value))
            }
            require(map.span().lowerEndpoint() == Offset.zero<TrainPath>())
            require(map.span().upperEndpoint() == getTypedLength())
        }
        routes?.let {
            if (!routes.asMapOfRanges().isEmpty())
                checkRangeMap(routes) { rawInfra.getRouteLength(it) }
        }
        checkRangeMap(blocks) { blockInfra.getBlockLength(it) }
        checkRangeMap(chunks) { rawInfra.getTrackChunkLength(it.value) }
    }

    override fun subPath(from: Offset<TrainPath>?, to: Offset<TrainPath>?): TrainPath {
        val fromDist = from ?: Offset(0.meters)
        val toDist = to ?: Offset(getLength())
        return TrainPathNoBacktrack(
            rawInfra = rawInfra,
            blockInfra = blockInfra,
            pathProperties = PathPropertiesView(pathProperties, fromDist.cast(), toDist.cast()),
            routes = routes?.let { linearObjectSubMap(it, fromDist, toDist) },
            blocks = linearObjectSubMap(blocks, fromDist, toDist),
            chunks = linearObjectSubMap(chunks, fromDist, toDist),
            electricalProfileMapping = electricalProfileMapping,
            haveApproximateBlocks = haveApproximateBlocks,
        )
    }

    override fun getTypedLength(): Length<TrainPath> {
        return Length(getLength())
    }

    override fun getBlocks(): LinearObjectMap<BlockRange> {
        require(!haveApproximateBlocks)
        return blocks
    }

    override fun getRoutes(): LinearObjectMap<RouteRange> = routes!!

    override fun getChunks(): LinearObjectMap<DirChunkRange> = chunks

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
        map: LinearObjectMap<GenericLinearRange<ValueType, OffsetType>>,
        from: Offset<TrainPath>,
        to: Offset<TrainPath>,
    ): LinearObjectMap<GenericLinearRange<ValueType, OffsetType>> {
        val newMapEntries =
            map.asMapOfRanges().mapValues { (key, value) ->
                var value = value
                val lower = key.lowerEndpoint()
                val upper = key.upperEndpoint()
                val truncatedStartDist = from.distance - lower.distance
                val truncatedEndDist = upper.distance - to.distance

                if (truncatedStartDist > 0.meters) {
                    value = value.copy(from = value.from + truncatedStartDist)
                }
                if (truncatedEndDist > 0.meters) {
                    value = value.copy(to = value.to - truncatedStartDist)
                }
                value
            }
        val builder =
            ImmutableRangeMap.builder<
                Offset<TrainPath>,
                GenericLinearRange<ValueType, OffsetType>,
            >()
        for (entry in newMapEntries) {
            val lower = max(entry.key.lowerEndpoint() - from.distance, Offset.zero())
            val upper = min(entry.key.lowerEndpoint() - from.distance, getTypedLength())
            if (lower <= upper) {
                val newKey =
                    Range.range(
                        lower,
                        entry.key.lowerBoundType(),
                        upper,
                        entry.key.upperBoundType(),
                    )
                builder.put(newKey, entry.value)
            }
        }
        return builder.build()
    }

    /** *Debugging purpose*. We try to find the actual names of underlying objects. */
    override fun toString(): String {
        data class PrintableRange<T>(val from: Distance, val to: Distance, val value: T) {
            override fun toString(): String {
                return "($value[$from,$to])"
            }
        }
        fun <T, U> mapToPrintable(
            map: LinearObjectMap<GenericLinearRange<T, U>>?,
            toPrintable: (T) -> String,
        ): String {
            return map?.asMapOfRanges()
                ?.mapValues {
                    PrintableRange(
                        it.key.lowerEndpoint().distance,
                        it.key.upperEndpoint().distance,
                        toPrintable(it.value.value),
                    )
                }
                .toString()
        }
        val chunks = mapToPrintable(chunks) { makeDirChunk(rawInfra, it).toString() }
        val blocks = mapToPrintable(blocks) { "block=${it.index.toInt()}" }
        val routes = mapToPrintable(routes) { rawInfra.getRouteName(it) }
        return "$chunks ; blocks=$blocks ; routes=$routes"
    }
}
