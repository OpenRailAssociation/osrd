package fr.sncf.osrd.sim_infra.impl.new_impl

import fr.sncf.osrd.fast_collections.mutableIntArrayListOf
import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.DirectionalMap
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.Endpoint
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*
import java.util.*
import kotlin.collections.HashMap
import kotlin.collections.set
import kotlin.time.Duration

class ZoneDescriptorBuilder(
    val movableElements: MutableStaticIdxSortedSet<TrackNode>,
)

interface RouteBuilder {
    fun zonePath(zonePath: StaticIdx<ZonePath>)

    fun releaseZone(index: Int)

    fun speedLimit(limit: SpeedLimitId, start: Offset<Route>, end: Offset<Route>)

    fun trackChunk(chunkId: DirTrackChunkId)
}

class RouteBuilderImpl(private val name: String?) : RouteBuilder {
    private val path: MutableStaticIdxList<ZonePath> = mutableStaticIdxArrayListOf()
    private val releaseZones = mutableIntArrayListOf()
    private val speedLimits = mutableStaticIdxArrayListOf<SpeedLimit>()
    private val speedLimitStarts = mutableOffsetArrayListOf<Route>()
    private val speedLimitEnds = mutableOffsetArrayListOf<Route>()
    private val chunks = mutableDirStaticIdxArrayListOf<TrackChunk>()

    override fun zonePath(zonePath: StaticIdx<ZonePath>) {
        path.add(zonePath)
    }

    override fun releaseZone(index: Int) {
        assert(releaseZones.isEmpty() || releaseZones.last() < index)
        releaseZones.add(index)
    }

    override fun speedLimit(limit: SpeedLimitId, start: Offset<Route>, end: Offset<Route>) {
        speedLimits.add(limit)
        speedLimitStarts.add(start)
        speedLimitEnds.add(end)
    }

    override fun trackChunk(chunkId: DirTrackChunkId) {
        chunks.add(chunkId)
    }

    fun build(): RouteDescriptor {
        return RouteDescriptor(
            name,
            Length(Distance.ZERO),
            path,
            releaseZones.toMutableArray().asPrimitiveArray(),
            speedLimits,
            speedLimitStarts,
            speedLimitEnds,
            chunks
        )
    }
}

interface ZonePathBuilder {
    fun movableElement(
        movableElement: TrackNodeId,
        config: TrackNodeConfigId,
        zonePathOffset: Offset<ZonePath>
    )
}

class ZonePathBuilderImpl(
    val entry: DirDetectorId,
    val exit: DirDetectorId,
) : ZonePathBuilder {
    private val movableElements = MutableStaticIdxArrayList<TrackNode>()
    private val movableElementsConfigs = MutableStaticIdxArrayList<TrackNodeConfig>()
    private val movableElementsDistances = MutableOffsetArrayList<ZonePath>()

    override fun movableElement(
        movableElement: TrackNodeId,
        config: TrackNodeConfigId,
        zonePathOffset: Offset<ZonePath>
    ) {
        movableElements.add(movableElement)
        movableElementsConfigs.add(config)
        movableElementsDistances.add(zonePathOffset)
    }

    fun build(): ZonePathDescriptor {
        return ZonePathDescriptor(
            entry,
            exit,
            movableElements,
            movableElementsConfigs,
            movableElementsDistances,
            MutableDirStaticIdxArrayList()
        )
    }
}

fun parseSpeedSection(rjsSpeedSection: RJSSpeedSection): SpeedSection {
    return SpeedSection(
        rjsSpeedSection.speedLimit.metersPerSecond,
        rjsSpeedSection.speedLimitByTag
            .map { entry -> Pair(entry.key, entry.value.metersPerSecond) }
            .toMap()
    )
}

interface PhysicalSignalBuilder {
    fun logicalSignal(
        signalingSystem: String,
        nextSignalingSystems: List<String>,
        settings: Map<String, String>,
        parameters: RawSignalParameters,
    ): LogicalSignalId
}

