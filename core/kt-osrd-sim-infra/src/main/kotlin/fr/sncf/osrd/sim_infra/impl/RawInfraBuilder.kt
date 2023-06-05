package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.railjson.schema.geom.LineString
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.DirectionalMap
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*
import kotlin.time.Duration


interface MovableElementDescriptorBuilder {
    fun port(endpoint: EndpointTrackSectionId): TrackNodePortId
    fun config(name: String, portLink: Pair<TrackNodePortId, TrackNodePortId>): TrackNodeConfigId
}

class MovableElementDescriptorBuilderImpl(
    private val delay: Duration,
    private val ports: StaticPool<TrackNodePort, EndpointTrackSectionId>,
    private val configs: StaticPool<TrackNodeConfig, MovableElementConfigDescriptor>,
) : MovableElementDescriptorBuilder {
    override fun port(endpoint: EndpointTrackSectionId): TrackNodePortId {
        return ports.add(endpoint)
    }

    override fun config(name: String, portLink: Pair<TrackNodePortId, TrackNodePortId>): TrackNodeConfigId {
        return configs.add(MovableElementConfigDescriptor(name, portLink))
    }

    fun build(): MovableElementDescriptor {
        return MovableElementDescriptor(delay, ports, configs)
    }
}

interface PhysicalSignalBuilder {
    fun logicalSignal(
        signalingSystem: String,
        nextSignalingSystems: List<String>,
        settings: Map<String, String>
    ): LogicalSignalId
}

class PhysicalSignalBuilderImpl(
    private val name: String?,
    private val sightDistance: Distance,
    private val globalPool: StaticPool<LogicalSignal, LogicalSignalDescriptor>,
) : PhysicalSignalBuilder {
    private val children: MutableStaticIdxList<LogicalSignal> = MutableStaticIdxArrayList()

    override fun logicalSignal(
        signalingSystem: String,
        nextSignalingSystems: List<String>,
        settings: Map<String, String>
    ): LogicalSignalId {
        val logicalSignalId = globalPool.add(LogicalSignalDescriptor(signalingSystem, nextSignalingSystems, settings))
        children.add(logicalSignalId)
        return logicalSignalId
    }

    fun build(): PhysicalSignalDescriptor {
        return PhysicalSignalDescriptor(name, children, sightDistance)
    }
}


interface ZonePathBuilder {
    fun movableElement(movableElement: TrackNodeId, config: TrackNodeConfigId, zonePathOffset: Distance)
    fun signal(signal: PhysicalSignalId, position: Distance)
}

class ZonePathBuilderImpl(val entry: DirDetectorId, val exit: DirDetectorId, val length: Distance) : ZonePathBuilder {
    private val movableElements = MutableStaticIdxArrayList<TrackNode>()
    private val movableElementsConfigs = MutableStaticIdxArrayList<TrackNodeConfig>()
    private val movableElementsDistances = MutableDistanceArrayList()
    private val signals = MutableStaticIdxArrayList<PhysicalSignal>()
    private val signalPositions = MutableDistanceArrayList()


    override fun movableElement(
        movableElement: TrackNodeId,
        config: TrackNodeConfigId,
        zonePathOffset: Distance
    ) {
        movableElements.add(movableElement)
        movableElementsConfigs.add(config)
        movableElementsDistances.add(zonePathOffset)
    }

    override fun signal(signal: PhysicalSignalId, position: Distance) {
        signals.add(signal)
        signalPositions.add(position)
    }

    fun build(): ZonePathDescriptor {
        return ZonePathDescriptor(
            entry, exit, length,
            movableElements,
            movableElementsConfigs,
            movableElementsDistances,
            signals,
            signalPositions,
            MutableDirStaticIdxArrayList()
        )
    }
}

interface RouteBuilder {
    fun zonePath(zonePath: StaticIdx<ZonePath>)
    fun releaseZone(index: Int)
    fun speedLimit(limit: SpeedLimitId, start: Distance, end: Distance)
    fun trackChunk(chunkId: DirTrackChunkId)
}

