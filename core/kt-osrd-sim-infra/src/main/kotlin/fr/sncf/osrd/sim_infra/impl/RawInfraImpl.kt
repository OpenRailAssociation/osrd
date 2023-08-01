package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*
import kotlin.time.Duration


class MovableElementConfigDescriptor(
    val name: String,
    val portLink: Pair<TrackNodePortId, TrackNodePortId>,
)

class MovableElementDescriptor(
    val delay: Duration,
    val ports: StaticPool<TrackNodePort, EndpointTrackSectionId>,
    val configs: StaticPool<TrackNodeConfig, MovableElementConfigDescriptor>,
)

class TrackSectionDescriptor(
    val name: String,
    val chunks: StaticIdxList<TrackChunk>,
)

class TrackChunkDescriptor(
    val geo: LineString,
    val slopes: DirectionalMap<DistanceRangeMap<Double>>,
    val curves: DirectionalMap<DistanceRangeMap<Double>>,
    val gradients: DirectionalMap<DistanceRangeMap<Double>>,
    val length: Distance,
    val routes: DirectionalMap<StaticIdxList<Route>>,
    var track: StaticIdx<TrackSection>,
    val offset: Distance,
    var operationalPointParts: StaticIdxList<OperationalPointPart>,
    val loadingGaugeConstraints: DistanceRangeMap<LoadingGaugeConstraint>,
    val catenaryVoltage: DistanceRangeMap<String>,
    val deadSections: DirectionalMap<DistanceRangeMap<DeadSection>>,
    val speedSections: DirectionalMap<DistanceRangeMap<SpeedSection>>
)

@JvmInline
value class ZoneDescriptor(val movableElements: StaticIdxSortedSet<TrackNode>)

interface RouteDescriptor {
    val name: String?
    val path: StaticIdxList<ZonePath>
    val releaseZones: IntArray
    val speedLimits: StaticIdxList<SpeedLimit>
    val speedLimitStarts: DistanceList
    val speedLimitEnds: DistanceList
    val chunks: DirStaticIdxList<TrackChunk>
}

class LogicalSignalDescriptor(
    val signalingSystemId: String,
    val nextSignalingSystemIds: List<String>,
    val rawSettings: Map<String, String>,
)

class PhysicalSignalDescriptor(
    val name: String?,
    val logicalSignals: StaticIdxList<LogicalSignal>,
    val sightDistance: Distance,
)

open class ZonePathSpec(
    val entry: DirDetectorId,
    val exit: DirDetectorId,
    val movableElements: StaticIdxList<TrackNode>,
    val movableElementsConfigs: StaticIdxList<TrackNodeConfig>,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ZonePathSpec) return false
        if (entry != other.entry) return false
        if (exit != other.exit) return false
        if (movableElements != other.movableElements) return false
        if (movableElementsConfigs != other.movableElementsConfigs) return false
        return true
    }

    override fun hashCode(): Int {
        var result = entry.hashCode()
        result = 31 * result + exit.hashCode()
        return result
    }
}

class ZonePathDescriptor(
    entry: DirDetectorId,
    exit: DirDetectorId,
    val length: Distance,
    movableElements: StaticIdxList<TrackNode>,
    movableElementsConfigs: StaticIdxList<TrackNodeConfig>,
    val movableElementsDistances: DistanceList,
    val signals: StaticIdxList<PhysicalSignal>,
    val signalPositions: DistanceList,
    val chunks: DirStaticIdxList<TrackChunk>,
) : ZonePathSpec(entry, exit, movableElements, movableElementsConfigs)

class OperationalPointPartDescriptor(
    val name: String,
    val chunkOffset: Distance,
    val chunk: TrackChunkId,
)

class SpeedSection(
    val default: Speed,
    val speedByTrainTag: Map<String, Speed>,
)

class DeadSection(
    val isDropPantograph: Boolean,
)


