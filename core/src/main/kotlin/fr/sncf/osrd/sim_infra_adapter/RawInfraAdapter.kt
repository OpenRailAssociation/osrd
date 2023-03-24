package fr.sncf.osrd.sim_infra_adapter

import com.google.common.collect.BiMap
import com.google.common.collect.HashBiMap
import com.google.common.collect.ImmutableList
import fr.sncf.osrd.infra.api.Direction
import fr.sncf.osrd.infra.api.reservation.DetectionSection
import fr.sncf.osrd.infra.api.reservation.DiDetector
import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import fr.sncf.osrd.infra.api.tracks.undirected.*
import fr.sncf.osrd.infra.api.tracks.undirected.Detector
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.RawInfraBuilder
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArraySetOf
import kotlin.time.Duration.Companion.seconds


class SimInfraAdapter(
    val simInfra: RawInfra,
    val zoneMap: BiMap<DetectionSection, ZoneId>,
    val detectorMap: BiMap<Detector, DetectorId>,
    val switchMap: BiMap<Switch, MovableElementId>,
    val switchGroupsMap: Map<Switch, Map<String, MovableElementConfigId>>,
    val routeMap: BiMap<ReservationRoute, RouteId>,
    val signalMap: Map<String, PhysicalSignalId>
) : RawInfra by simInfra


class TrackRangeViewIterator(private val views: ImmutableList<TrackRangeView>) {
    private var index: Int = 0
    val view get() = views[index]

    fun next() {
        index++
    }
}

data class TrackSignal(val position: Distance, val direction: Direction, val signal: PhysicalSignalId)


