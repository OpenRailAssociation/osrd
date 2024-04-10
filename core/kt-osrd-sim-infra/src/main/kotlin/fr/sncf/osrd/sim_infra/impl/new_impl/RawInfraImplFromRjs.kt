package fr.sncf.osrd.sim_infra.impl.new_impl

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DirectionalMap
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.*
import kotlin.collections.HashMap
import kotlin.time.Duration
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

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
    val detectors: StaticIdxList<Detector>,
    val detectorsOffsets: OffsetList<TrackSection>,
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

class RouteDescriptor(
    val name: String?,
    var length: Length<Route>,
    val path: StaticIdxList<ZonePath>,
    val releaseZones: IntArray,
    val speedLimits: StaticIdxList<SpeedLimit>,
    val speedLimitStarts: OffsetList<Route>,
    val speedLimitEnds: OffsetList<Route>,
    val chunks: DirStaticIdxList<TrackChunk>,
)

class LogicalSignalDescriptor(
    val signalingSystemId: String,
    val nextSignalingSystemIds: List<String>,
    val rawSettings: Map<String, String>,
    val rawParameters: RawSignalParameters,
)

class PhysicalSignalDescriptor(
    val name: String?,
    val dirTrackSectionId: DirTrackSectionId,
    val undirectedTrackOffset: Offset<TrackSection>,
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
    movableElements: StaticIdxList<TrackNode>,
    movableElementsConfigs: StaticIdxList<TrackNodeConfig>,
    val movableElementsPositions: OffsetList<ZonePath>,
    val chunks: DirStaticIdxList<TrackChunk>,
) : ZonePathSpec(entry, exit, movableElements, movableElementsConfigs)

class OperationalPointPartDescriptor(
    val name: String,
    val chunkOffset: Offset<TrackChunk>,
    val chunk: TrackChunkId,
)

class ZonePathCache(
    val length: Length<ZonePath>,
    val signals: StaticIdxList<PhysicalSignal>,
    val signalPositions: OffsetList<ZonePath>,
)

data class TrackChunkSignal(
    val directedOffset: Offset<DirTrackChunkId>,
    val signal: PhysicalSignalId,
)

class DetectorDescriptor(
    val trackSection: TrackSectionId,
    val offset: Offset<TrackSection>,
    val names: List<String>,
)

