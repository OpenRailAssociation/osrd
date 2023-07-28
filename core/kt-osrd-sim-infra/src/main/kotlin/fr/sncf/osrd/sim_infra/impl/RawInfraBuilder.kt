package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.fast_collections.mutableIntArrayListOf
import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Detector
import fr.sncf.osrd.sim_infra.api.DetectorId
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.api.DirTrackChunkId
import fr.sncf.osrd.sim_infra.api.EndpointTrackSectionId
import fr.sncf.osrd.sim_infra.api.LoadingGaugeConstraint
import fr.sncf.osrd.sim_infra.api.LogicalSignal
import fr.sncf.osrd.sim_infra.api.LogicalSignalId
import fr.sncf.osrd.sim_infra.api.OperationalPointPart
import fr.sncf.osrd.sim_infra.api.OperationalPointPartId
import fr.sncf.osrd.sim_infra.api.PhysicalSignal
import fr.sncf.osrd.sim_infra.api.PhysicalSignalId
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.sim_infra.api.SpeedLimit
import fr.sncf.osrd.sim_infra.api.SpeedLimitId
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.api.TrackChunkId
import fr.sncf.osrd.sim_infra.api.TrackNode
import fr.sncf.osrd.sim_infra.api.TrackNodeConfig
import fr.sncf.osrd.sim_infra.api.TrackNodeConfigId
import fr.sncf.osrd.sim_infra.api.TrackNodeId
import fr.sncf.osrd.sim_infra.api.TrackNodePort
import fr.sncf.osrd.sim_infra.api.TrackNodePortId
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.sim_infra.api.TrackSectionId
import fr.sncf.osrd.sim_infra.api.Zone
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.sim_infra.api.ZonePath
import fr.sncf.osrd.sim_infra.api.ZonePathId
import fr.sncf.osrd.sim_infra.api.decreasing
import fr.sncf.osrd.sim_infra.api.increasing
import fr.sncf.osrd.utils.DirectionalMap
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.IdxMap
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArraySet
import fr.sncf.osrd.utils.indexing.MutableStaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdxSortedSet
import fr.sncf.osrd.utils.indexing.StaticPool
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.MutableOffsetArrayList
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.OffsetList
import fr.sncf.osrd.utils.units.mutableOffsetArrayListOf
import kotlin.collections.set
import kotlin.time.Duration


interface MovableElementDescriptorBuilder {
    fun port(endpoint: EndpointTrackSectionId): TrackNodePortId
    fun config(name: String, portLink: Pair<TrackNodePortId, TrackNodePortId>): TrackNodeConfigId
}

