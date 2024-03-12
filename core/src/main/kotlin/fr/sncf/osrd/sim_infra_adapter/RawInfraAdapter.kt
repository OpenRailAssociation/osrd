package fr.sncf.osrd.sim_infra_adapter

import com.google.common.collect.BiMap
import com.google.common.collect.HashBiMap
import com.google.common.collect.ImmutableList
import fr.sncf.osrd.infra.api.Direction
import fr.sncf.osrd.infra.api.reservation.DiDetector
import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import fr.sncf.osrd.infra.api.tracks.undirected.Detector
import fr.sncf.osrd.infra.api.tracks.undirected.Switch
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchBranch
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchPort
import fr.sncf.osrd.infra.api.tracks.undirected.TrackEdge
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection
import fr.sncf.osrd.infra.implementation.tracks.directed.DiTrackEdgeImpl
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal
import fr.sncf.osrd.sim_infra.api.DetectorId
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.api.EndpointTrackSectionId
import fr.sncf.osrd.sim_infra.api.PhysicalSignal
import fr.sncf.osrd.sim_infra.api.PhysicalSignalId
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.RouteId
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.api.TrackChunkId
import fr.sncf.osrd.sim_infra.api.TrackNode
import fr.sncf.osrd.sim_infra.api.TrackNodeConfig
import fr.sncf.osrd.sim_infra.api.TrackNodeConfigId
import fr.sncf.osrd.sim_infra.api.TrackNodeId
import fr.sncf.osrd.sim_infra.api.TrackNodePortId
import fr.sncf.osrd.sim_infra.api.TrackSectionId
import fr.sncf.osrd.sim_infra.api.ZonePath
import fr.sncf.osrd.sim_infra.api.ZonePathId
import fr.sncf.osrd.sim_infra.api.decreasing
import fr.sncf.osrd.sim_infra.api.increasing
import fr.sncf.osrd.sim_infra.impl.NeutralSection as SimNeutralSection
import fr.sncf.osrd.sim_infra.impl.RawInfraBuilder
import fr.sncf.osrd.sim_infra.impl.RawInfraBuilderImpl
import fr.sncf.osrd.sim_infra.impl.SpeedSection
import fr.sncf.osrd.sim_infra.impl.TrackSectionBuilder
import fr.sncf.osrd.utils.DirectionalMap
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.Endpoint
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.MutableOffsetArrayList
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.metersPerSecond
import kotlin.collections.set
import kotlin.time.Duration.Companion.seconds

class SimInfraAdapter(
    val simInfra: RawInfra,
    val detectorMap: BiMap<Detector, DetectorId>,
    val trackNodeMap: BiMap<Switch, TrackNodeId>,
    val trackNodeGroupsMap: Map<Switch, Map<String, TrackNodeConfigId>>,
    val routeMap: BiMap<ReservationRoute, RouteId>,
    val signalMap: BiMap<String, PhysicalSignalId>,
    val rjsSignalMap: BiMap<String, RJSSignal>
) : RawInfra by simInfra

class TrackRangeViewIterator(private val views: ImmutableList<TrackRangeView>) {
    private var index: Int = 0
    val view: TrackRangeView
        get() = views[index]

    fun next() {
        index++
    }
}

data class TrackSignal(
    val position: Distance,
    val direction: Direction,
    val signal: PhysicalSignalId
)

