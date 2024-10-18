package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.fast_collections.mutableIntArrayListOf
import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*
import java.util.*
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

class RouteBuilderImpl(private val name: String) : RouteBuilder {
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
    val chunkBoundaryIndex: Int,
    val names: MutableList<String>,
) {
    fun build(): DetectorDescriptor {
        return DetectorDescriptor(trackSection, chunkBoundaryIndex, names.sorted())
    }
}

private class TrackSectionBuilder(
    val name: String,
    val chunks: StaticIdxList<TrackChunk>,
    val detectors: MutableStaticIdxList<Detector> = mutableStaticIdxArrayListOf(),
    // a lookup table which acts as a reverse index for detectorBoundary: for a given chunk
    // boundary, find the associated detector
    val chunkBoundaryToDetector: MutableList<DetectorId?>,
) {
    fun build(): TrackSectionDescriptor {
        return TrackSectionDescriptor(name, chunks, detectors)
    }
}

class RawInfraBuilder {
    private val trackNodePool = StaticPool<TrackNode, TrackNodeDescriptor>()
    private val trackSectionPool = StaticPool<TrackSection, TrackSectionBuilder>()
    private val trackChunkPool = StaticPool<TrackChunk, TrackChunkDescriptor>()
    private val nodeAtEndpoint = IdxMap<EndpointTrackSectionId, TrackNodeId>()
    private val zonePool = StaticPool<Zone, ZoneDescriptorBuilder>()
    private val detectorPool = StaticPool<Detector, DetectorBuilder>()
    private val detectorLocationMap = mutableMapOf<DetectorLocation, DetectorId>()
    private val nextZones = IdxMap<DirDetectorId, ZoneId>()
    private val routePool = StaticPool<Route, RouteDescriptor>()
    private val logicalSignalPool = StaticPool<LogicalSignal, LogicalSignalDescriptor>()
    private val physicalSignalPool = StaticPool<PhysicalSignal, PhysicalSignalDescriptor>()
    private val zonePathPool = StaticPool<ZonePath, ZonePathDescriptor>()
    private val zonePathMap = mutableMapOf<ZonePathSpec, ZonePathId>()
    private val operationalPointPartPool =
        StaticPool<OperationalPointPart, OperationalPointPartDescriptor>()
    private val speedLimitTagPool = mutableMapOf<String, SpeedLimitTagDescriptor>()

    private val trackSectionNameToIdxMap = mutableMapOf<String, TrackSectionId>()
    private val routeNameToIdxMap = mutableMapOf<String, RouteId>()
    private val detectorNameToIdxMap = mutableMapOf<String, DetectorId>()
    private val nodeNameToIdxMap = mutableMapOf<String, TrackNodeId>()
    private val trackSectionDistanceSortedChunkMap =
        mutableMapOf<TrackSectionId, TreeMap<Distance, TrackChunkId>>()

    fun getTrackSectionByName(name: String): TrackSectionId? {
        return trackSectionNameToIdxMap[name]
    }

    fun getRouteByName(name: String): RouteId? {
        return routeNameToIdxMap[name]
    }

    fun getDetectorByName(name: String): DetectorId? {
        return detectorNameToIdxMap[name]
    }

    fun getTrackNodeByName(name: String): TrackNodeId? {
        return nodeNameToIdxMap[name]
    }

    fun getTrackNodeConfigByName(nodeId: TrackNodeId, configName: String): TrackNodeConfigId? {
        val nodeDescriptor = trackNodePool[nodeId]
        val nodeConfigs = nodeDescriptor.configs
        for (nodeConfig in nodeConfigs) {
            if (nodeConfigs[nodeConfig].name == configName) return nodeConfig
        }
        return null
    }

    fun getTrackNodeConfigs(nodeId: TrackNodeId): StaticIdxSpace<TrackNodeConfig> {
        val nodeDescriptor = trackNodePool[nodeId]
        return nodeDescriptor.configs.space()
    }

    fun getDetectorTrackSection(detectorId: DetectorId): TrackSectionId {
        return detectorPool[detectorId].trackSection
    }

    fun getDetectorChunkBoundary(detectorId: DetectorId): Int {
        return detectorPool[detectorId].chunkBoundaryIndex
    }

