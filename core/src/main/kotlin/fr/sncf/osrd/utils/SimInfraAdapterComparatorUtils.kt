package fr.sncf.osrd.utils

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*

private data class ComparableZone(
    val bounds: Set<DirDetectorId>,
    val nodes: StaticIdxSortedSet<TrackNode>
)

private enum class Side {
    Left,
    Right
}

private class SideValue<T>(val left: T, val right: T) : Iterable<T> {
    operator fun get(side: Side): T {
        return when (side) {
            Side.Left -> left
            Side.Right -> right
        }
    }

    override fun iterator(): Iterator<T> {
        return listOf(left, right).iterator()
    }
}

fun assertEqualSimInfra(left: RawInfra, right: RawInfra) {
    fun <T> map(f: RawInfra.(Side) -> T): SideValue<T> {
        return SideValue(left.f(Side.Left), right.f(Side.Right))
    }

    fun <T> compare(f: RawInfra.(Side) -> T): T {
        val l = left.f(Side.Left)
        val r = right.f(Side.Right)
        assert(l == r)
        return l
    }

    for (trackSectionId in compare { trackSections }) {
        compare { getTrackSectionName(trackSectionId) }
        compare { getTrackSectionLength(trackSectionId) }
        for (dir in Direction.entries) {
            val dirTrack = trackSectionId.withDirection(dir)
            val node = compare { getNextTrackNode(dirTrack) }
            val port = compare { getNextTrackNodePort(dirTrack) }
            assert(node.isNone == port.isNone)
            if (node.isNone) continue
            assert(
                compare { getPortConnection(node.asIndex(), port.asIndex()) == dirTrack.toEndpoint }
            )
        }
        for (chunkId in compare { getTrackSectionChunks(trackSectionId) }) {
            assert(compare { getTrackFromChunk(chunkId) } == trackSectionId)
            compare { getTrackChunkLength(chunkId) }
            compare { getTrackChunkOffset(chunkId) }
            compare { getTrackChunkGeom(chunkId) }
            compare { getTrackChunkElectrificationVoltage(chunkId) }
            compare { getTrackChunkLoadingGaugeConstraints(chunkId) }
            // operational points aren't created in the same order, se we can't compare IDs
            val operationalPoints = map { getTrackChunkOperationalPointParts(chunkId) }
            for (i in 0 until compare { operationalPoints[it].size }) {
                compare { getOperationalPointPartName(operationalPoints[it][i]) }
                compare { getOperationalPointPartChunkOffset(operationalPoints[it][i]) }
                assert(
                    compare { getOperationalPointPartChunk(operationalPoints[it][i]) } == chunkId
                )
            }
            for (dir in Direction.entries) {
                val dirChunkId = chunkId.withDirection(dir)
                compare { getRoutesOnTrackChunk(dirChunkId) }
                compare { getTrackChunkCurve(dirChunkId) }
                compare { getTrackChunkSlope(dirChunkId) }
                compare { getTrackChunkGradient(dirChunkId) }
                compare { getTrackChunkNeutralSections(dirChunkId) }
                compare { getTrackChunkSpeedSections(dirChunkId) }
            }
        }
    }

    for (nodeId in compare { trackNodes }) {
        compare { getTrackNodeName(nodeId) }
        compare { getTrackNodeDelay(nodeId) }
        val ports = compare { getTrackNodePorts(nodeId) }
        for (portId in ports) {
            compare { getPortConnection(nodeId, portId) }
        }
        for (configId in compare { getTrackNodeConfigs(nodeId) }) {
            compare { getTrackNodeConfigName(nodeId, configId) }
            for (portId in ports) {
                compare { getTrackNodeExitPort(nodeId, configId, portId) }
            }
        }
    }

    // prepare to compare zones
    val zones = map {
        zones.associateWith {
            ComparableZone(
                getZoneBounds(it).toSet(),
                getMovableElements(it),
            )
        }
    }

    fun compareNextZone(dirDetectorId: DirDetectorId) {
        val nextZone = map { getNextZone(dirDetectorId) }
        val boundsCount = map { side -> nextZone[side]?.let { getZoneBounds(it).size } ?: 0 }
        // ignore zones with from 0 to 1 bounds (loops and dead ends)
        if (boundsCount.all { it < 2 }) return
        compare { zones[it][nextZone[it]] }
    }

    // compare detectors
    for (detectorId in compare { detectors }) {
        // there must be the exact same detectors
        compare { getDetectorName(detectorId) }
        for (dir in Direction.entries) {
            val dirDetectorId = detectorId.withDirection(dir)
            compare { getRoutesStartingAtDet(dirDetectorId) }
            compare { getRoutesEndingAtDet(dirDetectorId) }
            compareNextZone(dirDetectorId)
        }
    }

    for (routeIndex in compare { routes }) {
        val routeName = compare { getRouteName(routeIndex) }
        assert(compare { getRouteFromName(routeName) } == routeIndex)
        compare { getRouteLength(routeIndex) }
        compare { getChunksOnRoute(routeIndex) }
        compare { getRouteEntry(routeIndex) }
        compare { getRouteExit(routeIndex) }
        compare { getRoutePath(routeIndex) }
        compare { getSpeedLimits(routeIndex) }
        compare { getSpeedLimitStarts(routeIndex) }
        compare { getSpeedLimitEnds(routeIndex) }
        compare { getRouteReleaseZones(routeIndex).toList() }
    }

    for (zonePathIndex in compare { zonePaths }) {
        compare { getZonePathEntry(zonePathIndex) }
        compare { getZonePathExit(zonePathIndex) }
        compare { getZonePathLength(zonePathIndex) }
        compare { getZonePathChunks(zonePathIndex) }
        compare { getZonePathMovableElements(zonePathIndex) }
        compare { getZonePathMovableElementsConfigs(zonePathIndex) }
        compare { getZonePathMovableElementsPositions(zonePathIndex) }
        compare { findZonePath(getZonePathEntry(zonePathIndex), getZonePathExit(zonePathIndex)) }
        compare { getSignalPositions(zonePathIndex) }
        compare { getSignals(zonePathIndex) }
        compare {
            findZonePath(
                getZonePathEntry(zonePathIndex),
                getZonePathExit(zonePathIndex),
                getZonePathMovableElements(zonePathIndex),
                getZonePathMovableElementsConfigs(zonePathIndex)
            )
        }
    }

    for (physicalSignalId in compare { physicalSignals }) {
        compare { getPhysicalSignalName(physicalSignalId) }
        compare { getPhysicalSignalTrack(physicalSignalId) }
        compare { getPhysicalSignalTrackOffset(physicalSignalId) }
        compare { getLogicalSignals(physicalSignalId) }
        compare { getSignalSightDistance(physicalSignalId) }
    }

    for (logicalSignalId in compare { logicalSignals }) {
        compare { getPhysicalSignal(logicalSignalId) }
        compare { getSignalingSystemId(logicalSignalId) }
        compare { getRawSettings(logicalSignalId) }
        compare { getRawParameters(logicalSignalId) }
        compare { getNextSignalingSystemIds(logicalSignalId) }
    }
}