fun adaptRawInfra(infra: SignalingInfra): SimInfraAdapter {
    val builder = RawInfraBuilderImpl()
    val detectorMap = HashBiMap.create<Detector, DetectorId>()
    val trackNodeMap = HashBiMap.create<Switch, TrackNodeId>()
    val trackSectionMap = HashBiMap.create<TrackEdge, TrackSectionId>()
    val trackNodeGroupsMap = mutableMapOf<Switch, Map<String, TrackNodeConfigId>>()
    val signalsPerTrack: MutableMap<String, MutableList<TrackSignal>> = mutableMapOf()
    val signalMap = HashBiMap.create<String, PhysicalSignalId>()
    val rjsSignalMap = HashBiMap.create<String, RJSSignal>()
    val routeMap = HashBiMap.create<ReservationRoute, RouteId>()
    val trackChunkMap = mutableMapOf<TrackSection, Map<Distance, TrackChunkId>>()

    // parse tracks
    for (edge in infra.trackGraph.edges()) {
        val track = edge as? TrackSection
        if (track != null) {
            val trackLength = track.length.meters
            var lastOffset = 0.meters
            trackSectionMap[track] =
                builder.trackSection(track.id) {
                    val chunkMap = mutableMapOf<Distance, TrackChunkId>()
                    for (d in track.detectors) {
                        val detectorId = builder.detector(d.id)
                        detectorMap[d] = detectorId
                        val endOffset = d.offset.meters
                        makeChunk(
                            builder,
                            track,
                            lastOffset,
                            endOffset,
                            this@trackSection,
                            chunkMap
                        )
                        lastOffset = endOffset
                    }
                    makeChunk(builder, track, lastOffset, trackLength, this@trackSection, chunkMap)
                    trackChunkMap[track] = chunkMap
                }
        }
    }

    // parse operational points
    for (track in infra.trackGraph.edges()) for (op in track.operationalPoints) {
        val (chunkId, offset) = getChunkLocation(track, op.offset.meters, trackChunkMap)
        builder.operationalPointPart(op.id, offset, chunkId)
    }

    // parse switches
    for (switchEntry in infra.switches) {
        val oldSwitch = switchEntry.value!!
        val nodeGraph = oldSwitch.graph!!
        val infraGraph = infra.trackGraph!!
        trackNodeMap[oldSwitch] =
            builder.movableElement(oldSwitch.id, oldSwitch.groupChangeDelay.seconds) {
                val nodeMap: MutableMap<SwitchPort, TrackNodePortId> = mutableMapOf()
                for (node in nodeGraph.nodes()) {
                    var track: TrackEdge? = null
                    for (edge in infraGraph.incidentEdges(node)) {
                        if (edge is TrackSection) {
                            track = edge
                            break
                        }
                    }
                    track!!
                    val endpoint =
                        if (infraGraph.incidentNodes(track).nodeU() == node) Endpoint.START
                        else Endpoint.END
                    nodeMap[node] = port(EndpointTrackSectionId(trackSectionMap[track]!!, endpoint))
                }
                val switchGroups = mutableMapOf<String, TrackNodeConfigId>()
                for (group in oldSwitch.groups.entries()) {
                    val groupName = group.key!!
                    val nodes = nodeGraph.incidentNodes(group.value!!)
                    val portPair = Pair(nodeMap[nodes.nodeU()]!!, nodeMap[nodes.nodeV()]!!)
                    switchGroups[groupName] = config(groupName, portPair)
                }
                trackNodeGroupsMap[oldSwitch] = switchGroups
            }
    }

    fun getOrCreateDet(oldDiDetector: DiDetector): DirDetectorId {
        val oldDetector = oldDiDetector.detector
        val detector = detectorMap[oldDetector!!]!!
        return when (oldDiDetector.direction!!) {
            Direction.FORWARD -> detector.increasing
            Direction.BACKWARD -> detector.decreasing
        }
    }

    // create zones
    for (detectionSection in infra.detectionSections) {
        val oldSwitches = detectionSection!!.switches!!
        val oldDiDetectors = detectionSection.detectors!!
        val switches = oldSwitches.map { trackNodeMap[it]!! }.toList()
        val detectors = mutableListOf<DirDetectorId>()
        for (oldDiDetector in oldDiDetectors) detectors.add(getOrCreateDet(oldDiDetector!!))
        builder.zone(switches, detectors)
    }

    // parse signals
    for (rjsSignal in infra.signalMap.keys()) {
        rjsSignalMap[rjsSignal.id] = rjsSignal
        val trackSignals = signalsPerTrack.getOrPut(rjsSignal.track!!) { mutableListOf() }
        val signalId =
            builder.physicalSignal(rjsSignal.id, rjsSignal.sightDistance.meters) {
                if (rjsSignal.logicalSignals == null) return@physicalSignal
                for (rjsLogicalSignal in rjsSignal.logicalSignals) {
                    assert(
                        rjsLogicalSignal.signalingSystem != null &&
                            rjsLogicalSignal.signalingSystem.isNotEmpty()
                    )
                    assert(rjsLogicalSignal.nextSignalingSystems != null)
                    assert(rjsLogicalSignal.settings != null)
                    for (sigSystem in rjsLogicalSignal.nextSignalingSystems) assert(
                        sigSystem.isNotEmpty()
                    )
                    logicalSignal(
                        rjsLogicalSignal.signalingSystem,
                        rjsLogicalSignal.nextSignalingSystems,
                        rjsLogicalSignal.settings
                    )
                }
            }
        signalMap[rjsSignal.id] = signalId
        trackSignals.add(
            TrackSignal(
                rjsSignal.position.meters,
                Direction.fromEdgeDir(rjsSignal.direction),
                signalId
            )
        )
    }

    // sort signals by tracks
    for (trackSignals in signalsPerTrack.values) trackSignals.sortBy { it.position }

    // translate routes
    for (route in infra.reservationRouteMap.values) {
        routeMap[route] =
            builder.route(route.id) {
                val oldPath = route.detectorPath!!
                val oldReleasePoints = route.releasePoints!!
                val viewIterator = TrackRangeViewIterator(route!!.trackRanges)

                // as we iterate over the detection sections, we need to compute the length of each
                // detection section path as well as the position of switches contained within.
                // sadly, these two iteration processes were combined by the idiot behind this code:
                // myself
                // parse the zone path and switch positions for this route
                var releaseIndex = 0
                for (startDetIndex in 0 until oldPath.size - 1) {
                    val oldStartDet = oldPath[startDetIndex]
                    val oldEndDet = oldPath[startDetIndex + 1]
                    val entry = getOrCreateDet(oldStartDet)
                    val exit = getOrCreateDet(oldEndDet)
                    val zonePathId =
                        buildZonePath(
                            viewIterator,
                            oldStartDet,
                            oldEndDet,
                            entry,
                            exit,
                            trackNodeMap,
                            trackNodeGroupsMap,
                            trackChunkMap,
                            signalsPerTrack,
                            builder
                        )

                    // check if the zone is a release zone
                    if (
                        releaseIndex < oldReleasePoints.size &&
                            oldEndDet.detector!! == oldReleasePoints[releaseIndex]
                    ) {
                        releaseZone(startDetIndex)
                        releaseIndex++
                    }
                    this@route.zonePath(zonePathId)
                }

                // if the old route did not have a release point at its last detector,
                // add the missing implicit end release point
                if (
                    oldReleasePoints.isEmpty() || oldReleasePoints.last() != oldPath.last().detector
                ) {
                    releaseZone(oldPath.size - 2)
                }
            }
    }

    // TODO: check the length of built routes is the same as on the base infra
    // assert(route.length.meters == routeLength)

    return SimInfraAdapter(
        builder.build(),
        detectorMap,
        trackNodeMap,
        trackNodeGroupsMap,
        routeMap,
        signalMap,
        rjsSignalMap
    )
}