class MovableElementDescriptorBuilderImpl(
    private val name: String,
    private val delay: Duration,
    private val ports: StaticPool<TrackNodePort, EndpointTrackSectionId>,
    private val configs: StaticPool<TrackNodeConfig, TrackNodeConfigDescriptor>,
) : MovableElementDescriptorBuilder {
    override fun port(endpoint: EndpointTrackSectionId): TrackNodePortId {
        return ports.add(endpoint)
    }

    override fun config(name: String, portLink: Pair<TrackNodePortId, TrackNodePortId>): TrackNodeConfigId {
        return configs.add(TrackNodeConfigDescriptor(name, portLink))
    }

    fun build(): TrackNodeDescriptor {
        return TrackNodeDescriptor(name, delay, ports, configs)
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
    fun movableElement(movableElement: TrackNodeId, config: TrackNodeConfigId, zonePathOffset: Offset<ZonePath>)
    fun signal(signal: PhysicalSignalId, zonePathOffset: Offset<ZonePath>)
}

class ZonePathBuilderImpl(val entry: DirDetectorId, val exit: DirDetectorId, val length: Length<ZonePath>) : ZonePathBuilder {
    private val movableElements = MutableStaticIdxArrayList<TrackNode>()
    private val movableElementsConfigs = MutableStaticIdxArrayList<TrackNodeConfig>()
    private val movableElementsDistances = MutableOffsetArrayList<ZonePath>()
    private val signals = MutableStaticIdxArrayList<PhysicalSignal>()
    private val signalPositions = MutableOffsetArrayList<ZonePath>()


    override fun movableElement(
        movableElement: TrackNodeId,
        config: TrackNodeConfigId,
        zonePathOffset: Offset<ZonePath>
    ) {
        movableElements.add(movableElement)
        movableElementsConfigs.add(config)
        movableElementsDistances.add(zonePathOffset)
    }

    override fun signal(signal: PhysicalSignalId, zonePathOffset: Offset<ZonePath>) {
        signals.add(signal)
        signalPositions.add(zonePathOffset)
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

    fun build(): RouteDescriptorImpl {
        return RouteDescriptorImpl(
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

class RouteDescriptorImpl(
    override val name: String?,
    override var length: Length<Route>,
    override val path: StaticIdxList<ZonePath>,
    override val releaseZones: IntArray,
    override val speedLimits: StaticIdxList<SpeedLimit>,
    override val speedLimitStarts: OffsetList<Route>,
    override val speedLimitEnds: OffsetList<Route>,
    override val chunks: DirStaticIdxList<TrackChunk>,
) : RouteDescriptor

interface RestrictedRawInfraBuilder {
    fun movableElement(name: String, delay: Duration, init: MovableElementDescriptorBuilder.() -> Unit): TrackNodeId
    fun detector(name: String?): DetectorId
    fun linkZones(zoneA: ZoneId, zoneB: ZoneId): DetectorId
    fun linkZones(detector: DetectorId, zoneA: ZoneId, zoneB: ZoneId)
    fun setNextZone(detector: DirDetectorId, zone: ZoneId)
    // The 3 "zone" methods are outdated because we can compute zones using track topology. They should be removed once
    // the rjs parsing has been migrated and the legacy infra isn't used as an intermediate step anymore
    fun zone(movableElements: StaticIdxSortedSet<TrackNode>): ZoneId
    fun zone(movableElements: List<TrackNodeId>): ZoneId
    fun zone(movableElements: StaticIdxSortedSet<TrackNode>, bounds: List<DirDetectorId>): ZoneId
    fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Length<ZonePath>, init: ZonePathBuilder.() -> Unit): ZonePathId
    fun zonePath(
        entry: DirDetectorId, exit: DirDetectorId,
        length: Length<ZonePath>,
        movableElements: StaticIdxList<TrackNode>,
        movableElementsConfigs: StaticIdxList<TrackNodeConfig>,
        movableElementsDistances: OffsetList<ZonePath>,
        signals: StaticIdxList<PhysicalSignal>,
        signalPositions: OffsetList<ZonePath>,
        chunks: DirStaticIdxList<TrackChunk>,
    ): ZonePathId
    fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Length<ZonePath>): ZonePathId
    fun route(name: String?, init: RouteBuilder.() -> Unit): RouteId
    fun physicalSignal(name: String?, sightDistance: Distance, init: PhysicalSignalBuilder.() -> Unit): PhysicalSignalId
    fun trackSection(name: String?, init: TrackSectionBuilder.() -> Unit): TrackSectionId
    fun trackChunk(
        geo: LineString,
        slopes: DirectionalMap<DistanceRangeMap<Double>>,
        length: Length<TrackChunk>,
        offset: Offset<TrackSection>,
        curves: DirectionalMap<DistanceRangeMap<Double>>,
        gradients: DirectionalMap<DistanceRangeMap<Double>>,
        loadingGaugeConstraints: DistanceRangeMap<LoadingGaugeConstraint>,
        catenaryVoltage: DistanceRangeMap<String>,
        neutralSections: DirectionalMap<DistanceRangeMap<NeutralSection>>,
        speedSections: DirectionalMap<DistanceRangeMap<SpeedSection>>
    ): TrackChunkId
    fun operationalPointPart(name: String, chunkOffset: Offset<TrackChunk>, chunk: TrackChunkId): OperationalPointPartId
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
    private val trackNodePool = StaticPool<TrackNode, TrackNodeDescriptor>()
    private val trackSectionPool = StaticPool<TrackSection, TrackSectionDescriptor>()
    private val trackChunkPool = StaticPool<TrackChunk, TrackChunkDescriptor>()
    private val nodeAtEndpoint = IdxMap<EndpointTrackSectionId, TrackNodeId>()
    private val zonePool = StaticPool<Zone, ZoneDescriptor>()
    private val detectorPool = StaticPool<Detector, String?>()
    private val nextZones = IdxMap<DirDetectorId, ZoneId>()
    private val routePool = StaticPool<Route, RouteDescriptor>()
    private val logicalSignalPool = StaticPool<LogicalSignal, LogicalSignalDescriptor>()
    private val physicalSignalPool = StaticPool<PhysicalSignal, PhysicalSignalDescriptor>()
    private val zonePathPool = StaticPool<ZonePath, ZonePathDescriptor>()
    private val zonePathMap = mutableMapOf<ZonePathSpec, ZonePathId>()
    private val operationalPointPartPool = StaticPool<OperationalPointPart, OperationalPointPartDescriptor>()

    override fun movableElement(name: String, delay: Duration, init: MovableElementDescriptorBuilder.() -> Unit): TrackNodeId {
        val movableElementBuilder = MovableElementDescriptorBuilderImpl(name, delay, StaticPool(), StaticPool())
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

    override fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Length<ZonePath>, init: ZonePathBuilder.() -> Unit): ZonePathId {
        val builder = ZonePathBuilderImpl(entry, exit, length)
        builder.init()
        val zonePathDesc = builder.build()
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    override fun zonePath(
        entry: DirDetectorId,
        exit: DirDetectorId,
        length: Length<ZonePath>,
        movableElements: StaticIdxList<TrackNode>,
        movableElementsConfigs: StaticIdxList<TrackNodeConfig>,
        movableElementsDistances: OffsetList<ZonePath>,
        signals: StaticIdxList<PhysicalSignal>,
        signalPositions: OffsetList<ZonePath>,
        chunks: DirStaticIdxList<TrackChunk>,
    ): ZonePathId {
        val zonePathDesc = ZonePathDescriptor(
            entry, exit, length,
            movableElements, movableElementsConfigs, movableElementsDistances,
            signals, signalPositions, chunks
        )
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    override fun zonePath(entry: DirDetectorId, exit: DirDetectorId, length: Length<ZonePath>): ZonePathId {
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
        length: Length<TrackChunk>,
        offset: Offset<TrackSection>,
        curves: DirectionalMap<DistanceRangeMap<Double>>,
        gradients: DirectionalMap<DistanceRangeMap<Double>>,
        loadingGaugeConstraints: DistanceRangeMap<LoadingGaugeConstraint>,
        catenaryVoltage: DistanceRangeMap<String>,
        neutralSections: DirectionalMap<DistanceRangeMap<NeutralSection>>,
        speedSections: DirectionalMap<DistanceRangeMap<SpeedSection>>
    ): TrackChunkId {
        return trackChunkPool.add(TrackChunkDescriptor(
            geo,
            slopes,
            curves,
            gradients,
            length,
            // Route IDs will be filled later on, the routes are not initialized and don't have IDs yet
            DirectionalMap(MutableStaticIdxArrayList(), MutableStaticIdxArrayList()),
            StaticIdx(0u), // The track ID will be filled later on for the same reason as routes
            offset,
            MutableStaticIdxArrayList(), // Same
            loadingGaugeConstraints,
            catenaryVoltage,
            neutralSections,
            speedSections
        ))
    }

    override fun operationalPointPart(name: String, chunkOffset: Offset<TrackChunk>, chunk: TrackChunkId): OperationalPointPartId {
        return operationalPointPartPool.add(OperationalPointPartDescriptor(name, chunkOffset, chunk))
    }

    override fun build(): RawInfra {
        resolveReferences()
        return RawInfraImpl(
            trackNodePool,
            trackSectionPool,
            trackChunkPool,
            nodeAtEndpoint,
            zonePool,
            detectorPool,
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
            makeDetExitToRouteMap()
        )
    }

    /** Create the mapping from each dir detector to routes that start there */
    private fun makeDetEntryToRouteMap(): Map<DirStaticIdx<Detector>, StaticIdxList<Route>> {
        val res = HashMap<DirStaticIdx<Detector>, MutableStaticIdxArrayList<Route>>()
        for (routeId in routePool) {
            val firstZonePath = routePool[routeId].path.first()
            val entry = zonePathPool[firstZonePath].entry
            res.computeIfAbsent(entry) { mutableStaticIdxArrayListOf() }
                .add(routeId)
        }
        return res
    }

    /** Create the mapping from each dir detector to routes that end there */
    private fun makeDetExitToRouteMap(): Map<DirStaticIdx<Detector>, StaticIdxList<Route>> {
        val res = HashMap<DirStaticIdx<Detector>, MutableStaticIdxArrayList<Route>>()
        for (routeId in routePool) {
            val lastZonePath = routePool[routeId].path.last()
            val exit = zonePathPool[lastZonePath].exit
            res.computeIfAbsent(exit) { mutableStaticIdxArrayListOf() }
                .add(routeId)
        }
        return res
    }

    /** Create the mapping from track name to id */
    private fun makeTrackNameMap(): Map<String, TrackSectionId> {
        val res = HashMap<String, TrackSectionId>()
        for (trackId in trackSectionPool)
            res[trackSectionPool[trackId].name] = trackId
        return res
    }

    /** Create the mapping from route name to id */
    private fun makeRouteNameMap(): Map<String, RouteId> {
        val res = HashMap<String, RouteId>()
        for (routeId in routePool) {
            val routeName = routePool[routeId].name
            if (res[routePool[routeId].name!!] != null)
                throw OSRDError.newDuplicateRouteError(routeName)
            else if (routeName != null)
                res[routePool[routeId].name!!] = routeId
        }
        return res
    }

    /** Some objects have cross-reference (such as routes and chunks, or track sections and chunks).
     * This method needs to be called to set the references that couldn't be set during initialization. */
    private fun resolveReferences() {
        // Resolve route references
        for (route in routePool) {
            val chunkListOnRoute = routePool[route].chunks as MutableDirStaticIdxArrayList
            var routeLength = Distance.ZERO
            for (zonePath in routePool[route].path) {
                routeLength += zonePathPool[zonePath].length.distance
                for (dirChunk in zonePathPool[zonePath].chunks) {
                    val chunk = dirChunk.value
                    val dir = dirChunk.direction
                    val routeList = trackChunkPool[chunk].routes.get(dir) as MutableStaticIdxArrayList
                    routeList.add(route)
                    chunkListOnRoute.add(dirChunk)
                }
            }
            routePool[route].length = Length(routeLength)
        }

        // Resolve track references
        for (track in trackSectionPool)
            for (chunk in trackSectionPool[track].chunks)
                trackChunkPool[chunk].track = track

        // Resolve operational points
        for (op in operationalPointPartPool) {
            val chunk = trackChunkPool[operationalPointPartPool[op].chunk]
            val opList = chunk.operationalPointParts as MutableStaticIdxArrayList
            opList.add(op)
        }

        // Build a map from track section endpoint to track node
        for (trackNode in trackNodePool) {
            val nodeDescriptor = trackNodePool[trackNode]
            for (port in nodeDescriptor.ports) {
                val connectedEndpoint = nodeDescriptor.ports[port]
                nodeAtEndpoint.getOrPut(connectedEndpoint) { trackNode }
            }
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
