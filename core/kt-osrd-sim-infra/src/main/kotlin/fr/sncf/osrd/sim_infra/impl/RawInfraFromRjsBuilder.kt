package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Detector
import fr.sncf.osrd.sim_infra.api.DetectorId
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.api.EndpointTrackSectionId
import fr.sncf.osrd.sim_infra.api.LoadingGaugeConstraint
import fr.sncf.osrd.sim_infra.api.LogicalSignal
import fr.sncf.osrd.sim_infra.api.OperationalPointPart
import fr.sncf.osrd.sim_infra.api.OperationalPointPartId
import fr.sncf.osrd.sim_infra.api.PhysicalSignal
import fr.sncf.osrd.sim_infra.api.PhysicalSignalId
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.api.TrackChunkId
import fr.sncf.osrd.sim_infra.api.TrackNode
import fr.sncf.osrd.sim_infra.api.TrackNodeConfig
import fr.sncf.osrd.sim_infra.api.TrackNodeId
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
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdxSortedSet
import fr.sncf.osrd.utils.indexing.StaticPool
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.OffsetList
import kotlin.collections.set
import kotlin.time.Duration

class RawInfraFromRjsBuilderImpl : RawInfraBuilder {
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
    private val operationalPointPartPool =
        StaticPool<OperationalPointPart, OperationalPointPartDescriptor>()

    override fun movableElement(
        name: String,
        delay: Duration,
        init: MovableElementDescriptorBuilder.() -> Unit
    ): TrackNodeId {
        val movableElementBuilder =
            MovableElementDescriptorBuilderImpl(name, delay, StaticPool(), StaticPool())
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
        for (item in movableElements) set.add(item)
        return zonePool.add(ZoneDescriptor(set))
    }

    override fun zone(
        movableElements: StaticIdxSortedSet<TrackNode>,
        bounds: List<DirDetectorId>
    ): ZoneId {
        val zone = zonePool.add(ZoneDescriptor(movableElements))
        for (detectorDir in bounds) setNextZone(detectorDir, zone)
        return zone
    }

    override fun zonePath(
        entry: DirDetectorId,
        exit: DirDetectorId,
        length: Length<ZonePath>,
        init: ZonePathBuilder.() -> Unit
    ): ZonePathId {
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
        val zonePathDesc =
            ZonePathDescriptor(
                entry,
                exit,
                length,
                movableElements,
                movableElementsConfigs,
                movableElementsDistances,
                signals,
                signalPositions,
                chunks
            )
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    override fun zonePath(
        entry: DirDetectorId,
        exit: DirDetectorId,
        length: Length<ZonePath>
    ): ZonePathId {
        val builder = ZonePathBuilderImpl(entry, exit, length)
        val zonePathDesc = builder.build()
        return zonePathMap.getOrPut(zonePathDesc) { zonePathPool.add(zonePathDesc) }
    }

    override fun route(name: String?, init: RouteBuilder.() -> Unit): RouteId {
        val builder = RouteBuilderImpl(name)
        builder.init()
        return routePool.add(builder.build())
    }

    override fun physicalSignal(
        name: String?,
        sightDistance: Distance,
        init: PhysicalSignalBuilder.() -> Unit
    ): PhysicalSignalId {
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
        electrificationVoltage: DistanceRangeMap<String>,
        neutralSections: DirectionalMap<DistanceRangeMap<NeutralSection>>,
        speedSections: DirectionalMap<DistanceRangeMap<SpeedSection>>
    ): TrackChunkId {
        return trackChunkPool.add(
            TrackChunkDescriptor(
                geo,
                slopes,
                curves,
                gradients,
                length,
                // Route IDs will be filled later on, the routes are not initialized and don't have
                // IDs
                // yet
                DirectionalMap(MutableStaticIdxArrayList(), MutableStaticIdxArrayList()),
                StaticIdx(0u), // The track ID will be filled later on for the same reason as routes
                offset,
                MutableStaticIdxArrayList(), // Same
                loadingGaugeConstraints,
                electrificationVoltage,
                neutralSections,
                speedSections
            )
        )
    }

    override fun operationalPointPart(
        name: String,
        chunkOffset: Offset<TrackChunk>,
        chunk: TrackChunkId
    ): OperationalPointPartId {
        return operationalPointPartPool.add(
            OperationalPointPartDescriptor(name, chunkOffset, chunk)
        )
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
                routeLength += zonePathPool[zonePath].length.distance
                for (dirChunk in zonePathPool[zonePath].chunks) {
                    val chunk = dirChunk.value
                    val dir = dirChunk.direction
                    val routeList =
                        trackChunkPool[chunk].routes.get(dir) as MutableStaticIdxArrayList
                    routeList.add(route)
                    chunkListOnRoute.add(dirChunk)
                }
            }
            routePool[route].length = Length(routeLength)
        }

        // Resolve track references
        for (track in trackSectionPool) for (chunk in
            trackSectionPool[track].chunks) trackChunkPool[chunk].track = track

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

fun RawInfraFromRjsBuilder(): RawInfraBuilder {
    return RawInfraFromRjsBuilderImpl()
}

inline fun rawInfraFromRjs(init: RestrictedRawInfraBuilder.() -> Unit): RawInfra {
    val infraBuilder = RawInfraFromRjsBuilderImpl()
    infraBuilder.init()
    return infraBuilder.build()
}