    fun getChunkBoundaryDetector(
        trackSection: TrackSectionId,
        chunkBoundaryIndex: Int
    ): DetectorId? {
        return trackSectionPool[trackSection].chunkBoundaryToDetector[chunkBoundaryIndex]
    }

    fun getTrackNodes(): StaticIdxSpace<TrackNode> {
        return trackNodePool.space()
    }

    fun getNodeAtEndpoint(trackSectionEndpoint: EndpointTrackSectionId): TrackNodeId? {
        return nodeAtEndpoint[trackSectionEndpoint]
    }

    fun getNextTrackSection(
        curTrack: DirTrackSectionId,
        config: TrackNodeConfigId
    ): DirTrackSectionId? {
        val nextNode = getNodeAtEndpoint(curTrack.toEndpoint) ?: return null
        val nodeDescriptor = trackNodePool[nextNode]
        val entryPort = nodeDescriptor.getPort(curTrack.toEndpoint).orNull!!
        val exitPort = nodeDescriptor.getTrackNodeExitPort(config, entryPort)
        if (exitPort.isNone) return null
        val nextEndpoint = nodeDescriptor.ports[exitPort.asIndex()]
        return DirTrackSectionId(nextEndpoint.value, nextEndpoint.endpoint.directionAway)
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
            ?: throw OSRDError.newInfraError("Accessing track-section from unregistered name $name")
    }