class RawInfraImplFromRjs(
    private val trackNodePool: StaticPool<TrackNode, TrackNodeDescriptor>,
    private val trackSectionPool: StaticPool<TrackSection, TrackSectionDescriptor>,
    private val trackChunkPool: StaticPool<TrackChunk, TrackChunkDescriptor>,
    private val nodeAtEndpoint: IdxMap<EndpointTrackSectionId, TrackNodeId>,
    private val zonePool: StaticPool<Zone, ZoneDescriptor>,
    private val detectorPool: StaticPool<Detector, DetectorDescriptor>,
    private val nextZones: IdxMap<DirDetectorId, ZoneId>,
    private val routePool: StaticPool<Route, RouteDescriptor>,
    private val logicalSignalPool: StaticPool<LogicalSignal, LogicalSignalDescriptor>,
    private val physicalSignalPool: StaticPool<PhysicalSignal, PhysicalSignalDescriptor>,
    private val zonePathPool: StaticPool<ZonePath, ZonePathDescriptor>,
    private val zonePathMap: Map<ZonePathSpec, ZonePathId>,
    private val operationalPointPartPool:
        StaticPool<OperationalPointPart, OperationalPointPartDescriptor>,
    private val trackSectionNameMap: Map<String, TrackSectionId>,
    private val routeNameMap: Map<String, RouteId>,
    private val dirDetEntryToRouteMap: Map<DirDetectorId, StaticIdxList<Route>>,
    private val dirDetExitToRouteMap: Map<DirDetectorId, StaticIdxList<Route>>,
) : RawInfra {
    private val zoneNameMap: HashMap<String, ZoneId> = HashMap()
    private val cachePerDirTrackChunk = IdxMap<DirTrackChunkId, MutableList<TrackChunkSignal>>()
    private val cachePerZonePath: StaticPool<ZonePath, ZonePathCache>
    private val trackChunksBounds =
        trackSectionPool.map {
            val chunkCount = it.chunks.size
            val bounds = MutableOffsetArray<TrackSection>(chunkCount + 1) { Offset(Distance.ZERO) }
            var curOffset = Offset<TrackSection>(Distance.ZERO)
            for (i in 0 until chunkCount) {
                curOffset += getTrackChunkLength(it.chunks[i]).distance
                bounds[i + 1] = curOffset
            }
            bounds.immutableCopyOf()
        }

    override val trackNodes: StaticIdxSpace<TrackNode>
        get() = trackNodePool.space()

    override val trackSections: StaticIdxSpace<TrackSection>
        get() = trackSectionPool.space()

    private val zoneDetectors: IdxMap<ZoneId, MutableList<DirDetectorId>> = IdxMap()
    private val parentSignalMap: IdxMap<LogicalSignalId, PhysicalSignalId> = IdxMap()

    private fun findChunkIndex(
        dirTrackSection: DirTrackSectionId,
        offset: Offset<TrackSection>
    ): Int {
        val chunkBounds = trackChunksBounds[dirTrackSection.value]
        return chunkBounds.findSegment(offset, dirTrackSection.direction)
    }

    private fun findChunkOffset(
        trackSection: TrackSectionId,
        chunkIndex: Int,
        trackSectionOffset: Offset<TrackSection>
    ): Offset<TrackChunk> {
        val chunkBounds = trackChunksBounds[trackSection]
        assert(chunkIndex < (trackChunksBounds.size.toInt() - 1))
        val chunkStart = chunkBounds[chunkIndex]
        val chunkEnd = chunkBounds[chunkIndex + 1]
        val chunkLen = chunkEnd - chunkStart
        val chunkOffset = trackSectionOffset - chunkStart
        assert(chunkOffset >= 0.meters && chunkOffset <= chunkLen)
        return Offset(chunkOffset)
    }

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

        for (zone in zonePool) {
            if (getZoneBounds(zone).size < 2) {
                logger.warn {
                    val detectorNames = getZoneBounds(zone).map { detectorPool[it.value] }
                    val nodeNames = getMovableElements(zone).map { trackNodePool[it].name }
                    "Invalid detection zone delimited by detector(s) $detectorNames and containing node(s) $nodeNames"
                }
            }
        }

        // build a map from DirTrackChunk to PhysicalSignal and position
        for (physicalSignalId in physicalSignalPool) {
            val physicalSignal = physicalSignalPool[physicalSignalId]
            val dirTrack = physicalSignal.dirTrackSectionId
            val trackOffset = physicalSignal.undirectedTrackOffset
            val signalChunkIndex = findChunkIndex(dirTrack, trackOffset)
            val undirectedSignalChunkOffset =
                findChunkOffset(dirTrack.value, signalChunkIndex, trackOffset)
            val trackChunk = getTrackSectionChunks(dirTrack.value)[signalChunkIndex]
            val dirTrackChunk = DirTrackChunkId(trackChunk, dirTrack.direction)
            val trackChunkSignals =
                cachePerDirTrackChunk.getOrPut(dirTrackChunk) { mutableListOf() }
            val directedSignalChunkOffset =
                Offset<DirTrackChunkId>(
                    when (dirTrackChunk.direction) {
                        Direction.INCREASING -> undirectedSignalChunkOffset.distance
                        Direction.DECREASING ->
                            getTrackChunkLength(trackChunk) - undirectedSignalChunkOffset
                    }
                )
            trackChunkSignals.add(TrackChunkSignal(directedSignalChunkOffset, physicalSignalId))
        }

        // for each DirTrackChunk, sort signals by position
        for (trackChunk in trackChunkPool) {
            cachePerDirTrackChunk[trackChunk.increasing]?.sortBy { it.directedOffset }
            cachePerDirTrackChunk[trackChunk.decreasing]?.sortBy { it.directedOffset }
        }

        // for each zone, precompute its length and the offset of signals
        cachePerZonePath =
            zonePathPool.map {
                var zonePathLength = Length<ZonePath>(0.meters)
                val signals = mutableStaticIdxArrayListOf<PhysicalSignal>()
                val signalPositions = mutableOffsetArrayListOf<ZonePath>()
                for (dirChunk in it.chunks) {
                    val chunkDescriptor = trackChunkPool[dirChunk.value]
                    val chunkLength = chunkDescriptor.length
                    val trackChunkSignals = cachePerDirTrackChunk[dirChunk]
                    if (trackChunkSignals != null)
                        for (chunkSignal in trackChunkSignals) {
                            val signalZonePathOffset =
                                zonePathLength + chunkSignal.directedOffset.distance

                            // skip signals which are at position zero. This hack is related to the
                            // other hack
                            // below, and can also be removed once detectors / signals are not
                            // allowed to be on switches,
                            // and merging of track sections connected by links is implemented.
                            assert(signalZonePathOffset >= Offset(0.meters))
                            if (signalZonePathOffset.distance.millimeters == 0L) continue

                            signals.add(chunkSignal.signal)
                            signalPositions.add(signalZonePathOffset)
                        }
                    zonePathLength += chunkLength.distance
                }

                // if the zone path switches to a new track section, then ends with a detector at
                // the exact start of
                // this track section, fetch signals on the starting chunk aligned with the zone
                // path.
                // This hack is required while detectors / signals are allowed to be on switches,
                // and merging of
                // track sections connected by links is unimplemented.
                val lastChunkTrackSection =
                    trackChunkPool[it.chunks[it.chunks.size - 1].value].track
                val endDetector = it.exit
                val endDetectorDescriptor = detectorPool[endDetector.value]
                val endDetectorTrackSection = endDetectorDescriptor.trackSection
                if (lastChunkTrackSection != endDetectorTrackSection) {
                    // this case should only happen if the detector is _just_ where it shouldn't be:
                    // on a switch
                    assert(
                        endDetectorDescriptor.offset ==
                            when (endDetector.direction) {
                                Direction.INCREASING -> Offset(0.meters)
                                Direction.DECREASING ->
                                    getTrackSectionLength(endDetectorTrackSection)
                            }
                    )

                    // find the chunk where the extra signals may be
                    val chunks = trackSectionPool[endDetectorTrackSection].chunks
                    val extraTrackChunk =
                        when (endDetector.direction) {
                            Direction.INCREASING -> chunks[0].increasing
                            Direction.DECREASING -> chunks[chunks.size - 1].decreasing
                        }

                    // add all signals touching the node
                    val trackChunkSignals = cachePerDirTrackChunk[extraTrackChunk]
                    if (trackChunkSignals != null) {
                        for (signal in trackChunkSignals) {
                            if (signal.directedOffset.distance == 0.meters) {
                                signals.add(signal.signal)
                                signalPositions.add(zonePathLength)
                            }
                        }
                    }
                }
                ZonePathCache(zonePathLength, signals, signalPositions)
            }

        // initialize the physical signal to logical signal map
        for (physicalSignal in physicalSignalPool) {
            for (child in physicalSignalPool[physicalSignal].logicalSignals) {
                parentSignalMap[child] = physicalSignal
            }
        }
    }

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
        val chunkBounds = trackChunksBounds[trackSection]
        return chunkBounds[chunkBounds.size - 1]
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

    override fun getDetectorName(det: DetectorId): String {
        // as duplicate detectors are merged, they can have multiple names.
        // the list of names has to be sorted, and we just take the first one. it shouldn't matter.
        return detectorPool[det].names[0]
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
        return cachePerZonePath[zonePath].signals
    }

    override fun getSignalPositions(zonePath: ZonePathId): OffsetList<ZonePath> {
        return cachePerZonePath[zonePath].signalPositions
    }

    override fun getSpeedLimits(route: RouteId): StaticIdxList<SpeedLimit> {
        return routePool[route].speedLimits
    }

    override fun getSpeedLimitStarts(route: RouteId): OffsetList<Route> {
        return routePool[route].speedLimitStarts
    }

    override fun getSpeedLimitEnds(route: RouteId): OffsetList<Route> {
        return routePool[route].speedLimitEnds
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

    override fun getRawParameters(signal: LogicalSignalId): RawSignalParameters {
        return logicalSignalPool[signal].rawParameters
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
        return cachePerZonePath[zonePath].length
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
        get() = routePool.space()

    override fun getRoutePath(route: RouteId): StaticIdxList<ZonePath> {
        return routePool[route].path
    }

    override fun getRouteName(route: RouteId): String? {
        return routePool[route].name
    }

    override fun getRouteLength(route: RouteId): Length<Route> {
        return routePool[route].length
    }

    override fun getRouteFromName(name: String): RouteId {
        return routeNameMap[name] ?: throw OSRDError(ErrorType.UnknownRoute)
    }

    override fun getRouteReleaseZones(route: RouteId): IntArray {
        return routePool[route].releaseZones
    }

    override fun getChunksOnRoute(route: RouteId): DirStaticIdxList<TrackChunk> {
        return routePool[route].chunks
    }
}
