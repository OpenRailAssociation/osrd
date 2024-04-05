package fr.sncf.osrd.utils

import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.sim_infra.api.DirTrackChunkId
import fr.sncf.osrd.sim_infra.api.PhysicalSignal
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.api.TrackChunkId
import fr.sncf.osrd.sim_infra.api.TrackNodeId
import fr.sncf.osrd.sim_infra.api.TrackNodePortId
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.sim_infra.api.ZonePath
import fr.sncf.osrd.sim_infra.api.ZonePathId
import fr.sncf.osrd.stdcm.graph.logger
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.OffsetList
import java.util.Objects
import kotlin.collections.HashSet

data class ComparableOperationalPointPart(
    val name: String,
    val track: String,
    val trackOffset: Offset<TrackSection>,
    val chunkOffset: Offset<TrackChunk>
)

class ComparableChunk(simInfra: RawInfra, chunkId: TrackChunkId) {
    val geo = simInfra.getTrackChunkGeom(chunkId)
    val slopes =
        DirectionalMap(
            simInfra.getTrackChunkSlope(DirTrackChunkId(chunkId, Direction.INCREASING)),
            simInfra.getTrackChunkSlope(DirTrackChunkId(chunkId, Direction.DECREASING))
        )
    val curves =
        DirectionalMap(
            simInfra.getTrackChunkCurve(DirTrackChunkId(chunkId, Direction.INCREASING)),
            simInfra.getTrackChunkCurve(DirTrackChunkId(chunkId, Direction.DECREASING))
        )
    val gradients =
        DirectionalMap(
            simInfra.getTrackChunkGradient(DirTrackChunkId(chunkId, Direction.INCREASING)),
            simInfra.getTrackChunkGradient(DirTrackChunkId(chunkId, Direction.DECREASING))
        )
    val length = simInfra.getTrackChunkLength(chunkId)
    val routes =
        DirectionalMap(
            simInfra.getRoutesOnTrackChunk(DirTrackChunkId(chunkId, Direction.INCREASING)),
            simInfra.getRoutesOnTrackChunk(DirTrackChunkId(chunkId, Direction.DECREASING))
        )
    val track = simInfra.getTrackSectionName(simInfra.getTrackFromChunk(chunkId))
    val offset = simInfra.getTrackChunkOffset(chunkId)

    val operationalPointParts = HashSet<ComparableOperationalPointPart>()

    init {
        for (opp in simInfra.getTrackChunkOperationalPointParts(chunkId)) {
            val incomingOpp =
                ComparableOperationalPointPart(
                    simInfra.getOperationalPointPartName(opp),
                    simInfra.getTrackSectionName(
                        simInfra.getTrackFromChunk(simInfra.getOperationalPointPartChunk(opp))
                    ),
                    simInfra.getTrackChunkOffset(simInfra.getOperationalPointPartChunk(opp)),
                    simInfra.getOperationalPointPartChunkOffset(opp)
                )
            if (operationalPointParts.contains(incomingOpp)) {
                logger.warn("Duplicate operational point part: $incomingOpp")
            } else {
                operationalPointParts.add(incomingOpp)
            }
        }

        for (opp in simInfra.getTrackChunkOperationalPointParts(chunkId)) {
            assert(simInfra.getOperationalPointPartChunk(opp) == chunkId)
        }
    }

    val loadingGaugeConstraints = simInfra.getTrackChunkLoadingGaugeConstraints(chunkId)
    val electrificationVoltage = simInfra.getTrackChunkElectrificationVoltage(chunkId)
    val neutralSections =
        DirectionalMap(
            simInfra.getTrackChunkNeutralSections(DirTrackChunkId(chunkId, Direction.INCREASING)),
            simInfra.getTrackChunkNeutralSections(DirTrackChunkId(chunkId, Direction.DECREASING))
        )
    val speedSections =
        DirectionalMap(
            simInfra.getTrackChunkSpeedSections(DirTrackChunkId(chunkId, Direction.INCREASING)),
            simInfra.getTrackChunkSpeedSections(DirTrackChunkId(chunkId, Direction.DECREASING))
        )

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ComparableChunk) return false
        if (!geo.equalsWithTolerance(other.geo, 1E-8)) return false
        if (slopes != other.slopes) return false
        if (curves != other.curves) return false
        if (gradients != other.gradients) return false
        if (length != other.length) return false
        if (routes != other.routes) return false
        if (track != other.track) return false
        if (offset != other.offset) return false
        if (operationalPointParts != other.operationalPointParts) return false
        if (loadingGaugeConstraints != other.loadingGaugeConstraints) return false
        if (electrificationVoltage != other.electrificationVoltage) return false
        if (neutralSections != other.neutralSections) return false
        if (speedSections != other.speedSections) return false
        return true
    }

    override fun hashCode(): Int {
        return Objects.hash(
            geo,
            slopes,
            curves,
            gradients,
            length,
            routes,
            track,
            offset,
            operationalPointParts,
            loadingGaugeConstraints,
            electrificationVoltage,
            neutralSections,
            speedSections
        )
    }
}