class PhysicalSignalBuilderImpl(
    private val name: String?,
    private val sightDistance: Distance,
    private val dirTrackSectionId: DirTrackSectionId,
    private val undirectedTrackOffset: Offset<TrackSection>,
    private val globalPool: StaticPool<LogicalSignal, LogicalSignalDescriptor>,
) : PhysicalSignalBuilder {
    private val children: MutableStaticIdxList<LogicalSignal> = MutableStaticIdxArrayList()

    override fun logicalSignal(
        signalingSystem: String,
        nextSignalingSystems: List<String>,
        settings: Map<String, String>,
        parameters: RawSignalParameters,
    ): LogicalSignalId {
        val logicalSignalId =
            globalPool.add(
                LogicalSignalDescriptor(signalingSystem, nextSignalingSystems, settings, parameters)
            )
        children.add(logicalSignalId)
        return logicalSignalId
    }

    fun build(): PhysicalSignalDescriptor {
        return PhysicalSignalDescriptor(
            name,
            dirTrackSectionId,
            undirectedTrackOffset,
            children,
            sightDistance
        )
    }
}

private class DetectorBuilder(
    val trackSection: TrackSectionId,
    val offset: Offset<TrackSection>,
    val names: MutableList<String>,
) {
    fun build(): DetectorDescriptor {
        return DetectorDescriptor(trackSection, offset, names.sorted())
    }
}

private class TrackSectionBuilder(
    val name: String,
    val chunks: StaticIdxList<TrackChunk>,
    val detectors: MutableStaticIdxList<Detector> = mutableStaticIdxArrayListOf(),
    val detectorPositions: MutableOffsetList<TrackSection> = mutableOffsetArrayListOf(),
) {
    fun build(): TrackSectionDescriptor {
        return TrackSectionDescriptor(name, chunks, detectors, detectorPositions)
    }
}

class RawInfraFromRjsBuilder {
    private val trackNodePool = StaticPool<TrackNode, TrackNodeDescriptor>()
    private val trackSectionPool = StaticPool<TrackSection, TrackSectionBuilder>()
    private val trackChunkPool = StaticPool<TrackChunk, TrackChunkDescriptor>()
    private val nodeAtEndpoint = IdxMap<EndpointTrackSectionId, TrackNodeId>()
    private val zonePool = StaticPool<Zone, ZoneDescriptorBuilder>()
    private val detectorPool = StaticPool<Detector, DetectorBuilder>()
    private val detectorLocationMap = mutableMapOf<TrackLocation, DetectorId>()
    private val nextZones = IdxMap<DirDetectorId, ZoneId>()
    private val routePool = StaticPool<Route, RouteDescriptor>()
    private val logicalSignalPool = StaticPool<LogicalSignal, LogicalSignalDescriptor>()
    private val physicalSignalPool = StaticPool<PhysicalSignal, PhysicalSignalDescriptor>()
    private val zonePathPool = StaticPool<ZonePath, ZonePathDescriptor>()
    private val zonePathMap = mutableMapOf<ZonePathSpec, ZonePathId>()
    private val operationalPointPartPool =
        StaticPool<OperationalPointPart, OperationalPointPartDescriptor>()

    private val trackSectionNameToIdxMap = mutableMapOf<String, TrackSectionId>()
    private val trackSectionDistanceSortedChunkMap =
        mutableMapOf<TrackSectionId, TreeMap<Distance, TrackChunkId>>()

    fun getTrackSectionByName(name: String): TrackSectionId {
        return trackSectionNameToIdxMap[name]!!
    }

    // TODO remove this accessor once useless in adapter
    fun getTrackSectionDistanceSortedChunkMap():
        Map<TrackSectionId, TreeMap<Distance, TrackChunkId>> {
        return trackSectionDistanceSortedChunkMap
    }

    // TODO remove this accessor once useless in adapter
    fun getTrackNodePool(): StaticPool<TrackNode, TrackNodeDescriptor> {
        return trackNodePool
    }

    fun getTrackNodes(): StaticIdxSpace<TrackNode> {
        return trackNodePool.space()
    }

    fun getNodeAtEndpoint(trackSectionEndpoint: EndpointTrackSectionId): TrackNodeId? {
        return nodeAtEndpoint[trackSectionEndpoint]
    }

    fun getTrackNodePorts(
        trackNodeIdx: TrackNodeId
    ): StaticPool<TrackNodePort, EndpointTrackSectionId> {
        return trackNodePool[trackNodeIdx].ports
    }

    fun getTrackSections(): StaticIdxSpace<TrackSection> {
        return trackSectionPool.space()
    }

    fun getTrackSectionName(trackSectionIdx: TrackSectionId): String {
        return trackSectionPool[trackSectionIdx].name
    }

    private fun getTrackSectionIdx(name: String): TrackSectionId {
        return trackSectionNameToIdxMap[name]
            ?: throw OSRDError.newInfraLoadingError(
                ErrorType.InfraHardLoadingError,
                "Accessing track-section from unregistered name $name"
            )
    }