private fun makeChunk(
    builder: RawInfraBuilderImpl,
    track: TrackSection,
    startOffset: Distance,
    endOffset: Distance,
    trackSectionBuilder: TrackSectionBuilder,
    chunkMap: MutableMap<Distance, TrackChunkId>
) {
    if (startOffset == endOffset) return
    val rangeViewForward =
        TrackRangeView(
            startOffset.meters,
            endOffset.meters,
            DiTrackEdgeImpl(track, Direction.FORWARD)
        )
    val rangeViewBackward =
        TrackRangeView(
            startOffset.meters,
            endOffset.meters,
            DiTrackEdgeImpl(track, Direction.BACKWARD)
        )

    fun <T> makeDirectionalMap(f: (range: TrackRangeView) -> T): DirectionalMap<T> {
        return DirectionalMap(f.invoke(rangeViewForward), f.invoke(rangeViewBackward))
    }

    fun makeSpeedSections(range: TrackRangeView): DistanceRangeMap<SpeedSection> {
        val res = distanceRangeMapOf<SpeedSection>()
        for (entry in range.speedSections.asMapOfRanges()) {
            val legacySpeedLimit = entry.value
            val map =
                legacySpeedLimit.speedLimitByTag.mapValues { mapEntry ->
                    mapEntry.value!!.metersPerSecond
                }
            res.put(
                entry.key.lowerEndpoint().meters,
                entry.key.upperEndpoint().meters,
                SpeedSection(legacySpeedLimit.defaultSpeedLimit.metersPerSecond, map)
            )
        }
        return res
    }

    fun makeNeutralSection(range: TrackRangeView): DistanceRangeMap<SimNeutralSection> {
        val res = distanceRangeMapOf<SimNeutralSection>()
        for ((rangeMap, isAnnouncement) in
            listOf(
                Pair(range.neutralSections, false),
                Pair(range.neutralSectionAnnouncements, true),
            )) {
            for (entry in rangeMap.asMapOfRanges()) {
                val legacyNeutralSection = entry.value
                res.put(
                    entry.key.lowerEndpoint().meters,
                    entry.key.upperEndpoint().meters,
                    SimNeutralSection(legacyNeutralSection.lowerPantograph, isAnnouncement)
                )
            }
        }
        return res
    }

    val chunkId =
        builder.trackChunk(
            rangeViewForward.geo,
            makeDirectionalMap { range -> DistanceRangeMapImpl.from(range.slopes) },
            Length(endOffset - startOffset),
            Offset(startOffset),
            makeDirectionalMap { range -> DistanceRangeMapImpl.from(range.curves) },
            makeDirectionalMap { range -> DistanceRangeMapImpl.from(range.gradients) },
            DistanceRangeMapImpl.from(rangeViewForward.blockedGaugeTypes),
            DistanceRangeMapImpl.from(rangeViewForward.electrificationVoltages),
            makeDirectionalMap { range -> makeNeutralSection(range) },
            makeDirectionalMap { range -> makeSpeedSections(range) },
        )
    trackSectionBuilder.chunk(chunkId)
    chunkMap[startOffset] = chunkId
}

