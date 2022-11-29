package fr.sncf.osrd.sim_infra_adapter

import com.google.common.collect.BiMap
import com.google.common.collect.HashBiMap
import fr.sncf.osrd.infra.api.Direction
import fr.sncf.osrd.infra.api.reservation.DetectionSection
import fr.sncf.osrd.infra.api.reservation.DiDetector
import fr.sncf.osrd.infra.api.reservation.ReservationRoute
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import fr.sncf.osrd.infra.api.tracks.undirected.Detector
import fr.sncf.osrd.infra.api.tracks.undirected.Switch
import fr.sncf.osrd.infra.api.tracks.undirected.SwitchBranch
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.SimInfraBuilder
import fr.sncf.osrd.utils.indexing.MutableStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArraySetOf
import kotlin.time.Duration.Companion.seconds


class SimInfraAdapter(
    val simInfra: SimInfra,
    val zoneMap: BiMap<DetectionSection, ZoneId>,
    val detectorMap: BiMap<Detector, DetectorId>,
    val switchMap: BiMap<Switch, MovableElementId>,
    val switchGroupsMap: Map<Switch, Map<String, MovableElementConfigId>>,
    val routeMap: BiMap<ReservationRoute, RouteId>,
) : SimInfra by simInfra


fun adaptSimInfra(infra: SignalingInfra): SimInfraAdapter {
    val builder = SimInfraBuilder()
    val zoneMap = HashBiMap.create<DetectionSection, ZoneId>()
    val detectorMap = HashBiMap.create<Detector, DetectorId>()
    val switchMap = HashBiMap.create<Switch, MovableElementId>()
    val switchGroupsMap = mutableMapOf<Switch, Map<String, MovableElementConfigId>>()
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
        val detector = detectorMap.getOrPut(oldDetector!!) { builder.detector() }
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

    // translate routes
    for (route in infra.reservationRouteMap.values) {
        // iterate over the path of the route, finding switches along the way and binning switches by zone
        val zoneSwitchBranchesMap = mutableMapOf<ZoneId, MutableList<SwitchBranch>>()
        for (trackView in route!!.trackRanges) {
            val track = trackView.track!!.edge
            if (track !is SwitchBranch)
                continue
            val oldSwitch = track.switch!!
            val switchList = zoneSwitchBranchesMap.getOrPut(switchToZone[oldSwitch]!!) { mutableListOf() }
            switchList.add(track)
        }

        val oldPath = route.detectorPath!!
        val oldReleasePoints = route.releasePoints!!
        val hasImplicitEndRelease = oldReleasePoints.isEmpty() || oldReleasePoints.last() != oldPath.last().detector
        val releaseZonesCount = oldReleasePoints.size + if (hasImplicitEndRelease) 1 else 0
        val releaseZones = IntArray(releaseZonesCount)
        if (hasImplicitEndRelease) {
            releaseZones[releaseZonesCount - 1] = oldPath.size - 2
        }
        var releaseIndex = 0
        val routePath = mutableListOf<ZonePath>()
        for (startDetIndex in 0 until oldPath.size - 1) {
            val oldStartDet = oldPath[startDetIndex]
            val oldEndDet = oldPath[startDetIndex + 1]
            val entry = getDet(oldStartDet)
            val exit = getDet(oldEndDet)
            val oldDetectionSection = oldStartDet.detector.getNextDetectionSection(oldStartDet.direction)!!
            val zone = zoneMap[oldDetectionSection]!!

            // fill switches for this zone
            val movableElements = MutableStaticIdxArrayList<MovableElement>()
            val movableElementConfigs = MutableStaticIdxArrayList<MovableElementConfig>()
            val zoneSwitchBranches = zoneSwitchBranchesMap[zone]
            if (zoneSwitchBranches != null) {
                for (switchBranch in zoneSwitchBranches) {
                    val movableElement = switchMap[switchBranch.switch]!!
                    val branchGroup = switchBranch.switch!!.findBranchGroup(switchBranch)!!
                    val movableElementConfig = switchGroupsMap[switchBranch.switch]!![branchGroup]!!
                    movableElements.add(movableElement)
                    movableElementConfigs.add(movableElementConfig)
                }
            }

            // check if the zone is a release zone
            if (releaseIndex < oldReleasePoints.size && oldEndDet.detector!! == oldReleasePoints[releaseIndex]) {
                releaseZones[releaseIndex] = startDetIndex
                releaseIndex++
            }
            routePath.add(ZonePath(entry, exit, movableElements, movableElementConfigs))
        }
        routeMap[route] = builder.route(routePath, releaseZones)
    }

    // TODO: load signals

    return SimInfraAdapter(builder.build(), zoneMap, detectorMap, switchMap, switchGroupsMap, routeMap)
}