class RouteBuilderImpl(private val name: String?) : RouteBuilder {
    private val path: MutableStaticIdxList<ZonePath> = mutableStaticIdxArrayListOf()
    private val releaseZones: MutableList<Int> = mutableListOf()
    private val speedLimits: MutableStaticIdxList<SpeedLimit> = mutableStaticIdxArrayListOf()
    private val speedLimitStarts: MutableDistanceList = mutableDistanceArrayListOf()
    private val speedLimitEnds: MutableDistanceList = mutableDistanceArrayListOf()
    private val chunks: MutableDirStaticIdxArrayList<TrackChunk> = MutableDirStaticIdxArrayList()

    override fun zonePath(zonePath: StaticIdx<ZonePath>) {
        path.add(zonePath)
    }

    override fun releaseZone(index: Int) {
        assert(releaseZones.isEmpty() || releaseZones.last() < index)
        releaseZones.add(index)
    }

    override fun speedLimit(limit: SpeedLimitId, start: Distance, end: Distance) {
        speedLimits.add(limit)
        speedLimitStarts.add(start)
        speedLimitEnds.add(end)
    }

    override fun trackChunk(chunkId: DirTrackChunkId) {
        chunks.add(chunkId)
    }

    fun build(): RouteDescriptorImpl {
        return RouteDescriptorImpl(
            name,
            path,
            releaseZones.toIntArray(),
            speedLimits,
            speedLimitStarts,
            speedLimitEnds,
            chunks
        )
    }
}

class RouteDescriptorImpl(
    override val name: String?,
    override val path: StaticIdxList<ZonePath>,
    override val releaseZones: IntArray,
    override val speedLimits: StaticIdxList<SpeedLimit>,
    override val speedLimitStarts: DistanceList,
    override val speedLimitEnds: DistanceList,
    override val chunks: DirStaticIdxList<TrackChunk>,
) : RouteDescriptor

interface RestrictedRawInfraBuilder {
    fun movableElement(delay: Duration, init: MovableElementDescriptorBuilder.() -> Unit): TrackNodeId
    fun detector(name: String?): DetectorId
    fun linkZones(zoneA: ZoneId, zoneB: ZoneId): DetectorId
    fun linkZones(detector: DetectorId, zoneA: ZoneId, zoneB: ZoneId)
    fun setNextZone(detector: DirDetectorId, zone: ZoneId)
    // The 3 "zone" methods are outdated because we can compute zones using track topology. They should be removed once
    // the rjs parsing has been migrated and the legacy infra isn't used as an intermediate step anymore
    fun zone(movableElements: StaticIdxSortedSet<TrackNode>): ZoneId
    fun zone(movableElements: List<TrackNodeId>): ZoneId
    fun zone(movableElements: StaticIdxSortedSet<TrackNode>, bounds: List<DirDetectorId>): ZoneId
    fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Distance, init: ZonePathBuilder.() -> Unit): ZonePathId
    fun zonePath(
        entry: DirDetectorId, exit: DirDetectorId,
        length: Distance,
        movableElements: StaticIdxList<TrackNode>,
        movableElementsConfigs: StaticIdxList<TrackNodeConfig>,
        movableElementsDistances: DistanceList,
        signals: StaticIdxList<PhysicalSignal>,
        signalPositions: DistanceList,
        chunks: DirStaticIdxList<TrackChunk>,
    ): ZonePathId
    fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Distance): ZonePathId
    fun route(name: String?, init: RouteBuilder.() -> Unit): RouteId
    fun physicalSignal(name: String?, sightDistance: Distance, init: PhysicalSignalBuilder.() -> Unit): PhysicalSignalId
    fun trackSection(name: String?, init: TrackSectionBuilder.() -> Unit): TrackSectionId
    fun trackChunk(
        geo: LineString,
        slopes: DirectionalMap<DistanceRangeMap<Double>>,
        length: Distance,
        offset: Distance
    ): TrackChunkId
    fun operationalPoint(name: String, chunkOffset: Distance, chunk: TrackChunkId): OperationalPointId
}

interface TrackSectionBuilder {
    fun detector(detector: StaticIdx<Detector>)
    fun chunk(chunk: StaticIdx<TrackChunk>)
}
class TrackSectionBuilderImpl(private val name: String?) : TrackSectionBuilder {
    private val detectors: MutableStaticIdxList<Detector> = mutableStaticIdxArrayListOf()
    private val chunks: MutableStaticIdxList<TrackChunk> = mutableStaticIdxArrayListOf()