data class ComparableSectionEndpoint(val trackSectionName: String, val endpoint: Endpoint)

data class ComparableConfig(
    val name: String,
    val connections: Map<ComparableSectionEndpoint, ComparableSectionEndpoint?>
)

class ComparableNode(simInfra: RawInfra, nodeIdx: TrackNodeId) {
    val name = simInfra.getTrackNodeName(nodeIdx)
    val delay = simInfra.getTrackNodeDelay(nodeIdx)
    val portEndpoints = mutableSetOf<ComparableSectionEndpoint>()
    val configs = mutableSetOf<ComparableConfig>()

    init {
        val portMap = mutableMapOf<TrackNodePortId, ComparableSectionEndpoint>()
        // construct portEndpoints
        for (portIdx in simInfra.getTrackNodePorts(nodeIdx)) {
            val sectionEndpointIdx = simInfra.getPortConnection(nodeIdx, portIdx)
            portMap[portIdx] =
                ComparableSectionEndpoint(
                    simInfra.getTrackSectionName(sectionEndpointIdx.value),
                    sectionEndpointIdx.endpoint
                )
            portEndpoints.add(portMap[portIdx]!!)
        }
        // construct configs
        for (configIdx in simInfra.getTrackNodeConfigs(nodeIdx)) {
            // construct config's connections
            val connections = mutableMapOf<ComparableSectionEndpoint, ComparableSectionEndpoint?>()
            for ((portIdx, port) in portMap) {
                val outPort = simInfra.getTrackNodeExitPort(nodeIdx, configIdx, portIdx)
                if (outPort.isNone) connections[port] = null
                else {
                    val outEndpointIdx = simInfra.getPortConnection(nodeIdx, outPort.asIndex())
                    connections[port] =
                        ComparableSectionEndpoint(
                            simInfra.getTrackSectionName(outEndpointIdx.value),
                            outEndpointIdx.endpoint
                        )
                }
            }
            configs.add(
                ComparableConfig(simInfra.getTrackNodeConfigName(nodeIdx, configIdx), connections)
            )
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ComparableNode) return false
        if (name != other.name) return false
        if (delay != other.delay) return false
        if (portEndpoints != other.portEndpoints) return false
        if (configs != other.configs) return false
        return true
    }

    override fun hashCode(): Int {
        return Objects.hash(name, delay, portEndpoints, configs)
    }
}

data class ComparableZone(val name: String, val nodes: Set<String>)