fun adaptRawInfra(infra: SignalingInfra): RawInfra {
    val builder = RawInfraBuilder()
    val zoneMap = HashBiMap.create<DetectionSection, ZoneId>()
    val detectorMap = HashBiMap.create<Detector, DetectorId>()
    val switchMap = HashBiMap.create<Switch, MovableElementId>()
    val switchGroupsMap = mutableMapOf<Switch, Map<String, MovableElementConfigId>>()
    val signalsPerTrack: MutableMap<String, MutableList<TrackSignal>> = mutableMapOf()
    val signalMap: MutableMap<String, PhysicalSignalId> = mutableMapOf()
    val routeMap = HashBiMap.create<ReservationRoute, RouteId>()

    // parse switches
    for (switchEntry in infra.switches) {
        val oldSwitch = switchEntry.value!!
        switchMap[oldSwitch] = builder.movableElement(oldSwitch.groupChangeDelay.seconds) {
            val switchGroups = mutableMapOf<String, MovableElementConfigId>()
            for (group in oldSwitch.groups.entries()) {
                val groupName = group.key!!
                switchGroups[groupName] = config(groupName)
            }
            switchGroupsMap[oldSwitch] = switchGroups
        }
    }

    fun getOrCreateDet(oldDiDetector: DiDetector): DirDetectorId {
        val oldDetector = oldDiDetector.detector
        val detector = detectorMap.getOrPut(oldDetector!!) { builder.detector(oldDetector.id) }
        return when (oldDiDetector.direction!!) {
            Direction.FORWARD -> detector.normal
            Direction.BACKWARD -> detector.reverse
        }
    }

    fun getDet(oldDiDetector: DiDetector): DirDetectorId {
        val oldDetector = oldDiDetector.detector
        val detector = detectorMap[oldDetector!!]!!
        return when (oldDiDetector.direction!!) {
            Direction.FORWARD -> detector.normal
            Direction.BACKWARD -> detector.reverse
        }
    }

    // create zones
    val switchToZone = mutableMapOf<Switch, ZoneId>()
    for (detectionSection in infra.detectionSections) {
        val oldSwitches = detectionSection!!.switches!!
        val oldDiDetectors = detectionSection.detectors!!
        val switches = mutableStaticIdxArraySetOf<MovableElement>()
        for (oldSwitch in oldSwitches)
            switches.add(switchMap[oldSwitch]!!)
        val detectors = mutableListOf<DirDetectorId>()
        for (oldDiDetector in oldDiDetectors)
            detectors.add(getOrCreateDet(oldDiDetector!!))
        val zoneId = builder.zone(switches, detectors)
        for (oldSwitch in oldSwitches)
            switchToZone[oldSwitch] = zoneId
        zoneMap[detectionSection] = zoneId
    }

    // parse signals
    for (rjsSignal in infra.signalMap.keys()) {
        val trackSignals = signalsPerTrack.getOrPut(rjsSignal.track!!) { mutableListOf() }
        val signalId = builder.physicalSignal(rjsSignal.id, rjsSignal.sightDistance.meters) {
            if (rjsSignal.logicalSignals == null)
                return@physicalSignal
            for (rjsLogicalSignal in rjsSignal.logicalSignals) {
                assert(rjsLogicalSignal.signalingSystem != null && rjsLogicalSignal.signalingSystem.isNotEmpty())
                assert(rjsLogicalSignal.nextSignalingSystems != null)
                assert(rjsLogicalSignal.settings != null)
                for (sigSystem in rjsLogicalSignal.nextSignalingSystems)
                    assert(sigSystem.isNotEmpty())
                logicalSignal(
                    rjsLogicalSignal.signalingSystem,
                    rjsLogicalSignal.nextSignalingSystems,
                    rjsLogicalSignal.settings
                )
            }
        }
        signalMap[rjsSignal.id] = signalId
        trackSignals.add(TrackSignal(
            rjsSignal.position.meters,
            Direction.fromEdgeDir(rjsSignal.direction),
            signalId
        ))
    }

    // sort signals by tracks
    for (trackSignals in signalsPerTrack.values)
        trackSignals.sortBy { it.position }

    // translate routes
    for (route in infra.reservationRouteMap.values) {
        routeMap[route] = builder.route(route.id) {
            val oldPath = route.detectorPath!!
            val oldReleasePoints = route.releasePoints!!
            val viewIterator = TrackRangeViewIterator(route!!.trackRanges)

            // as we iterate over the detection sections, we need to compute the length of each
            // detection section path as well as the position of switches contained within.
            // sadly, these two iteration processes were combined by the idiot behind this code: myself
            // parse the zone path and switch positions for this route
            var releaseIndex = 0
            for (startDetIndex in 0 until oldPath.size - 1) {
                val oldStartDet = oldPath[startDetIndex]
                val oldEndDet = oldPath[startDetIndex + 1]
                val entry = getDet(oldStartDet)
                val exit = getDet(oldEndDet)
                val zonePathId = buildZonePath(
                    viewIterator,
                    oldStartDet, oldEndDet,
                    entry, exit,
                    switchMap, switchGroupsMap,
                    signalsPerTrack,
                    builder
                )

                // check if the zone is a release zone
                if (releaseIndex < oldReleasePoints.size && oldEndDet.detector!! == oldReleasePoints[releaseIndex]) {
                    releaseZone(startDetIndex)
                    releaseIndex++
                }
                this@route.zonePath(zonePathId)
            }

            // if the old route did not have a release point at its last detector,
            // add the missing implicit end release point
            if (oldReleasePoints.isEmpty() || oldReleasePoints.last() != oldPath.last().detector) {
                releaseZone(oldPath.size - 2)
            }
        }
    }

    // TODO: check the length of built routes is the same as on the base infra
    // assert(route.length.meters == routeLength)

    return SimInfraAdapter(builder.build(), zoneMap, detectorMap, switchMap, switchGroupsMap, routeMap, signalMap)
}

