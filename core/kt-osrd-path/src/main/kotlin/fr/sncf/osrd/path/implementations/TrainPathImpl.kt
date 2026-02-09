package fr.sncf.osrd.path.implementations

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.RangeMap
import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.path.interfaces.*
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.sim_infra.impl.makeDirChunk
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.forceDirected
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.toDirected
import kotlin.collections.flatMap

/**
 * Default train path implementation. Other implementation may be views or similar.
 *
 * Keeps track of route / block / chunk range lists, and builds the rest of the requested data from
 * there.
 */
data class TrainPathImpl(
    private val rawInfra: RawInfra,
    private val blockInfra: BlockInfra,
    private val routes: List<RouteRange>?,
    private val blocks: List<BlockRange>,
    private val chunks: List<DirChunkRange>,
    private val electricalProfileMapping: ElectricalProfileMapping?,
    private val backtrackLocations: List<Offset<PhysicsPath>>,
    // Set to true if the blocks have been generated from the track path. Throws an error if the
    // routes are read. The only case where this should be true (outside of tests) is in the path
    // properties endpoint, where routes aren't necessary and would make the payload heavier.
    private val haveApproximateBlocks: Boolean,
) : TrainPath {

    private val cachedEnvelopeSimPath by lazy { computeEnvelopeSimPath() }

    private val cachedZonePaths by lazy {
        assert(routes!!.isNotEmpty())
        routes.mapSubObjects(rawInfra::getRoutePath, rawInfra::getZonePathLength)
    }

    private val cachedZoneRanges by lazy {
        cachedZonePaths.map {
            it.mapValue<ZoneId, Zone>(rawInfra.getZonePathZone(it.value), it.objectLength.cast())
        }
    }

    private val cachedDirTracks by lazy { getTrackRanges() }

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
            require(list.last().pathEnd == getLength())
        }
        routes?.let {
            if (!routes.isEmpty()) checkRangeList(routes) { rawInfra.getRouteLength(it) }
        }
        checkRangeList(blocks) { blockInfra.getBlockLength(it) }
        checkRangeList(chunks) { rawInfra.getTrackChunkLength(it.value).forceDirected() }
    }

    override fun subPath(
        from: Offset<PhysicsPath>?,
        to: Offset<PhysicsPath>?,
        includeExactStart: Boolean,
        includeExactEnd: Boolean,
    ): TrainPath {
        val fromDist = from ?: Offset(0.meters)
        val toDist = to ?: getLength()
        return TrainPathImpl(
            rawInfra = rawInfra,
            blockInfra = blockInfra,
            routes =
                routes?.subRange(
                    fromDist,
                    toDist,
                    resetOffsets = true,
                    includeExactStart = includeExactStart,
                    includeExactEnd = includeExactEnd,
                ),
            blocks =
                blocks.subRange(
                    fromDist,
                    toDist,
                    resetOffsets = true,
                    includeExactStart = includeExactStart,
                    includeExactEnd = includeExactEnd,
                ),
            chunks =
                chunks.subRange(
                    fromDist,
                    toDist,
                    resetOffsets = true,
                    includeExactStart = includeExactStart,
                    includeExactEnd = includeExactEnd,
                ),
            electricalProfileMapping = electricalProfileMapping,
            haveApproximateBlocks = haveApproximateBlocks,
            backtrackLocations = backtrackLocations.filter { it.cast() in fromDist..toDist },
        )
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
        get() = getLength().meters

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

    override fun getSlopes(): DistanceRangeMap<Double> {
        return getRangeMap { dirChunkId -> rawInfra.getTrackChunkSlope(dirChunkId) }
    }

    override fun getOperationalPointParts():
        List<GenericLinearRange.LocatedObject<OperationalPointPartId>> {
        val res = mutableListOf<GenericLinearRange.LocatedObject<OperationalPointPartId>>()
        for (chunkRange in chunks) {
            val parts = rawInfra.getTrackChunkOperationalPointParts(chunkRange.value.value)
            for (part in parts) {
                val offset = rawInfra.getOperationalPointPartChunkOffset(part)
                val directedOffset = chunkRange.offsetToDirected(offset)
                if (!chunkRange.containsObjectOffset(directedOffset)) continue
                val pathOffset = chunkRange.offsetToTrainPath(directedOffset)
                res.add(GenericLinearRange.LocatedObject(part, pathOffset))
            }
        }
        return res.sortedBy { it.offset }
    }

    override fun getGradients(): DistanceRangeMap<Double> {
        return getRangeMap { dirChunkId -> rawInfra.getTrackChunkGradient(dirChunkId) }
    }

    override fun getCurves(): DistanceRangeMap<Double> {
        return getRangeMap { dirChunkId -> rawInfra.getTrackChunkCurve(dirChunkId) }
    }

    override fun getGeo(): LineString {
        fun getDirData(dirChunkId: DirTrackChunkId): LineString {
            val data = rawInfra.getTrackChunkGeom(dirChunkId.value)
            return if (dirChunkId.direction == Direction.INCREASING) data else data.reverse()
        }

        fun sliceChunkData(chunkRange: DirChunkRange): LineString {
            val chunkLength = rawInfra.getTrackChunkLength(chunkRange.value.value).meters
            val beginSliceOffset = chunkRange.objectBegin.meters
            val endSliceOffset = chunkRange.objectEnd.meters
            return getDirData(chunkRange.value)
                .slice(beginSliceOffset / chunkLength, endSliceOffset / chunkLength)
        }

        val chunks = chunks
        if (chunks.isEmpty()) return LineString.make(doubleArrayOf(), doubleArrayOf())

        val lineStrings = chunks.map { sliceChunkData(it) }
        return LineString.concatenate(lineStrings)
    }

    override fun getLoadingGauge(): DistanceRangeMap<LoadingGaugeConstraint> {
        return getRangeMapFromUndirected { chunkId ->
            rawInfra.getTrackChunkLoadingGaugeConstraints(chunkId)
        }
    }

    override fun getElectrification(): DistanceRangeMap<Set<String>> {
        return getRangeMapFromUndirected { chunkId ->
            rawInfra.getTrackChunkElectrificationVoltage(chunkId)
        }
    }

    override fun getNeutralSections(): DistanceRangeMap<NeutralSection> {
        return getRangeMap { dirChunkId -> rawInfra.getTrackChunkNeutralSections(dirChunkId) }
    }

    override fun getSpeedLimitProperties(
        trainTag: String?,
        temporarySpeedLimitManager: TemporarySpeedLimitManager?,
    ): DistanceRangeMap<SpeedLimitProperty> {
        assert(routes != null) {
            "the routes on a path should be set when attempting to compute a speed limit"
        }
        return getRangeMap { dirChunkId ->
            val routeOnChunk =
                rawInfra.getRoutesOnTrackChunk(dirChunkId).firstOrNull { route ->
                    routes!!.any { it.value == route }
                }
            // TODO: add a warning.
            // Technically, in the following situation, the path would loop, and you could have 2
            // itineraries in the path with the same commonChunk, with no way to know the true speed
            // limit. For now, we take the first itinerary's speed limit.
            // -> - -
            //        \
            //         end
            //           \
            // - start - - - commonChunk - ->
            val route = routeOnChunk?.let { routeId -> rawInfra.getRouteName(routeId) }
            val permanentSpeedLimits =
                rawInfra.getTrackChunkSpeedLimitProperties(dirChunkId, trainTag, route)
            if (temporarySpeedLimitManager != null) {
                temporarySpeedLimitManager.speedLimits[dirChunkId]?.let { applicableSpeedLimits ->
                    permanentSpeedLimits.updateMap(
                        applicableSpeedLimits,
                        { s1, s2 ->
                            if (s1.speed < s2.speed) {
                                s1
                            } else {
                                s2
                            }
                        },
                    )
                }
            }
            permanentSpeedLimits
        }
    }

    override fun getZones(): DistanceRangeMap<ZoneId> {
        // This is more verbose than going through ZonePaths,
        // but it works even when routes aren't specified.
        return getRangeMapFromUndirected { chunkId ->
            val zoneId = rawInfra.getTrackChunkZone(chunkId)
            if (zoneId != null) {
                val chunkLength = rawInfra.getTrackChunkLength(chunkId).distance
                distanceRangeMapOf(
                    DistanceRangeMap.RangeMapEntry(Distance.ZERO, chunkLength, zoneId)
                )
            } else {
                distanceRangeMapOf()
            }
        }
    }

    override fun getLength(): Length<PhysicsPath> {
        return blocks.last().pathEnd
    }

    override fun getTrackLocationAtOffset(pathOffset: Offset<PhysicsPath>): TrackLocation {
        val dirTrackRange = cachedDirTracks.first { it.containsPathOffset(pathOffset) }
        val dirTrackOffset = dirTrackRange.offsetFromTrainPath(pathOffset)
        val trackOffset = dirTrackRange.offsetToUndirected(dirTrackOffset)
        return TrackLocation(dirTrackRange.value.value, trackOffset)
    }

    /**
     * Use the given function to get the range data from a chunk, and concatenates all the values on
     * the path
     */
    private fun <T> getRangeMap(
        getData: (dirChunkId: DirTrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T> {
        // TODO: reduce allocations (subMap allocates -too much- before truncate, then asList
        //       allocates again)
        val entries =
            chunks
                .asSequence()
                .filter { !it.isSinglePoint() }
                .flatMap {
                    getData(it.value)
                        .subMap(it.objectBegin.distance, it.objectEnd.distance)
                        .shiftPositions(it.pathBegin.distance - it.objectBegin.distance)
                        .asList()
                }
        return distanceRangeMapOf(entries.toList())
    }

    private fun getTrackRanges(): List<DirTrackRange> {
        val partialTrackRanges = mutableListOf<PartialDirTrackRange>()
        for (chunkRange in chunks) {
            val dirChunkId = chunkRange.value
            val dir = dirChunkId.direction
            val chunk = dirChunkId.value
            val track = rawInfra.getTrackFromChunk(chunk)
            val chunkOffset = rawInfra.getTrackChunkOffset(chunk)
            val trackLength = rawInfra.getTrackSectionLength(track)

            // Convert directed offsets to undirected offset, add chunk offset, then convert back.
            // It's verbose but easier to follow along with typing.
            val undirectedChunkBegin = chunkRange.offsetToUndirected(chunkRange.objectBegin)
            val undirectedChunkEnd = chunkRange.offsetToUndirected(chunkRange.objectEnd)
            val undirectedTrackBegin = chunkOffset + undirectedChunkBegin.distance
            val undirectedTrackEnd = chunkOffset + undirectedChunkEnd.distance
            val directedTrackBegin = undirectedTrackBegin.toDirected(trackLength, dir)
            val directedTrackEnd = undirectedTrackEnd.toDirected(trackLength, dir)

            partialTrackRanges.add(
                PartialDirTrackRange(
                    DirStaticIdx(track, dir),
                    directedTrackBegin,
                    directedTrackEnd,
                    trackLength.forceDirected(),
                )
            )
        }
        return buildRangeList(partialTrackRanges)
    }

    override fun <T> getRangeMapFromUndirected(
        getData: (chunkId: TrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T> {
        fun projectDirection(dirChunk: DirTrackChunkId): DistanceRangeMap<T> {
            val data = getData(dirChunk.value)
            if (dirChunk.direction == Direction.INCREASING) return data
            val chunkLength = rawInfra.getTrackChunkLength(dirChunk.value).distance
            val res = distanceRangeMapOf<T>()
            for (entry in data) {
                assert(0.meters <= entry.lower && entry.lower <= chunkLength)
                assert(0.meters <= entry.upper && entry.upper <= chunkLength)
                res.put(chunkLength - entry.upper, chunkLength - entry.lower, entry.value)
            }
            return res
        }
        return getRangeMap { dirChunkId -> projectDirection(dirChunkId) }
    }

    override fun withRoutes(routes: List<RouteId>): TrainPath {
        val routeRanges = generateRouteRanges(rawInfra, chunks, routes)
        return copy(routes = routeRanges)
    }

    override fun getBacktrackLocations(): List<Offset<PhysicsPath>> {
        return backtrackLocations
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