    override fun detector(detector: StaticIdx<Detector>) {
        detectors.add(detector)
    }

    override fun chunk(chunk: StaticIdx<TrackChunk>) {
        chunks.add(chunk)
    }

    fun build(): TrackSectionDescriptor {
        return TrackSectionDescriptor(
            name!!,
            chunks
        )
    }
}

interface RawInfraBuilder : RestrictedRawInfraBuilder {
    fun build(): RawInfra
}

class RawInfraBuilderImpl : RawInfraBuilder {
    private val trackNodePool = StaticPool<TrackNode, MovableElementDescriptor>()
    private val trackSectionPool = StaticPool<TrackSection, TrackSectionDescriptor>()
    private val trackChunkPool = StaticPool<TrackChunk, TrackChunkDescriptor>()
    private val nextNode = IdxMap<DirTrackSectionId, TrackNodeId>()
    private val zonePool = StaticPool<Zone, ZoneDescriptor>()
    private val detectorPool = StaticPool<Detector, String?>()
    private val nextZones = IdxMap<DirDetectorId, ZoneId>()
    private val routePool = StaticPool<Route, RouteDescriptor>()
    private val logicalSignalPool = StaticPool<LogicalSignal, LogicalSignalDescriptor>()
    private val physicalSignalPool = StaticPool<PhysicalSignal, PhysicalSignalDescriptor>()
    private val zonePathPool = StaticPool<ZonePath, ZonePathDescriptor>()
    private val zonePathMap = mutableMapOf<ZonePathSpec, ZonePathId>()
    private val operationalPointPool = StaticPool<OperationalPoint, OperationalPointDescriptor>()

    override fun movableElement(delay: Duration, init: MovableElementDescriptorBuilder.() -> Unit): TrackNodeId {
        val movableElementBuilder = MovableElementDescriptorBuilderImpl(delay, StaticPool(), StaticPool())
        movableElementBuilder.init()
        val movableElement = movableElementBuilder.build()
        return trackNodePool.add(movableElement)
    }

    override fun detector(name: String?): DetectorId {
        return detectorPool.add(name)
    }

    override fun linkZones(zoneA: ZoneId, zoneB: ZoneId): DetectorId {
        val det = detector(null)
        linkZones(det, zoneA, zoneB)
        return det
    }

    override fun linkZones(detector: DetectorId, zoneA: ZoneId, zoneB: ZoneId) {
        nextZones[detector.increasing] = zoneA
        nextZones[detector.decreasing] = zoneB
    }

    override fun setNextZone(detector: DirDetectorId, zone: ZoneId) {
        nextZones[detector] = zone
    }

    override fun zone(movableElements: StaticIdxSortedSet<TrackNode>): ZoneId {
        return zonePool.add(ZoneDescriptor(movableElements))
    }

    override fun zone(movableElements: List<TrackNodeId>): ZoneId {
        val set = MutableStaticIdxArraySet<TrackNode>()
        for (item in movableElements)
            set.add(item)
        return zonePool.add(ZoneDescriptor(set))
    }

    override fun zone(movableElements: StaticIdxSortedSet<TrackNode>, bounds: List<DirDetectorId>): ZoneId {
        val zone = zonePool.add(ZoneDescriptor(movableElements))
        for (detectorDir in bounds)
            setNextZone(detectorDir, zone)
        return zone
    }