    private fun getTrackSectionDistanceSortedChunks(name: String): TreeMap<Distance, TrackChunkId> {
        val trackSectionIdx = getTrackSectionIdx(name)
        return trackSectionDistanceSortedChunkMap[trackSectionIdx]
            ?: throw OSRDError.newInfraError(
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
        nodeNameToIdxMap[name] = nodeIdx
        return nodeIdx
    }

    data class DetectorLocation(val trackSection: TrackSectionId, val chunkBoundaryIndex: Int)

    fun detector(
        names: List<String>,
        trackSection: TrackSectionId,
        chunkBoundaryIndex: Int,
    ): DetectorId {
        val location = DetectorLocation(trackSection, chunkBoundaryIndex)
        val detectorId = detectorLocationMap[location]
        // if the detector already exists, register the name
        if (detectorId != null) {
            val detectorBuilder = detectorPool[detectorId]
            detectorBuilder.names.addAll(names)
            for (name in names) detectorNameToIdxMap[name] = detectorId
            return detectorId
        }

        // if not, create it and return the existing ID
        val newDetId =
            detectorPool.add(
                DetectorBuilder(trackSection, chunkBoundaryIndex, names.toMutableList())
            )
        for (name in names) detectorNameToIdxMap[name] = newDetId
        val trackSectionDescriptor = trackSectionPool[trackSection]
        trackSectionDescriptor.detectors.add(newDetId)
        trackSectionDescriptor.chunkBoundaryToDetector[chunkBoundaryIndex] = newDetId
        detectorLocationMap[location] = newDetId
        return newDetId
    }

    fun getTrackSectionDetectors(trackSection: TrackSectionId): StaticIdxList<Detector> {
        return trackSectionPool[trackSection].detectors
    }

    fun getTrackSectionChunks(trackSection: TrackSectionId): StaticIdxList<TrackChunk> {
        return trackSectionPool[trackSection].chunks
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

    fun route(name: String, init: RouteBuilder.() -> Unit): RouteId {
        val builder = RouteBuilderImpl(name)
        builder.init()
        val routeIdx = routePool.add(builder.build())
        routeNameToIdxMap[name] = routeIdx
        return routeIdx
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

    fun speedLimitTag(tagId: String, tagDescriptor: SpeedLimitTagDescriptor) {
        speedLimitTagPool[tagId] = tagDescriptor
    }

    fun trackSection(name: String, chunks: StaticIdxList<TrackChunk>): TrackSectionId {
        val chunkBoundaryToDetector = MutableList<DetectorId?>(chunks.size + 1) { null }
        val detectors = mutableStaticIdxArrayListOf<Detector>()
        val trackSectionBuilder =
            TrackSectionBuilder(name, chunks, detectors, chunkBoundaryToDetector)
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
        val initSpeedSections = {
            distanceRangeMapOf(
                listOf(
                    DistanceRangeMap.RangeMapEntry(
                        0.meters,
                        length.distance,
                        SpeedSection(Double.POSITIVE_INFINITY.metersPerSecond, mapOf(), mapOf())
                    )
                )
            )
        }

        return trackChunkPool.add(
            TrackChunkDescriptor(
                // TrackSection ID will be filled later, track is not initialized yet
                StaticIdx(0u),
                offset,
                length,
                geo,
                slopes,
                curves,
                gradients,
                // Route IDs will be filled later on, routes are not initialized yet
                DirectionalMap(MutableStaticIdxArrayList(), MutableStaticIdxArrayList()),
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
                // SpeedSections will be filled later on,
                DirectionalMap(initSpeedSections(), initSpeedSections())
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
        operationalPointId: String,
        trackSectionName: String,
        trackSectionOffset: Offset<TrackSection>,
        props: Map<String, String>
    ): OperationalPointPartId? {
        if (!trackSectionNameToIdxMap.contains(trackSectionName)) {
            return null
        }
        val trackSectionChunks = getTrackSectionDistanceSortedChunks(trackSectionName)
        val chunkDistanceIdx = trackSectionChunks.floorEntry(trackSectionOffset.distance)
        val opPartIdx =
            operationalPointPartPool.add(
                OperationalPointPartDescriptor(
                    operationalPointId,
                    Offset(trackSectionOffset.distance - chunkDistanceIdx.key),
                    chunkDistanceIdx.value,
                    props
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
        return RawInfraImpl(
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
            speedLimitTagPool,
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
            if (res[routePool[routeId].name] != null)
                throw OSRDError.newDuplicateRouteError(routeName)
            res[routePool[routeId].name] = routeId
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

    fun getChunkLength(chunk: TrackChunkId): Length<TrackChunk> {
        return trackChunkPool[chunk].length
    }
}

@Throws(BuildRouteError::class)
fun RawInfraBuilder.route(
    routeName: String,
    routeEntry: DirDetectorId,
    exit: DetectorId,
    nodeConfigs: Map<TrackNodeId, TrackNodeConfigId>,
    releaseDetectors: StaticIdxSortedSet<Detector>,
): RouteId {
    // the route rebuild algorithm iterates over chunks. When a detector is met, it creates a new
    // zonePath. when a node is met, the next track section is looked up using nodeConfigs. when
    // the exit detector is met, the algorithm completes.
    return this.route(routeName) routeBuilder@{
        // this builder keeps track of the content of each zone path, adds the zone paths to the
        // route along the way, and checks for release detectors.
        val zonePathBuilder =
            RouteZonePathBuilder(this@route, this@routeBuilder, routeEntry, releaseDetectors)

        // curTrack and curChunkBoundary encode the current position within the route
        // curChunkBoundary is the index of a chunk boundary: if there are 2 chunks, there are 3
        // boundaries, which delimit chunks. at any chunk boundary, there may be a detector.
        var curTrack = getDetectorTrackSection(routeEntry.value).withDirection(routeEntry.direction)
        var curChunkBoundary = getDetectorChunkBoundary(routeEntry.value)
        // this is a cache that should be updated whenever curTrack changes
        var curTrackChunks = getTrackSectionChunks(curTrack.value)

        // for each track section
        trackSectionLoop@ while (true) {
            // iterate along the current direction, adding chunks along the way
            // stop when the end of the track section or the end detector is reached
            val trackLastChunkBoundary =
                when (curTrack.direction) {
                    Direction.INCREASING -> curTrackChunks.size
                    Direction.DECREASING -> 0
                }

            chunkLoop@ while (true) {
                // is there a detector at the current chunk boundary?
                val curDetector = getChunkBoundaryDetector(curTrack.value, curChunkBoundary)
                if (curDetector != null) {
                    zonePathBuilder.addDetector(curDetector.withDirection(curTrack.direction))
                    if (curDetector == exit) {
                        break@trackSectionLoop
                    }
                }

                // if we reached the end of the track section, get to the next one
                if (curChunkBoundary == trackLastChunkBoundary) break@chunkLoop

                // get to the next track chunk boundary, adding the chunk in the process
                val nextChunkBoundary = curChunkBoundary + curTrack.direction.sign
                val curChunk =
                    when (curTrack.direction) {
                        Direction.INCREASING -> curTrackChunks[curChunkBoundary]
                        Direction.DECREASING -> curTrackChunks[nextChunkBoundary]
                    }
                val trackDir = curTrack.direction
                zonePathBuilder.addChunk(curChunk.withDirection(trackDir))
                curChunkBoundary = nextChunkBoundary
            }

            // find the next track section
            val endpoint = curTrack.toEndpoint
            val nextNode = getNodeAtEndpoint(endpoint) ?: throw ReachedTrackDeadEnd(endpoint)
            val nextNodeConfigs = getTrackNodeConfigs(nextNode)
            val nextNodeConfig =
                if (nextNodeConfigs.size == 1u) {
                    // Check if we have a one config node
                    nextNodeConfigs[0]
                } else {
                    // Lookup the node config using route description
                    nodeConfigs[nextNode] ?: throw MissingNodeConfig(nextNode)
                }
            zonePathBuilder.addNode(nextNode, nextNodeConfig)
            curTrack =
                getNextTrackSection(curTrack, nextNodeConfig)
                    ?: throw ReachedNodeDeadEnd(curTrack, nextNodeConfig)
            curTrackChunks = getTrackSectionChunks(curTrack.value)
            curChunkBoundary =
                when (curTrack.direction) {
                    Direction.INCREASING -> 0
                    Direction.DECREASING -> curTrackChunks.size
                }
        }

        // ensure the last zone is a release zone
        zonePathBuilder.finalizeRoute()
    }
}

sealed class BuildRouteError : Throwable()

data class MissingNodeConfig(val trackNode: TrackNodeId) : BuildRouteError()

data class ReachedTrackDeadEnd(val trackEndpoint: EndpointTrackSectionId) : BuildRouteError()

data class ReachedNodeDeadEnd(
    val dirTrackSection: DirTrackSectionId,
    val nodeConfig: TrackNodeConfigId
) : BuildRouteError()

class RouteZonePathBuilder(
    private val infraBuilder: RawInfraBuilder,
    private val routeBuilder: RouteBuilder,
    routeEntry: DirDetectorId,
    private val releaseDetectors: StaticIdxSortedSet<Detector>
) {
    // the state of the zone path currently being built
    private var zonePathCount = 0
    private var zonePathLength = Offset<ZonePath>(0.meters)
    private var zonePathEntry = routeEntry
    private val zonePathNodes = MutableStaticIdxArrayList<TrackNode>()
    private val zonePathNodeConfigs = MutableStaticIdxArrayList<TrackNodeConfig>()
    private val zonePathNodeOffsets = MutableOffsetArrayList<ZonePath>()
    private val zonePathChunks = MutableDirStaticIdxArrayList<TrackChunk>()

    fun addChunk(chunk: DirTrackChunkId) {
        zonePathChunks.add(chunk)
        zonePathLength += infraBuilder.getChunkLength(chunk.value).distance
    }

    fun addNode(node: TrackNodeId, config: TrackNodeConfigId) {
        zonePathNodes.add(node)
        zonePathNodeConfigs.add(config)
        zonePathNodeOffsets.add(zonePathLength)
    }

    private var lastReleasedZone = -1

    fun addDetector(newDetector: DirDetectorId) {
        // ignore the entry detector
        if (zonePathChunks.size == 0) {
            return
        }

        // create the zone path, update pending zone path state
        routeBuilder.zonePath(
            infraBuilder.zonePath(
                zonePathEntry,
                newDetector,
                zonePathNodes.clone(),
                zonePathNodeConfigs.clone(),
                zonePathNodeOffsets.clone(),
                zonePathChunks.clone()
            )
        )
        zonePathCount++
        zonePathLength = Offset(0.meters)
        zonePathEntry = newDetector
        zonePathNodes.clear()
        zonePathNodeConfigs.clear()
        zonePathNodeOffsets.clear()
        zonePathChunks.clear()

        // check whether this detector triggers a zone release
        if (releaseDetectors.contains(newDetector.value)) {
            val zoneIndex = zonePathCount - 1
            assert(zoneIndex >= 0)
            routeBuilder.releaseZone(zoneIndex)
            lastReleasedZone = zoneIndex
        }
    }

    fun finalizeRoute() {
        if (lastReleasedZone != zonePathCount - 1) {
            routeBuilder.releaseZone(zonePathCount - 1)
        }
    }
}
