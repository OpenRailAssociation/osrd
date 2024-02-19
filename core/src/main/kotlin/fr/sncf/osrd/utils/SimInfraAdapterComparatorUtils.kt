package fr.sncf.osrd.utils

import fr.sncf.osrd.sim_infra.api.DirTrackChunkId
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.api.TrackChunkId
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.sim_infra_adapter.SimInfraAdapter
import fr.sncf.osrd.stdcm.graph.logger
import fr.sncf.osrd.utils.units.Offset
import java.util.Objects
import kotlin.collections.HashSet

open class ComparableOperationalPointPart(
    val name: String,
    val track: String,
    val trackOffset: Offset<TrackSection>,
    val chunkOffset: Offset<TrackChunk>
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ComparableOperationalPointPart) return false
        if (name != other.name) return false
        if (track != other.track) return false
        if (trackOffset != other.trackOffset) return false
        if (chunkOffset != other.chunkOffset) return false
        return true
    }

    override fun hashCode(): Int {
        return Objects.hash(name, track, trackOffset, chunkOffset)
    }
}

open class ComparableChunk(simInfra: RawInfra, chunkId: TrackChunkId) {
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

fun assertEqualSimInfra(left: SimInfraAdapter, right: SimInfraAdapter) {
    val leftDetectors = mutableSetOf<String>()
    for (d in left.simInfra.detectors) {
        leftDetectors.add(left.simInfra.getDetectorName(d)!!)
    }
    assert(left.simInfra.detectors.size.toInt() == leftDetectors.size)
    val rightDetectors = mutableSetOf<String>()
    for (d in right.simInfra.detectors) {
        rightDetectors.add(left.simInfra.getDetectorName(d)!!)
    }
    assert(right.simInfra.detectors.size.toInt() == rightDetectors.size)
    assert(leftDetectors == rightDetectors)

    assert(left.simInfra.trackSections.size == right.simInfra.trackSections.size)
    val leftTrackChunks = mutableMapOf<Pair<String, Offset<TrackSection>>, ComparableChunk>()
    for (t in left.simInfra.trackSections) {
        for (c in left.simInfra.getTrackSectionChunks(t)) {
            assert(t == left.simInfra.getTrackFromChunk(c))
            val chunkKey =
                Pair(left.simInfra.getTrackSectionName(t), left.simInfra.getTrackChunkOffset(c))
            assert(!leftTrackChunks.containsKey(chunkKey))
            leftTrackChunks[chunkKey] = ComparableChunk(left.simInfra, c)
        }
    }
    val rightTrackChunks = mutableMapOf<Pair<String, Offset<TrackSection>>, ComparableChunk>()
    for (t in right.simInfra.trackSections) {
        for (c in right.simInfra.getTrackSectionChunks(t)) {
            assert(t == right.simInfra.getTrackFromChunk(c))
            val chunkKey =
                Pair(right.simInfra.getTrackSectionName(t), right.simInfra.getTrackChunkOffset(c))
            assert(!rightTrackChunks.containsKey(chunkKey))
            rightTrackChunks[chunkKey] = ComparableChunk(right.simInfra, c)
        }
    }
    assert(leftTrackChunks == rightTrackChunks)

    // TODO complete simInfra checks

    assert(left.zoneMap == right.zoneMap)
    assert(left.detectorMap.size == right.detectorMap.size)
    for (l in left.detectorMap) {
        assert(right.detectorMap.containsKey(l.key))
    }
    assert(left.trackNodeMap == right.trackNodeMap)
    assert(left.trackNodeGroupsMap == right.trackNodeGroupsMap)
    assert(left.routeMap == right.routeMap)
    assert(left.signalMap == right.signalMap)
    assert(left.rjsSignalMap == right.rjsSignalMap)
}