private fun buildZonePath(
    viewIterator: TrackRangeViewIterator,
    oldStartDet: DiDetector,
    oldEndDet: DiDetector,
    entry: DirDetectorId,
    exit: DirDetectorId,
    trackNodeMap: HashBiMap<Switch, TrackNodeId>,
    trackNodeGroupsMap: MutableMap<Switch, Map<String, TrackNodeConfigId>>,
    trackChunkMap: MutableMap<TrackSection, Map<Distance, TrackChunkId>>,
    signalsPerTrack: Map<String, MutableList<TrackSignal>>,
    builder: RawInfraBuilder
): ZonePathId {
    // at this point, we have trackRangeIndex pointing to the track range which contains the entry
    // detector
    // we need iterate on track range until we reach the track range which contains the end
    // detector.
    // meanwhile, we also need to:
    // 1) locate switches inside the zone path
    // 2) compute the length of each zone path
    // 3) compute the zone path's track section path in order to find signals

    var zonePathLength = Offset<ZonePath>(0.meters)
    val movableElements = MutableStaticIdxArrayList<TrackNode>()
    val movableElementsConfigs = MutableStaticIdxArrayList<TrackNodeConfig>()
    val movableElementsDistances = MutableOffsetArrayList<ZonePath>()

    val zoneTrackPath = mutableListOf<ZonePathTrackSpan>()
    assert(viewIterator.view.track.edge == oldStartDet.detector.trackSection)
    if (oldStartDet.detector.trackSection == oldEndDet.detector.trackSection) {
        val track = oldStartDet.detector.trackSection
        // if the start and end detectors are on the same track, we don't need to increment anything
        assert(viewIterator.view.track.edge == track)
        val startOffset = oldStartDet.detector.offset.meters
        val endOffset = oldEndDet.detector.offset.meters
        val span =
            if (startOffset < endOffset)
                ZonePathTrackSpan(track, startOffset, endOffset, Direction.FORWARD)
            else ZonePathTrackSpan(track, endOffset, startOffset, Direction.BACKWARD)
        zoneTrackPath.add(span)
        zonePathLength += span.length
    } else {
        // when the start and end detectors are not on the same track
        while (true) {
            val curView = viewIterator.view
            val edge = curView.track!!.edge
            if (edge is SwitchBranch) {
                // We assume SwitchBranch have zero length
                assert(curView.end.meters == curView.begin.meters)
                // We assume paths do not end on a SwitchBranch
                assert(curView.track.edge != oldEndDet.detector.trackSection)
                val movableElement = trackNodeMap[edge.switch]!!
                val branchGroup = edge.switch!!.findBranchGroup(edge)!!
                val movableElementConfig = trackNodeGroupsMap[edge.switch]!![branchGroup]!!
                movableElements.add(movableElement)
                movableElementsConfigs.add(movableElementConfig)
                movableElementsDistances.add(zonePathLength)
                viewIterator.next()
                continue
            }
            val trackSection = edge as TrackSection
            val trackSpan = zonePathTrackSpan(trackSection, curView, oldStartDet, oldEndDet)
            zoneTrackPath.add(trackSpan)
            zonePathLength += trackSpan.length

            if (curView.track.edge == oldEndDet.detector.trackSection) {
                break
            }
            viewIterator.next()
        }
    }

    // iterate on the route's track ranges, and fetch the signals which belong there
    data class ZonePathSignal(val position: Offset<ZonePath>, val signal: PhysicalSignalId)

    val zonePathSignals: MutableList<ZonePathSignal> = mutableListOf()
    // the current position along the route, in millimeters
    var zonePathPosition = Offset<ZonePath>(Distance.ZERO)
    for (range in zoneTrackPath) {
        val edge = range.track
        val rangeBegin = range.begin
        val rangeEnd = range.end
        val trackSignals = signalsPerTrack[edge.id]
        if (trackSignals == null) {
            zonePathPosition += (rangeEnd - rangeBegin)
            continue
        }

        for (trackSignal in trackSignals) {
            // if the signal is not visible along the route's path, ignore it
            if (trackSignal.direction != range.direction) continue
            if (trackSignal.position < rangeBegin || trackSignal.position > rangeEnd) continue

            // compute the signal's position relative to the start of the zone path range
            val sigRangeStartDistance =
                if (trackSignal.direction == Direction.FORWARD) trackSignal.position - rangeBegin
                else rangeEnd - trackSignal.position

            val position = zonePathPosition + sigRangeStartDistance
            if (position.distance == Distance.ZERO) continue

            zonePathSignals.add(ZonePathSignal(position, trackSignal.signal))
        }
        zonePathPosition += (rangeEnd - rangeBegin)
    }

    val zoneLength = zonePathPosition

    zonePathSignals.sortBy { it.position }
    val signals = MutableStaticIdxArrayList<PhysicalSignal>()
    val signalPositions = MutableOffsetArrayList<ZonePath>()
    for (zonePathSignal in zonePathSignals) {
        assert(zonePathSignal.position.distance >= Distance.ZERO)
        assert(zonePathSignal.position <= zoneLength)
        signals.add(zonePathSignal.signal)
        signalPositions.add(zonePathSignal.position)
    }

    // Build chunk list
    val chunks = MutableDirStaticIdxArrayList<TrackChunk>()
    for (range in zoneTrackPath) {
        if (range.begin == range.end) {
            // 0-length ranges can happen at track transition.
            // They can and should be ignored, adding the chunk starting there would add an extra
            // chunk.
            // We assert that we are at a track transition, and move on
            assert(range.end == range.track.length.meters || range.end == 0.meters)
        } else {
            val chunk = trackChunkMap[range.track]!![range.begin]!!
            chunks.add(DirStaticIdx(chunk, range.direction.toKtDirection()))
        }
    }

    return builder.zonePath(
        entry,
        exit,
        Length(zonePathLength.distance),
        movableElements,
        movableElementsConfigs,
        movableElementsDistances,
        signals,
        signalPositions,
        chunks
    )
}