class RawInfraImpl(
    val trackNodePool: StaticPool<TrackNode, MovableElementDescriptor>,
    val trackSectionPool: StaticPool<TrackSection, TrackSectionDescriptor>,
    val trackChunkPool: StaticPool<TrackChunk, TrackChunkDescriptor>,
    val nextNode: IdxMap<DirTrackSectionId, TrackNodeId>,
    val zonePool: StaticPool<Zone, ZoneDescriptor>,
    val detectorPool: StaticPool<Detector, String?>,
    val nextZones: IdxMap<DirDetectorId, ZoneId>,
    val routeDescriptors: StaticPool<Route, RouteDescriptor>,
    val logicalSignalPool: StaticPool<LogicalSignal, LogicalSignalDescriptor>,
    val physicalSignalPool: StaticPool<PhysicalSignal, PhysicalSignalDescriptor>,
    val zonePathPool: StaticPool<ZonePath, ZonePathDescriptor>,
    val zonePathMap: Map<ZonePathSpec, ZonePathId>,
    val operationalPointPartPool: StaticPool<OperationalPointPart, OperationalPointPartDescriptor>,
    val trackSectionNameMap: Map<String, TrackSectionId>,
) : RawInfra {
    override val trackNodes: StaticIdxSpace<TrackNode>
        get() = trackNodePool.space()
    override val trackSections: StaticIdxSpace<TrackSection>
        get() = trackSectionPool.space()

    override fun getTrackSectionName(trackSection: TrackSectionId): String {
        return trackSectionPool[trackSection].name
    }

    override fun getTrackSectionFromName(name: String): TrackSectionId? {
        return trackSectionNameMap[name]
    }

    override fun getTrackSectionChunks(trackSection: TrackSectionId): StaticIdxList<TrackChunk> {
        return trackSectionPool[trackSection].chunks
    }

    override fun getTrackSectionLength(trackSection: TrackSectionId): Distance {
        var length = Distance(0)
        for (trackChunk in getTrackSectionChunks(trackSection)) {
            length += getTrackChunkLength(trackChunk)
        }
        return length
    }

    override fun getTrackChunkLength(trackChunk: TrackChunkId): Distance {
        return trackChunkPool[trackChunk].length
    }

    override fun getTrackChunkOffset(trackChunk: TrackChunkId): Distance {
        return trackChunkPool[trackChunk].offset
    }

    override fun getTrackFromChunk(trackChunk: TrackChunkId): TrackSectionId {
        return trackChunkPool[trackChunk].track
    }

    override fun getTrackChunkOperationalPointParts(trackChunk: TrackChunkId): StaticIdxList<OperationalPointPart> {
        return trackChunkPool[trackChunk].operationalPointParts
    }

    override fun getOperationalPointPartChunk(operationalPoint: OperationalPointPartId): TrackChunkId {
        return operationalPointPartPool[operationalPoint].chunk
    }

    override fun getOperationalPointPartChunkOffset(operationalPoint: OperationalPointPartId): Distance {
        return operationalPointPartPool[operationalPoint].chunkOffset
    }

    override fun getOperationalPointPartName(operationalPoint: OperationalPointPartId): String {
        return operationalPointPartPool[operationalPoint].name
    }

    override fun getTrackChunkGeom(trackChunk: TrackChunkId): LineString {
        return trackChunkPool[trackChunk].geo
    }

    override fun getTrackChunkSlope(trackChunk: DirTrackChunkId): DistanceRangeMap<Double> {
        return trackChunkPool[trackChunk.value].slopes.get(trackChunk.direction)
    }

    override fun getTrackChunkCurve(trackChunk: DirTrackChunkId): DistanceRangeMap<Double> {
        return trackChunkPool[trackChunk.value].curves.get(trackChunk.direction)
    }

    override fun getTrackChunkGradient(trackChunk: DirTrackChunkId): DistanceRangeMap<Double> {
        return trackChunkPool[trackChunk.value].gradients.get(trackChunk.direction)
    }

    override fun getTrackChunkLoadingGaugeConstraints(trackChunk: TrackChunkId): DistanceRangeMap<LoadingGaugeConstraint> {
        return trackChunkPool[trackChunk].loadingGaugeConstraints
    }

    override fun getTrackChunkCatenaryVoltage(trackChunk: TrackChunkId): DistanceRangeMap<String> {
        return trackChunkPool[trackChunk].catenaryVoltage
    }

    override fun getTrackChunkDeadSection(trackChunk: DirTrackChunkId): DistanceRangeMap<DeadSection> {
        return trackChunkPool[trackChunk.value].deadSections.get(trackChunk.direction)
    }

    override fun getTrackChunkSpeedSections(trackChunk: DirTrackChunkId, trainTag: String?): DistanceRangeMap<Speed> {
        val res = distanceRangeMapOf<Speed>()
        for (entry in trackChunkPool[trackChunk.value].speedSections.get(trackChunk.direction)) {
            val speedSection = entry.value
            val allowedSpeed = speedSection.speedByTrainTag.getOrDefault(trainTag, speedSection.default)
            res.put(entry.lower, entry.upper, allowedSpeed)
        }
        return res
    }

    override fun getRoutesOnTrackChunk(trackChunk: DirTrackChunkId): StaticIdxList<Route> {
        return trackChunkPool[trackChunk.value].routes.get(trackChunk.direction)
    }

    private val zoneDetectors: IdxMap<ZoneId, MutableList<DirDetectorId>> = IdxMap()
    private val parentSignalMap: IdxMap<LogicalSignalId, PhysicalSignalId> = IdxMap()

    init {
        // initialize the zone detector map
        for (zone in zonePool)
            zoneDetectors[zone] = mutableListOf()
        for (detector in detectorPool) {
            val nextZone = getNextZone(detector.increasing)
            if (nextZone != null)
                zoneDetectors[nextZone]!!.add(detector.increasing)
            val prevZone = getNextZone(detector.decreasing)
            if (prevZone != null)
                zoneDetectors[prevZone]!!.add(detector.decreasing)
        }

        // initialize the physical signal to logical signal map
        for (physicalSignal in physicalSignalPool)
            for (child in physicalSignalPool[physicalSignal].logicalSignals)
                parentSignalMap[child] = physicalSignal
    }

    override fun getTrackNodeConfigs(trackNode: TrackNodeId): StaticIdxSpace<TrackNodeConfig> {
        return trackNodePool[trackNode].configs.space()
    }

    override fun getTrackNodePorts(trackNode: TrackNodeId): StaticIdxSpace<TrackNodePort> {
        return trackNodePool[trackNode].ports.space()
    }

    override fun getTrackNodeExitPort(
        trackNode: TrackNodeId,
        config: TrackNodeConfigId,
        entryPort: TrackNodePortId
    ): OptStaticIdx<TrackNodePort> {
        val ports = trackNodePool[trackNode].configs[config].portLink
        if (ports.first == entryPort)
            return OptStaticIdx(ports.second.index)
        if (ports.second == entryPort)
            return OptStaticIdx(ports.first.index)
        return OptStaticIdx()
    }

    override fun getTrackNodeDelay(trackNode: TrackNodeId): Duration {
        return trackNodePool[trackNode].delay
    }

    override fun getTrackNodeConfigName(
        trackNode: TrackNodeId,
        config: TrackNodeConfigId
    ): String {
        return trackNodePool[trackNode].configs[config].name
    }

    override val zones: StaticIdxSpace<Zone>
        get() = zonePool.space()

    override fun getMovableElements(zone: ZoneId): StaticIdxSortedSet<TrackNode> {
        return zonePool[zone].movableElements
    }

    override fun getZoneBounds(zone: ZoneId): List<DirDetectorId> {
        return zoneDetectors[zone]!!
    }

    override val detectors: StaticIdxSpace<Detector>
        get() = detectorPool.space()

    override fun getNextZone(dirDet: DirDetectorId): ZoneId? {
        return nextZones[dirDet]
    }

    override fun getPreviousZone(dirDet: DirDetectorId): ZoneId? {
        return nextZones[dirDet.opposite]
    }

    override fun getDetectorName(det: DetectorId): String? {
        return detectorPool[det]
    }

    override fun getNextTrackSection(
        current: DirTrackSectionId,
        config: TrackNodeConfigId
    ): OptDirTrackSectionId {
        val currentPort = getNextTrackNodePort(current)
        if (currentPort.isNone)
            return OptDirTrackSectionId()
        val optTrackNode = getNextTrackNode(current)
        assert(!optTrackNode.isNone)
        val trackNode = optTrackNode.asIndex()
        val nextPort = getTrackNodeExitPort(trackNode, config, currentPort.asIndex())
        if (nextPort.isNone)
            return OptDirTrackSectionId()
        val nextEndpoint = trackNodePool[trackNode].ports[nextPort.asIndex()]
        return OptDirTrackSectionId(
            nextEndpoint.value, nextEndpoint.endpoint.directionAway
        )
    }

    override fun getNextTrackNode(trackSection: DirTrackSectionId): OptStaticIdx<TrackNode> {
        val res = nextNode[trackSection] ?: return OptStaticIdx()
        return OptStaticIdx(res.index)
    }

    override fun getNextTrackNodePort(trackSection: DirTrackSectionId): OptStaticIdx<TrackNodePort> {
        val node = getNextTrackNode(trackSection)
        if (node.isNone)
            return OptStaticIdx()
        val trackEndpoint = EndpointTrackSectionId(trackSection.value, trackSection.direction.toEndpoint)
        val nodeDescriptor = trackNodePool[node.asIndex()]
        for (i in 0u until nodeDescriptor.ports.size) {
            val id = StaticIdx<TrackNodePort>(i)
            if (nodeDescriptor.ports[id] == trackEndpoint)
                return OptStaticIdx(id.index)
        }
        return OptStaticIdx()
    }

    override fun getPortTrackSection(trackNode: TrackNodeId, port: TrackNodePortId): EndpointTrackSectionId {
        return trackNodePool[trackNode].ports[port]
    }

    override fun getSignals(zonePath: ZonePathId): StaticIdxList<PhysicalSignal> {
        return zonePathPool[zonePath].signals
    }

    override fun getSignalPositions(zonePath: ZonePathId): DistanceList {
        return zonePathPool[zonePath].signalPositions
    }

    override fun getSpeedLimits(route: RouteId): StaticIdxList<SpeedLimit> {
        return routeDescriptors[route].speedLimits
    }

    override fun getSpeedLimitStarts(route: RouteId): DistanceList {
        return routeDescriptors[route].speedLimitStarts
    }

    override fun getSpeedLimitEnds(route: RouteId): DistanceList {
        return routeDescriptors[route].speedLimitEnds
    }

    override val physicalSignals: StaticIdxSpace<PhysicalSignal>
        get() = physicalSignalPool.space()
    override val logicalSignals: StaticIdxSpace<LogicalSignal>
        get() = logicalSignalPool.space()

    override fun getLogicalSignals(signal: PhysicalSignalId): StaticIdxList<LogicalSignal> {
        return physicalSignalPool[signal].logicalSignals
    }

    override fun getPhysicalSignal(signal: LogicalSignalId): PhysicalSignalId {
        return parentSignalMap[signal]!!
    }

    override fun getPhysicalSignalName(signal: PhysicalSignalId): String? {
        return physicalSignalPool[signal].name
    }

    override fun getSignalSightDistance(signal: PhysicalSignalId): Distance {
        return physicalSignalPool[signal].sightDistance
    }

    override fun getSignalingSystemId(signal: LogicalSignalId): String {
        return logicalSignalPool[signal].signalingSystemId
    }

    override fun getRawSettings(signal: LogicalSignalId): Map<String, String> {
        return logicalSignalPool[signal].rawSettings
    }

    override fun getNextSignalingSystemIds(signal: LogicalSignalId): List<String> {
        return logicalSignalPool[signal].nextSignalingSystemIds
    }

    override val zonePaths: StaticIdxSpace<ZonePath>
        get() = zonePathPool.space()

    override fun findZonePath(
        entry: DirDetectorId,
        exit: DirDetectorId,
        movableElements: StaticIdxList<TrackNode>,
        trackNodeConfigs: StaticIdxList<TrackNodeConfig>
    ): ZonePathId? {
        return zonePathMap[ZonePathSpec(entry, exit, movableElements, trackNodeConfigs)]
    }

    override fun getZonePathEntry(zonePath: ZonePathId): DirDetectorId {
        return zonePathPool[zonePath].entry
    }

    override fun getZonePathExit(zonePath: ZonePathId): DirDetectorId {
        return zonePathPool[zonePath].exit
    }

    override fun getZonePathLength(zonePath: ZonePathId): Distance {
        return zonePathPool[zonePath].length
    }

    override fun getZonePathMovableElements(zonePath: ZonePathId): StaticIdxList<TrackNode> {
        return zonePathPool[zonePath].movableElements
    }

    override fun getZonePathMovableElementsConfigs(zonePath: ZonePathId): StaticIdxList<TrackNodeConfig> {
        return zonePathPool[zonePath].movableElementsConfigs
    }

    override fun getZonePathMovableElementsDistances(zonePath: ZonePathId): DistanceList {
        return zonePathPool[zonePath].movableElementsDistances
    }

    override fun getZonePathChunks(zonePath: ZonePathId): DirStaticIdxList<TrackChunk> {
        return zonePathPool[zonePath].chunks
    }

    override val routes: StaticIdxSpace<Route>
        get() = routeDescriptors.space()


    override fun getRoutePath(route: RouteId): StaticIdxList<ZonePath> {
        return routeDescriptors[route].path
    }

    override fun getRouteName(route: RouteId): String? {
        return routeDescriptors[route].name
    }

    override fun getRouteReleaseZones(route: RouteId): IntArray {
        return routeDescriptors[route].releaseZones
    }

    override fun getChunksOnRoute(route: RouteId): DirStaticIdxList<TrackChunk> {
        return routeDescriptors[route].chunks
    }
}
