package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Detector
import fr.sncf.osrd.sim_infra.api.DetectorId
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.api.DirTrackChunkId
import fr.sncf.osrd.sim_infra.api.DirTrackSectionId
import fr.sncf.osrd.sim_infra.api.EndpointTrackSectionId
import fr.sncf.osrd.sim_infra.api.LoadingGaugeConstraint
import fr.sncf.osrd.sim_infra.api.LogicalSignal
import fr.sncf.osrd.sim_infra.api.LogicalSignalId
import fr.sncf.osrd.sim_infra.api.OperationalPointPart
import fr.sncf.osrd.sim_infra.api.OperationalPointPartId
import fr.sncf.osrd.sim_infra.api.OptDirTrackSectionId
import fr.sncf.osrd.sim_infra.api.PhysicalSignal
import fr.sncf.osrd.sim_infra.api.PhysicalSignalId
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.sim_infra.api.SpeedLimit
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
import fr.sncf.osrd.sim_infra.api.toEndpoint
import fr.sncf.osrd.utils.DirectionalMap
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.IdxMap
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.OptStaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdxSortedSet
import fr.sncf.osrd.utils.indexing.StaticIdxSpace
import fr.sncf.osrd.utils.indexing.StaticPool
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.OffsetList
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.metersPerSecond
import java.util.Objects
import kotlin.collections.HashMap
import kotlin.time.Duration

class TrackNodeConfigDescriptor(
    val name: String,
    val portLinks: List<Pair<TrackNodePortId, TrackNodePortId>>,
)

class TrackNodeDescriptor(
    val name: String,
    val delay: Duration,
    val ports: StaticPool<TrackNodePort, EndpointTrackSectionId>,
    val configs: StaticPool<TrackNodeConfig, TrackNodeConfigDescriptor>,
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
    val length: Length<TrackChunk>,
    val routes: DirectionalMap<StaticIdxList<Route>>,
    var track: StaticIdx<TrackSection>,
    val offset: Offset<TrackSection>,
    var operationalPointParts: StaticIdxList<OperationalPointPart>,
    val loadingGaugeConstraints: DistanceRangeMap<LoadingGaugeConstraint>,
    val electrificationVoltage: DistanceRangeMap<String>,
    val neutralSections: DirectionalMap<DistanceRangeMap<NeutralSection>>,
    val speedSections: DirectionalMap<DistanceRangeMap<SpeedSection>>
)

class ZoneDescriptor(
    val movableElements: StaticIdxSortedSet<TrackNode>,
    var name: String = "",
)

interface RouteDescriptor {
    val name: String?
    var length: Length<Route>
    val path: StaticIdxList<ZonePath>
    val releaseZones: IntArray
    val speedLimits: StaticIdxList<SpeedLimit>
    val speedLimitStarts: OffsetList<Route>
    val speedLimitEnds: OffsetList<Route>
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
    val length: Length<ZonePath>,
    movableElements: StaticIdxList<TrackNode>,
    movableElementsConfigs: StaticIdxList<TrackNodeConfig>,
    val movableElementsPositions: OffsetList<ZonePath>,
    val signals: StaticIdxList<PhysicalSignal>,
    val signalPositions: OffsetList<ZonePath>,
    val chunks: DirStaticIdxList<TrackChunk>,
) : ZonePathSpec(entry, exit, movableElements, movableElementsConfigs)

class OperationalPointPartDescriptor(
    val name: String,
    val chunkOffset: Offset<TrackChunk>,
    val chunk: TrackChunkId,
)