/** begin < end */
data class ZonePathTrackSpan(
    val track: TrackSection,
    val begin: Distance,
    val end: Distance,
    val direction: Direction
) {
    val length
        get() = (begin - end).absoluteValue
}

/**
 * Compute the length of the part of a zone path segments which spans a given track. Only works for
 * zone paths which span multiple tracks.
 */
private fun zonePathTrackSpan(
    track: TrackSection,
    curView: TrackRangeView,
    oldStartDiDet: DiDetector,
    oldEndDiDet: DiDetector
): ZonePathTrackSpan {
    val oldStartDet = oldStartDiDet.detector
    val oldEndDet = oldEndDiDet.detector
    assert(oldStartDet.trackSection != oldEndDet.trackSection)
    val trackLen = track.length.meters
    val direction = curView.track.direction
    return if (track == oldStartDet.trackSection) {
        assert(direction == oldStartDiDet.direction)
        if (direction == Direction.FORWARD)
            ZonePathTrackSpan(track, oldStartDet.offset.meters, trackLen, Direction.FORWARD)
        else ZonePathTrackSpan(track, 0.meters, oldStartDet.offset.meters, Direction.BACKWARD)
    } else if (track == oldEndDet.trackSection) {
        assert(direction == oldEndDiDet.direction)
        if (direction == Direction.FORWARD)
            ZonePathTrackSpan(track, 0.meters, oldEndDet.offset.meters, Direction.FORWARD)
        else ZonePathTrackSpan(track, oldEndDet.offset.meters, trackLen, Direction.BACKWARD)
    } else {
        ZonePathTrackSpan(track, 0.meters, trackLen, direction)
    }
}

/**
 * From a track and an offset, returns the chunk ID and the offset compared to the start of the
 * chunk
 */
fun getChunkLocation(
    track: TrackEdge,
    offset: Distance,
    trackChunkMap: Map<TrackSection, Map<Distance, StaticIdx<TrackChunk>>>
): Pair<TrackChunkId, Offset<TrackChunk>> {
    val entries = trackChunkMap[track]!!.entries.sortedBy { entry -> entry.key }
    var i = 0
    while (i < entries.size - 1) {
        if (entries[i + 1].key > offset) break
        i++
    }
    return Pair(entries[i].value, Offset(offset - entries[i].key))
}