    private fun getTrackSectionDistanceSortedChunks(name: String): TreeMap<Distance, TrackChunkId> {
        val trackSectionIdx = getTrackSectionIdx(name)
        return trackSectionDistanceSortedChunkMap[trackSectionIdx]
            ?: throw OSRDError.newInfraLoadingError(
                ErrorType.InfraHardLoadingError,
                "Accessing sorted chunks from unregistered track-section idx $trackSectionIdx (name: $name)"
            )
    }

    fun getTrackSectionEndpointIdx(
        trackSectionName: String,
        endpoint: Endpoint
    ): EndpointTrackSectionId {
        return EndpointTrackSectionId(getTrackSectionIdx(trackSectionName), endpoint)
    }

    fun node(
        name: String,
        delay: Duration,
        ports: StaticPool<TrackNodePort, EndpointTrackSectionId>,
        configs: StaticPool<TrackNodeConfig, TrackNodeConfigDescriptor>
    ): TrackNodeId {
        val nodeIdx = trackNodePool.add(TrackNodeDescriptor(name, delay, ports, configs))
        for (portIdx in ports) {
            val port = ports[portIdx]
            assert(nodeAtEndpoint[port] == null) {
                "Assertion failed: endpoint ${trackSectionPool[port.value].name}.${port.endpoint} is referenced multiple times by a node port"
            }
            nodeAtEndpoint[port] = nodeIdx
        }
        return nodeIdx
    }

    fun detector(
        trackSection: TrackSectionId,
        offset: Offset<TrackSection>,
        names: List<String>
    ): DetectorId {
        val location = TrackLocation(trackSection, offset)
        val detectorId = detectorLocationMap[location]
        // if the detector already exists, register the name
        if (detectorId != null) {
            val detectorBuilder = detectorPool[detectorId]
            detectorBuilder.names.addAll(names)
            return detectorId
        }

        // if not, create it and return the existing ID
        val newDetId =
            detectorPool.add(DetectorBuilder(trackSection, offset, names.toMutableList()))
        val trackSectionDescriptor = trackSectionPool[trackSection]
        trackSectionDescriptor.detectors.add(newDetId)
        trackSectionDescriptor.detectorPositions.add(offset)
        detectorLocationMap[location] = newDetId
        return newDetId
    }

    fun getTrackSectionDetectors(trackSection: TrackSectionId): StaticIdxList<Detector> {
        return trackSectionPool[trackSection].detectors
    }

    fun linkZones(detector: DetectorId, zoneA: ZoneId, zoneB: ZoneId) {
        nextZones[detector.increasing] = zoneA
        nextZones[detector.decreasing] = zoneB
    }

    fun zone(movableElements: List<TrackNodeId>): ZoneId {
        val nodes = mutableStaticIdxArraySetOf<TrackNode>()
        nodes.addAll(movableElements)
        return zonePool.add(ZoneDescriptorBuilder(nodes))
    }

    fun zoneAddNode(zone: ZoneId, node: TrackNodeId) {
        zonePool[zone].movableElements.add(node)
    }

    fun setNextZone(detector: DirDetectorId, zone: ZoneId) {
        nextZones[detector] = zone
    }