class SpeedSection(
    val default: Speed,
    val speedByTrainTag: Map<String, Speed>,
) {
    constructor(
        rjsSpeedSection: RJSSpeedSection
    ) : this(
        rjsSpeedSection.speedLimit.metersPerSecond,
        rjsSpeedSection.speedLimitByTag
            .map { entry -> Pair(entry.key, entry.value.metersPerSecond) }
            .toMap()
    )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is SpeedSection) return false
        if (default != other.default) return false
        if (speedByTrainTag != other.speedByTrainTag) return false
        return true
    }

    override fun hashCode(): Int {
        return Objects.hash(default, speedByTrainTag)
    }

    companion object {
        fun merge(a: SpeedSection, b: SpeedSection): SpeedSection {
            val default = Speed.min(a.default, b.default)
            val trainTags = a.speedByTrainTag.keys union b.speedByTrainTag.keys
            val speedByTrainTag = mutableMapOf<String, Speed>()
            for (tag in trainTags) {
                val speedA = a.speedByTrainTag.getOrDefault(tag, a.default)
                val speedB = b.speedByTrainTag.getOrDefault(tag, b.default)
                speedByTrainTag[tag] = Speed.min(speedA, speedB)
            }
            return SpeedSection(default, speedByTrainTag)
        }
    }
}

class NeutralSection(
    val lowerPantograph: Boolean,
    val isAnnouncement: Boolean,
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is NeutralSection) return false
        if (lowerPantograph != other.lowerPantograph) return false
        if (isAnnouncement != other.isAnnouncement) return false
        return true
    }

    override fun hashCode(): Int {
        return Objects.hash(lowerPantograph, isAnnouncement)
    }

    override fun toString(): String {
        return "NeutralSection(lowerPantograph=$lowerPantograph, isAnnouncement=$isAnnouncement)"
    }
}

