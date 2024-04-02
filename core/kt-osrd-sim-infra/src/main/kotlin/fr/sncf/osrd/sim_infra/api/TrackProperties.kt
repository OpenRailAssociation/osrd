package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed
import java.util.*

class SpeedSection(
    val default: Speed,
    val speedByTrainTag: Map<String, Speed>,
) {
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

/**
 * An operational point is a special location (such as a station). It has an ID and a set of
 * locations (parts). In the current internal infra representation, we only consider the operational
 * point parts. There's no entity grouping the parts together because there's no use for it yet, it
 * can be added later on.
 */
sealed interface OperationalPointPart

typealias OperationalPointPartId = StaticIdx<OperationalPointPart>

interface TrackProperties {
    // Chunk attributes
    fun getTrackChunkLength(trackChunk: TrackChunkId): Length<TrackChunk>

    fun getTrackChunkOffset(trackChunk: TrackChunkId): Offset<TrackSection>

    fun getTrackFromChunk(trackChunk: TrackChunkId): TrackSectionId

    // Linear track attributes
    fun getTrackChunkSlope(trackChunk: DirTrackChunkId): DistanceRangeMap<Double>

    fun getTrackChunkCurve(trackChunk: DirTrackChunkId): DistanceRangeMap<Double>

    fun getTrackChunkGradient(trackChunk: DirTrackChunkId): DistanceRangeMap<Double>

    fun getTrackChunkLoadingGaugeConstraints(
        trackChunk: TrackChunkId
    ): DistanceRangeMap<LoadingGaugeConstraint>

    fun getTrackChunkElectrificationVoltage(trackChunk: TrackChunkId): DistanceRangeMap<String>

    fun getTrackChunkNeutralSections(trackChunk: DirTrackChunkId): DistanceRangeMap<NeutralSection>

    fun getTrackChunkSpeedSections(trackChunk: DirTrackChunkId): DistanceRangeMap<SpeedSection>

    fun getTrackChunkSpeedSections(
        trackChunk: DirTrackChunkId,
        trainTag: String?
    ): DistanceRangeMap<Speed>

    fun getTrackChunkGeom(trackChunk: TrackChunkId): LineString

    // Operational points
    fun getTrackChunkOperationalPointParts(
        trackChunk: TrackChunkId
    ): StaticIdxList<OperationalPointPart>

    fun getOperationalPointPartChunk(operationalPoint: OperationalPointPartId): TrackChunkId

    fun getOperationalPointPartChunkOffset(
        operationalPoint: OperationalPointPartId
    ): Offset<TrackChunk>

    fun getOperationalPointPartName(operationalPoint: OperationalPointPartId): String
}