    fun zonePath(
        entry: DirDetectorId,
        exit: DirDetectorId,
        init: ZonePathBuilder.() -> Unit
    ): ZonePathId {
        val builder = ZonePathBuilderImpl(entry, exit)
        builder.init()
        val zonePathDesc = builder.build()
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    fun zonePath(
        entry: DirDetectorId,
        exit: DirDetectorId,
        movableElements: StaticIdxList<TrackNode>,
        movableElementsConfigs: StaticIdxList<TrackNodeConfig>,
        movableElementsDistances: OffsetList<ZonePath>,
        chunks: DirStaticIdxList<TrackChunk>,
    ): ZonePathId {
        val zonePathDesc =
            ZonePathDescriptor(
                entry,
                exit,
                movableElements,
                movableElementsConfigs,
                movableElementsDistances,
                chunks
            )
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    fun zonePath(entry: DirDetectorId, exit: DirDetectorId): ZonePathId {
        val builder = ZonePathBuilderImpl(entry, exit)
        val zonePathDesc = builder.build()
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    fun route(name: String?, init: RouteBuilder.() -> Unit): RouteId {
        val builder = RouteBuilderImpl(name)
        builder.init()
        return routePool.add(builder.build())
    }

    fun physicalSignal(
        name: String?,
        sightDistance: Distance,
        dirTrackSectionId: DirTrackSectionId,
        undirectedTrackOffset: Offset<TrackSection>,
        init: PhysicalSignalBuilder.() -> Unit
    ): PhysicalSignalId {
        val builder =
            PhysicalSignalBuilderImpl(
                name,
                sightDistance,
                dirTrackSectionId,
                undirectedTrackOffset,
                logicalSignalPool
            )
        builder.init()
        return physicalSignalPool.add(builder.build())
    }

    fun trackSection(name: String, chunks: StaticIdxList<TrackChunk>): TrackSectionId {
        val trackSectionBuilder = TrackSectionBuilder(name, chunks)
        val trackSectionIdx = trackSectionPool.add(trackSectionBuilder)

        trackSectionNameToIdxMap[name] = trackSectionIdx

        val trackSectionOffsetChunks = TreeMap<Distance, TrackChunkId>()
        for (chunkIdx in chunks) {
            val chunk = trackChunkPool[chunkIdx]
            chunk.track = trackSectionIdx
            trackSectionOffsetChunks[chunk.offset.distance] = chunkIdx
        }
        trackSectionDistanceSortedChunkMap[trackSectionIdx] = trackSectionOffsetChunks
        return trackSectionIdx
    }

    fun trackChunk(
        geo: LineString,
        slopes: DirectionalMap<DistanceRangeMap<Double>>,
        curves: DirectionalMap<DistanceRangeMap<Double>>,
        gradients: DirectionalMap<DistanceRangeMap<Double>>,
        length: Length<TrackChunk>,
        offset: Offset<TrackSection>,
        loadingGaugeConstraints: DistanceRangeMap<LoadingGaugeConstraint>
    ): TrackChunkId {
        return trackChunkPool.add(
            TrackChunkDescriptor(
                geo,
                slopes,
                curves,
                gradients,
                length,
                // Route IDs will be filled later on, routes are not initialized yet
                DirectionalMap(MutableStaticIdxArrayList(), MutableStaticIdxArrayList()),
                // The track ID will be filled later, track is not initialized yet
                StaticIdx(0u),
                offset,
                // OperationalPointPart IDs will be filled later on, operational point parts
                // are not initialized yet
                MutableStaticIdxArrayList(),
                loadingGaugeConstraints,
                // Electrifications will be filled later on
                distanceRangeMapOf(
                    listOf(DistanceRangeMap.RangeMapEntry(0.meters, length.distance, ""))
                ),
                // NeutralSections will be filled later on
                DirectionalMap(distanceRangeMapOf(), distanceRangeMapOf()),
                // SpeedSections will be filled later on
                DirectionalMap(
                    distanceRangeMapOf(
                        listOf(
                            DistanceRangeMap.RangeMapEntry(
                                0.meters,
                                length.distance,
                                SpeedSection(Double.POSITIVE_INFINITY.metersPerSecond, mapOf())
                            )
                        )
                    ),
                    distanceRangeMapOf(
                        listOf(
                            DistanceRangeMap.RangeMapEntry(
                                0.meters,
                                length.distance,
                                SpeedSection(Double.POSITIVE_INFINITY.metersPerSecond, mapOf())
                            )
                        )
                    )
                )
            )
        )
    }

    fun applyFunctionToTrackSectionChunksBetween(
        trackSectionName: String,
        lower: Distance,
        upper: Distance,
        function:
            (
                chunkDescriptor: TrackChunkDescriptor,
                incomingRangeLowerBound: Distance,
                incomingRangeUpperBound: Distance
            ) -> Unit
    ) {
        val trackSectionChunks = getTrackSectionDistanceSortedChunks(trackSectionName)
        for (chunkDistanceId in trackSectionChunks.tailMap(trackSectionChunks.floorKey(lower))) {
            if (chunkDistanceId.key >= upper) break

            val chunkDescriptor = trackChunkPool[chunkDistanceId.value]
            val incomingRangeLowerBound = Distance.max(lower - chunkDistanceId.key, 0.meters)
            val incomingRangeUpperBound =
                Distance.min(upper - chunkDistanceId.key, chunkDescriptor.length.distance)

            function(chunkDescriptor, incomingRangeLowerBound, incomingRangeUpperBound)
        }
    }

    fun operationalPointPart(
        operationalPointName: String,
        trackSectionName: String,
        trackSectionOffset: Offset<TrackSection>
    ): OperationalPointPartId {
        val trackSectionChunks = getTrackSectionDistanceSortedChunks(trackSectionName)
        val chunkDistanceIdx = trackSectionChunks.floorEntry(trackSectionOffset.distance)
        val opPartIdx =
            operationalPointPartPool.add(
                OperationalPointPartDescriptor(
                    operationalPointName,
                    Offset(trackSectionOffset.distance - chunkDistanceIdx.key),
                    chunkDistanceIdx.value
                )
            )
        val oppList =
            trackChunkPool[chunkDistanceIdx.value].operationalPointParts
                as MutableStaticIdxArrayList
        oppList.add(opPartIdx)
        return opPartIdx
    }

    fun build(): RawInfra {
        resolveReferences()
        return RawInfraImplFromRjs(
            trackNodePool,
            trackSectionPool.map { it.build() },
            trackChunkPool,
            nodeAtEndpoint,
            zonePool.map { ZoneDescriptor(it.movableElements) },
            detectorPool.map { it.build() },
            nextZones,
            routePool,
            logicalSignalPool,
            physicalSignalPool,
            zonePathPool,
            zonePathMap,
            operationalPointPartPool,
            makeTrackNameMap(),
            makeRouteNameMap(),
            makeDetEntryToRouteMap(),
            makeDetExitToRouteMap(),
        )
    }

    /** Create the mapping from each dir detector to routes that start there */
    private fun makeDetEntryToRouteMap(): Map<DirStaticIdx<Detector>, StaticIdxList<Route>> {
        val res = HashMap<DirStaticIdx<Detector>, MutableStaticIdxArrayList<Route>>()
        for (routeId in routePool) {
            val firstZonePath = routePool[routeId].path.first()
            val entry = zonePathPool[firstZonePath].entry
            res.computeIfAbsent(entry) { mutableStaticIdxArrayListOf() }.add(routeId)
        }
        return res
    }

    /** Create the mapping from each dir detector to routes that end there */
    private fun makeDetExitToRouteMap(): Map<DirStaticIdx<Detector>, StaticIdxList<Route>> {
        val res = HashMap<DirStaticIdx<Detector>, MutableStaticIdxArrayList<Route>>()
        for (routeId in routePool) {
            val lastZonePath = routePool[routeId].path.last()
            val exit = zonePathPool[lastZonePath].exit
            res.computeIfAbsent(exit) { mutableStaticIdxArrayListOf() }.add(routeId)
        }
        return res
    }

    /** Create the mapping from track name to id */
    private fun makeTrackNameMap(): Map<String, TrackSectionId> {
        val res = HashMap<String, TrackSectionId>()
        for (trackId in trackSectionPool) res[trackSectionPool[trackId].name] = trackId
        return res
    }

    /** Create the mapping from route name to id */
    private fun makeRouteNameMap(): Map<String, RouteId> {
        val res = HashMap<String, RouteId>()
        for (routeId in routePool) {
            val routeName = routePool[routeId].name
            if (res[routePool[routeId].name!!] != null)
                throw OSRDError.newDuplicateRouteError(routeName)
            else if (routeName != null) res[routePool[routeId].name!!] = routeId
        }
        return res
    }

    /**
     * Some objects have cross-reference (such as routes and chunks, or track sections and chunks).
     * This method needs to be called to set the references that couldn't be set during
     * initialization.
     */
    private fun resolveReferences() {
        // Resolve route references
        for (route in routePool) {
            val chunkListOnRoute = routePool[route].chunks as MutableDirStaticIdxArrayList
            var routeLength = Distance.ZERO
            for (zonePath in routePool[route].path) {
                for (dirChunk in zonePathPool[zonePath].chunks) {
                    val chunk = dirChunk.value
                    val chunkDescriptor = trackChunkPool[chunk]
                    val dir = dirChunk.direction
                    val routeList = chunkDescriptor.routes.get(dir) as MutableStaticIdxArrayList
                    routeList.add(route)
                    chunkListOnRoute.add(dirChunk)
                    routeLength += chunkDescriptor.length.distance
                }
            }
            routePool[route].length = Length(routeLength)
        }
    }
}

inline fun rawInfraFromRjs(init: RawInfraFromRjsBuilder.() -> Unit): RawInfra {
    val infraBuilder = RawInfraFromRjsBuilder()
    infraBuilder.init()
    return infraBuilder.build()
}