private fun buildZonePath(
    viewIterator: TrackRangeViewIterator,
    oldStartDet: DiDetector,
    oldEndDet: DiDetector,
    entry: DirDetectorId,
    exit: DirDetectorId,
    switchMap: HashBiMap<Switch, MovableElementId>,
    switchGroupsMap: MutableMap<Switch, Map<String, MovableElementConfigId>>,
    signalsPerTrack: Map<String, MutableList<TrackSignal>>,
    builder: RawInfraBuilder
): ZonePathId {
    // at this point, we have trackRangeIndex pointing to the track range which contains the entry detector
    // we need iterate on track range until we reach the track range which contains the end detector.
    // meanwhile, we also need to:
    // 1) locate switches inside the zone path
    // 2) compute the length of each zone path
    // 3) compute the zone path's track section path in order to find signals

    var zonePathLength = 0.meters
    val movableElements = MutableStaticIdxArrayList<MovableElement>()
    val movableElementsConfigs = MutableStaticIdxArrayList<MovableElementConfig>()
    val movableElementsDistances = MutableDistanceArrayList()

    val zoneTrackPath = mutableListOf<ZonePathTrackSpan>()
    assert(viewIterator.view.track.edge == oldStartDet.detector.trackSection)
    if (oldStartDet.detector.trackSection == oldEndDet.detector.trackSection) {
        val track = oldStartDet.detector.trackSection
        // if the start and end detectors are on the same track, we don't need to increment anything
        assert(viewIterator.view.track.edge == track)
        val startOffset = oldStartDet.detector.offset.meters
        val endOffset = oldEndDet.detector.offset.meters
        val span = if (startOffset < endOffset)
            ZonePathTrackSpan(track, startOffset, endOffset, Direction.FORWARD)
        else
            ZonePathTrackSpan(track, endOffset, startOffset, Direction.BACKWARD)
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
                val movableElement = switchMap[edge.switch]!!
                val branchGroup = edge.switch!!.findBranchGroup(edge)!!
                val movableElementConfig = switchGroupsMap[edge.switch]!![branchGroup]!!
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
    data class ZonePathSignal(val position: Distance, val signal: PhysicalSignalId)
    val zonePathSignals: MutableList<ZonePathSignal> = mutableListOf()
    // the current position along the route, in millimeters
    var zonePathPosition = Distance.ZERO
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
            if (trackSignal.direction != range.direction)
                continue
            if (trackSignal.position < rangeBegin || trackSignal.position > rangeEnd)
                continue

            // compute the signal's position relative to the start of the zone path range
            val sigRangeStartDistance = if (trackSignal.direction == Direction.FORWARD)
                trackSignal.position - rangeBegin
            else
                rangeEnd - trackSignal.position
            zonePathSignals.add(ZonePathSignal(zonePathPosition + sigRangeStartDistance, trackSignal.signal))
        }
        zonePathPosition += (rangeEnd - rangeBegin)
    }

    zonePathSignals.sortBy { it.position }
    val signals = MutableStaticIdxArrayList<PhysicalSignal>()
    val signalPositions = MutableDistanceArrayList()
    for (zonePathSignal in zonePathSignals) {
        signals.add(zonePathSignal.signal)
        signalPositions.add(zonePathSignal.position)
    }

    return builder.zonePath(
        entry, exit, zonePathLength,
        movableElements, movableElementsConfigs, movableElementsDistances,
        signals, signalPositions,
    )
}


/** begin < end */
data class ZonePathTrackSpan(val track: TrackSection, val begin: Distance, val end: Distance, val direction: Direction) {
    val length get() = (begin - end).absoluteValue
}

/**
 * Compute the length of the part of a zone path segments which spans a given track.
 * Only works for zone paths which span multiple tracks.
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
        else
            ZonePathTrackSpan(track, 0.meters, oldStartDet.offset.meters, Direction.BACKWARD)
    } else if (track == oldEndDet.trackSection) {
        assert(direction == oldEndDiDet.direction)
        if (direction == Direction.FORWARD)
            ZonePathTrackSpan(track, 0.meters, oldEndDet.offset.meters, Direction.FORWARD)
        else
            ZonePathTrackSpan(track, oldEndDet.offset.meters, trackLen, Direction.BACKWARD)
    } else {
        ZonePathTrackSpan(track, 0.meters, trackLen, direction)
    }
}