fun assertEqualSimInfra(left: RawInfra, right: RawInfra) {
    // detectors
    val leftDetectors = mutableSetOf<String>()
    for (d in left.detectors) {
        leftDetectors.add(left.getDetectorName(d))
    }
    assert(left.detectors.size.toInt() == leftDetectors.size)
    val rightDetectors = mutableSetOf<String>()
    for (d in right.detectors) {
        rightDetectors.add(left.getDetectorName(d))
    }
    assert(right.detectors.size.toInt() == rightDetectors.size)
    assert(leftDetectors == rightDetectors)

    // track-sections
    assert(left.trackSections.size == right.trackSections.size)
    val leftTrackChunks = mutableMapOf<Pair<String, Offset<TrackSection>>, ComparableChunk>()
    for (t in left.trackSections) {
        for (c in left.getTrackSectionChunks(t)) {
            assert(t == left.getTrackFromChunk(c))
            val chunkKey = Pair(left.getTrackSectionName(t), left.getTrackChunkOffset(c))
            assert(!leftTrackChunks.containsKey(chunkKey))
            leftTrackChunks[chunkKey] = ComparableChunk(left, c)
        }
    }
    val rightTrackChunks = mutableMapOf<Pair<String, Offset<TrackSection>>, ComparableChunk>()
    for (t in right.trackSections) {
        for (c in right.getTrackSectionChunks(t)) {
            assert(t == right.getTrackFromChunk(c))
            val chunkKey = Pair(right.getTrackSectionName(t), right.getTrackChunkOffset(c))
            assert(!rightTrackChunks.containsKey(chunkKey))
            rightTrackChunks[chunkKey] = ComparableChunk(right, c)
        }
    }
    assert(leftTrackChunks == rightTrackChunks)

    // nodes
    val leftNodes = mutableSetOf<ComparableNode>()
    for (n in left.trackNodes) {
        val leftNode = ComparableNode(left, n)
        assert(!leftNodes.contains(leftNode))
        leftNodes.add(leftNode)
    }
    val rightNodes = mutableSetOf<ComparableNode>()
    for (n in right.trackNodes) {
        val rightNode = ComparableNode(right, n)
        assert(!rightNodes.contains(rightNode))
        rightNodes.add(rightNode)
    }
    assert(leftNodes == rightNodes)

    // zones
    val leftZones = mutableMapOf<ZoneId, ComparableZone>()
    for (z in left.zones) {
        leftZones[z] =
            ComparableZone(
                left.getZoneName(z),
                left.getMovableElements(z).map { left.getTrackNodeName(it) }.toSet()
            )
    }
    val rightZones = mutableMapOf<ZoneId, ComparableZone>()
    for (z in right.zones) {
        rightZones[z] =
            ComparableZone(
                right.getZoneName(z),
                right.getMovableElements(z).map { right.getTrackNodeName(it) }.toSet()
            )
    }

    val leftDetToNextZone = mutableMapOf<String, ComparableZone?>()
    val leftZoneToDet = mutableMapOf<ComparableZone, MutableSet<DirDetectorId>>()
    for (detIdx in left.detectors) {
        for (dir in Direction.entries) {
            val dirDet = DirDetectorId(detIdx, dir)
            val nextZoneIdx = left.getNextZone(dirDet)
            leftDetToNextZone["${left.getDetectorName(dirDet.value)}.${dirDet.direction}"] =
                if (nextZoneIdx != null) leftZones[nextZoneIdx] else null
            if (nextZoneIdx != null) {
                if (!leftZoneToDet.containsKey(leftZones[nextZoneIdx]))
                    leftZoneToDet[leftZones[nextZoneIdx]!!] = mutableSetOf()
                leftZoneToDet[leftZones[nextZoneIdx]]!!.add(dirDet)
            }
        }
    }
    val rightDetToNextZone = mutableMapOf<String, ComparableZone?>()
    val rightZoneToDet = mutableMapOf<ComparableZone, MutableSet<DirDetectorId>>()
    for (detIdx in right.detectors) {
        for (dir in Direction.entries) {
            val dirDet = DirDetectorId(detIdx, dir)
            val nextZoneIdx = right.getNextZone(dirDet)
            rightDetToNextZone["${right.getDetectorName(dirDet.value)}.${dirDet.direction}"] =
                if (nextZoneIdx != null) rightZones[nextZoneIdx] else null
            if (nextZoneIdx != null) {
                if (!rightZoneToDet.containsKey(rightZones[nextZoneIdx]))
                    rightZoneToDet[rightZones[nextZoneIdx]!!] = mutableSetOf()
                rightZoneToDet[rightZones[nextZoneIdx]]!!.add(dirDet)
            }
        }
    }

    val extraLeftZones = leftZones.values.toSet().minus(rightZones.values.toSet())
    val extraRightZones = rightZones.values.toSet().minus(leftZones.values.toSet())
    // check that different zones are only the "suspect" ones with 0 or 1 detector bound
    for (zone in extraLeftZones) {
        assert(!leftZoneToDet.containsKey(zone) || leftZoneToDet[zone]!!.size < 2)
    }
    for (zone in extraRightZones) {
        assert(!rightZoneToDet.containsKey(zone) || rightZoneToDet[zone]!!.size < 2)
    }

    val extraLeftDet = leftDetToNextZone.entries.minus(rightDetToNextZone.entries)
    val extraRightDet = rightDetToNextZone.entries.minus(leftDetToNextZone.entries)
    // check that different detectors are bounding only "suspect" zones
    for ((_, zone) in extraLeftDet) {
        assert(zone == null || extraLeftZones.contains(zone))
    }
    for ((_, zone) in extraRightDet) {
        assert(zone == null || extraRightZones.contains(zone))
    }

    val leftZonePathToSignal =
        mutableMapOf<ZonePathId, Pair<OffsetList<ZonePath>, StaticIdxList<PhysicalSignal>>>()
    for (zonePath in left.zonePaths) {
        leftZonePathToSignal[zonePath] =
            Pair(left.getSignalPositions(zonePath), left.getSignals(zonePath))
    }
    val rightZonePathToSignal =
        mutableMapOf<ZonePathId, Pair<OffsetList<ZonePath>, StaticIdxList<PhysicalSignal>>>()
    for (zonePath in right.zonePaths) {
        rightZonePathToSignal[zonePath] =
            Pair(right.getSignalPositions(zonePath), right.getSignals(zonePath))
    }
    assert(leftZonePathToSignal == rightZonePathToSignal)

    // TODO complete simInfra checks
}