    override fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Distance, init: ZonePathBuilder.() -> Unit): ZonePathId {
        val builder = ZonePathBuilderImpl(entry, exit, length)
        builder.init()
        val zonePathDesc = builder.build()
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    override fun zonePath(
        entry: DirDetectorId,
        exit: DirDetectorId,
        length: Distance,
        movableElements: StaticIdxList<TrackNode>,
        movableElementsConfigs: StaticIdxList<TrackNodeConfig>,
        movableElementsDistances: DistanceList,
        signals: StaticIdxList<PhysicalSignal>,
        signalPositions: DistanceList,
        chunks: DirStaticIdxList<TrackChunk>,
    ): ZonePathId {
        val zonePathDesc = ZonePathDescriptor(
            entry, exit, length,
            movableElements, movableElementsConfigs, movableElementsDistances,
            signals, signalPositions, chunks
        )
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    override fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Distance): ZonePathId {
        val builder = ZonePathBuilderImpl(entry, exit, length)
        val zonePathDesc = builder.build()
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    override fun route(name: String?, init: RouteBuilder.() -> Unit): RouteId {
        val builder = RouteBuilderImpl(name)
        builder.init()
        return routePool.add(builder.build())
    }

    override fun physicalSignal(name: String?, sightDistance: Distance, init: PhysicalSignalBuilder.() -> Unit): PhysicalSignalId {
        val builder = PhysicalSignalBuilderImpl(name, sightDistance, logicalSignalPool)
        builder.init()
        return physicalSignalPool.add(builder.build())
    }

    override fun trackSection(name: String?, init: TrackSectionBuilder.() -> Unit): TrackSectionId {
        val builder = TrackSectionBuilderImpl(name)
        builder.init()
        return trackSectionPool.add(builder.build())
    }

    override fun trackChunk(
        geo: LineString,
        slopes: DirectionalMap<DistanceRangeMap<Double>>,
        length: Distance,
        offset: Distance
    ): TrackChunkId {
        return trackChunkPool.add(TrackChunkDescriptor(
            geo,
            slopes,
            length,
            // Route IDs will be filled later on, the routes are not initialized and don't have IDs yet
            DirectionalMap(MutableStaticIdxArrayList(), MutableStaticIdxArrayList()),
            StaticIdx(0u), // The track ID will be filled later on for the same reason as routes
            offset,
            MutableStaticIdxArrayList() // Same
        ))
    }

    override fun operationalPoint(name: String, chunkOffset: Distance, chunk: TrackChunkId): OperationalPointId {
        return operationalPointPool.add(OperationalPointDescriptor(name, chunkOffset, chunk))
    }

    override fun build(): RawInfra {
        resolveReferences()
        return RawInfraImpl(
            trackNodePool,
            trackSectionPool,
            trackChunkPool,
            nextNode,
            zonePool,
            detectorPool,
            nextZones,
            routePool,
            logicalSignalPool,
            physicalSignalPool,
            zonePathPool,
            zonePathMap,
            operationalPointPool,
            makeTrackIdMap()
        )
    }

    /** Create the mapping from track string to id */
    private fun makeTrackIdMap(): Map<String, TrackSectionId> {
        val res = HashMap<String, TrackSectionId>()
        for (trackId in trackSectionPool)
            res[trackSectionPool[trackId].name] = trackId
        return res
    }

    /** Some objects have cross-reference (such as routes and chunks, or track sections and chunks).
     * This method needs to be called to set the references that couldn't be set during initialization. */
    private fun resolveReferences() {
        // Resolve route references
        for (route in routePool) {
            val chunkListOnRoute = routePool[route].chunks as MutableDirStaticIdxArrayList
            for (zonePath in routePool[route].path) {
                for (dirChunk in zonePathPool[zonePath].chunks) {
                    val chunk = dirChunk.value
                    val dir = dirChunk.direction
                    val routeList = trackChunkPool[chunk].routes.get(dir) as MutableStaticIdxArrayList
                    routeList.add(route)
                    chunkListOnRoute.add(dirChunk)
                }
            }
        }

        // Resolve track references
        for (track in trackSectionPool)
            for (chunk in trackSectionPool[track].chunks)
                trackChunkPool[chunk].track = track

        // Resolve operational points
        for (op in operationalPointPool) {
            val chunk = trackChunkPool[operationalPointPool[op].chunk]
            val opList = chunk.operationalPoints as MutableStaticIdxArrayList
            opList.add(op)
        }
    }
}

fun RawInfraBuilder(): RawInfraBuilder {
    return RawInfraBuilderImpl()
}

inline fun rawInfra(init: RestrictedRawInfraBuilder.() -> Unit): RawInfra {
    val infraBuilder = RawInfraBuilderImpl()
    infraBuilder.init()
    return infraBuilder.build()
}