class RawInfraImpl(
    val trackNodePool: StaticPool<TrackNode, TrackNodeDescriptor>,
    val trackSectionPool: StaticPool<TrackSection, TrackSectionDescriptor>,
    val trackChunkPool: StaticPool<TrackChunk, TrackChunkDescriptor>,
    val nodeAtEndpoint: IdxMap<EndpointTrackSectionId, TrackNodeId>,
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
    val routeNameMap: Map<String, RouteId>,
    val dirDetEntryToRouteMap: Map<DirDetectorId, StaticIdxList<Route>>,
    val dirDetExitToRouteMap: Map<DirDetectorId, StaticIdxList<Route>>,
    val zoneNameMap: HashMap<String, ZoneId> = HashMap(),
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

    override fun getTrackSectionLength(trackSection: TrackSectionId): Length<TrackSection> {
        var length = Distance(0)
        for (trackChunk in getTrackSectionChunks(trackSection)) {
            length += getTrackChunkLength(trackChunk).distance
        }
        return Length(length)
    }

    override fun getTrackChunkLength(trackChunk: TrackChunkId): Length<TrackChunk> {
        return trackChunkPool[trackChunk].length
    }

    override fun getTrackChunkOffset(trackChunk: TrackChunkId): Offset<TrackSection> {
        return trackChunkPool[trackChunk].offset
    }

    override fun getTrackFromChunk(trackChunk: TrackChunkId): TrackSectionId {
        return trackChunkPool[trackChunk].track
    }

    override fun getTrackChunkOperationalPointParts(
        trackChunk: TrackChunkId
    ): StaticIdxList<OperationalPointPart> {
        return trackChunkPool[trackChunk].operationalPointParts
    }

    override fun getOperationalPointPartChunk(
        operationalPoint: OperationalPointPartId
    ): TrackChunkId {
        return operationalPointPartPool[operationalPoint].chunk
    }

    override fun getOperationalPointPartChunkOffset(
        operationalPoint: OperationalPointPartId
    ): Offset<TrackChunk> {
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

    override fun getTrackChunkLoadingGaugeConstraints(
        trackChunk: TrackChunkId
    ): DistanceRangeMap<LoadingGaugeConstraint> {
        return trackChunkPool[trackChunk].loadingGaugeConstraints
    }

    override fun getTrackChunkElectrificationVoltage(
        trackChunk: TrackChunkId
    ): DistanceRangeMap<String> {
        return trackChunkPool[trackChunk].electrificationVoltage
    }

    override fun getTrackChunkNeutralSections(
        trackChunk: DirTrackChunkId
    ): DistanceRangeMap<NeutralSection> {
        return trackChunkPool[trackChunk.value].neutralSections.get(trackChunk.direction)
    }

    override fun getTrackChunkSpeedSections(
        trackChunk: DirTrackChunkId
    ): DistanceRangeMap<SpeedSection> {
        return trackChunkPool[trackChunk.value].speedSections.get(trackChunk.direction)
    }

    override fun getTrackChunkSpeedSections(
        trackChunk: DirTrackChunkId,
        trainTag: String?
    ): DistanceRangeMap<Speed> {
        val res = distanceRangeMapOf<Speed>()
        for (entry in trackChunkPool[trackChunk.value].speedSections.get(trackChunk.direction)) {
            val speedSection = entry.value
            val allowedSpeed =
                speedSection.speedByTrainTag.getOrDefault(trainTag, speedSection.default)
            res.put(entry.lower, entry.upper, allowedSpeed)
        }
        return res
    }

    override fun getRoutesOnTrackChunk(trackChunk: DirTrackChunkId): StaticIdxList<Route> {
        return trackChunkPool[trackChunk.value].routes.get(trackChunk.direction)
    }

    override fun getRoutesStartingAtDet(dirDetector: DirDetectorId): StaticIdxList<Route> {
        return dirDetEntryToRouteMap.getOrDefault(dirDetector, MutableStaticIdxArrayList())
    }

    override fun getRoutesEndingAtDet(dirDetector: DirDetectorId): StaticIdxList<Route> {
        return dirDetExitToRouteMap.getOrDefault(dirDetector, MutableStaticIdxArrayList())
    }

    private val zoneDetectors: IdxMap<ZoneId, MutableList<DirDetectorId>> = IdxMap()
    private val parentSignalMap: IdxMap<LogicalSignalId, PhysicalSignalId> = IdxMap()

    init {
        // initialize the zone detector map
        for (zone in zonePool) zoneDetectors[zone] = mutableListOf()
        for (detector in detectorPool) {
            val nextZone = getNextZone(detector.increasing)
            if (nextZone != null) zoneDetectors[nextZone]!!.add(detector.increasing)
            val prevZone = getNextZone(detector.decreasing)
            if (prevZone != null) zoneDetectors[prevZone]!!.add(detector.decreasing)
        }

        // initialize zone names
        for (zone in zonePool) {
            val name =
                getZoneBounds(zone).map { "${getDetectorName(it.value)}:${it.direction}" }.sorted()

            zonePool[zone].name = "zone.${name}"
            zoneNameMap[zonePool[zone].name] = zone
        }

        // initialize the physical signal to logical signal map
        for (physicalSignal in physicalSignalPool) for (child in
            physicalSignalPool[physicalSignal].logicalSignals) parentSignalMap[child] =
            physicalSignal
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
        for (link in trackNodePool[trackNode].configs[config].portLinks) {
            if (link.first == entryPort) return OptStaticIdx(link.second.index)
            if (link.second == entryPort) return OptStaticIdx(link.first.index)
        }
        return OptStaticIdx()
    }

    override fun getTrackNodeDelay(trackNode: TrackNodeId): Duration {
        return trackNodePool[trackNode].delay
    }

    override fun getTrackNodeConfigName(trackNode: TrackNodeId, config: TrackNodeConfigId): String {
        return trackNodePool[trackNode].configs[config].name
    }

    override fun getTrackNodeName(trackNode: TrackNodeId): String {
        return trackNodePool[trackNode].name
    }

    override val zones: StaticIdxSpace<Zone>
        get() = zonePool.space()

    override fun getMovableElements(zone: ZoneId): StaticIdxSortedSet<TrackNode> {
        return zonePool[zone].movableElements
    }

    override fun getZoneBounds(zone: ZoneId): List<DirDetectorId> {
        return zoneDetectors[zone]!!
    }

    override fun getZoneName(zone: ZoneId): String {
        return zonePool[zone].name
    }

    override fun getZoneFromName(name: String): ZoneId {
        return zoneNameMap[name]!!
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
        currentTrack: DirTrackSectionId,
        config: TrackNodeConfigId
    ): OptDirTrackSectionId {
        val currentPort = getNextTrackNodePort(currentTrack)
        if (currentPort.isNone) return OptDirTrackSectionId()
        val optTrackNode = getNextTrackNode(currentTrack)
        assert(!optTrackNode.isNone)
        val trackNode = optTrackNode.asIndex()
        val nextPort = getTrackNodeExitPort(trackNode, config, currentPort.asIndex())
        if (nextPort.isNone) return OptDirTrackSectionId()
        val nextEndpoint = trackNodePool[trackNode].ports[nextPort.asIndex()]
        return OptDirTrackSectionId(nextEndpoint.value, nextEndpoint.endpoint.directionAway)
    }

    override fun getNextTrackNode(trackSection: DirTrackSectionId): OptStaticIdx<TrackNode> {
        val res = nodeAtEndpoint[trackSection.toEndpoint] ?: return OptStaticIdx()
        return OptStaticIdx(res.index)
    }

    override fun getNextTrackNodePort(
        trackSection: DirTrackSectionId
    ): OptStaticIdx<TrackNodePort> {
        val node = getNextTrackNode(trackSection)
        if (node.isNone) return OptStaticIdx()
        val nodeDescriptor = trackNodePool[node.asIndex()]
        val trackEndpoint = trackSection.toEndpoint
        for (i in 0u until nodeDescriptor.ports.size) {
            val id = StaticIdx<TrackNodePort>(i)
            if (nodeDescriptor.ports[id] == trackEndpoint) return OptStaticIdx(id.index)
        }
        return OptStaticIdx()
    }

    override fun getPortConnection(
        trackNode: TrackNodeId,
        port: TrackNodePortId
    ): EndpointTrackSectionId {
        return trackNodePool[trackNode].ports[port]
    }

    override fun getSignals(zonePath: ZonePathId): StaticIdxList<PhysicalSignal> {
        return zonePathPool[zonePath].signals
    }

    override fun getSignalPositions(zonePath: ZonePathId): OffsetList<ZonePath> {
        return zonePathPool[zonePath].signalPositions
    }

    override fun getSpeedLimits(route: RouteId): StaticIdxList<SpeedLimit> {
        return routeDescriptors[route].speedLimits
    }

    override fun getSpeedLimitStarts(route: RouteId): OffsetList<Route> {
        return routeDescriptors[route].speedLimitStarts
    }

    override fun getSpeedLimitEnds(route: RouteId): OffsetList<Route> {
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

    override fun getZonePathLength(zonePath: ZonePathId): Length<ZonePath> {
        return zonePathPool[zonePath].length
    }

    override fun getZonePathMovableElements(zonePath: ZonePathId): StaticIdxList<TrackNode> {
        return zonePathPool[zonePath].movableElements
    }

    override fun getZonePathMovableElementsConfigs(
        zonePath: ZonePathId
    ): StaticIdxList<TrackNodeConfig> {
        return zonePathPool[zonePath].movableElementsConfigs
    }

    override fun getZonePathMovableElementsPositions(zonePath: ZonePathId): OffsetList<ZonePath> {
        return zonePathPool[zonePath].movableElementsPositions
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

    override fun getRouteLength(route: RouteId): Length<Route> {
        return routeDescriptors[route].length
    }

    override fun getRouteFromName(name: String): RouteId {
        return routeNameMap[name] ?: throw OSRDError(ErrorType.UnknownRoute)
    }

    override fun getRouteReleaseZones(route: RouteId): IntArray {
        return routeDescriptors[route].releaseZones
    }

    override fun getChunksOnRoute(route: RouteId): DirStaticIdxList<TrackChunk> {
        return routeDescriptors[route].chunks
    }
}
