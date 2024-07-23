package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed

data class NeutralSection(
    val lowerPantograph: Boolean,
    val isAnnouncement: Boolean,
)

enum class SpeedLimitTagHandlingPolicy {
    /** Ignore provided train-tag */
    NONE,
    /** Only use train-tag to apply speedLimitTag from infra (no fallback tags, no default-speed) */
    ONLY_GIVEN_TAG,
    /**
     * Use train-tag, then fallback tags specified for the train-tag to apply speedLimitTag from
     * infra (no default speed)
     */
    GIVEN_TAG_AND_FALLBACK_TAGS,
    /**
     * Use train-tag, then fallback tags specified for the train-tag to apply speedLimitTag from
     * infra, then use default-speed specified for the train-tag
     */
    ALL;

    fun useGivenTag(): Boolean {
        return when (this) {
            NONE -> false
            ONLY_GIVEN_TAG -> true
            GIVEN_TAG_AND_FALLBACK_TAGS -> true
            ALL -> true
        }
    }

    fun useFallbackTags(): Boolean {
        return when (this) {
            NONE -> false
            ONLY_GIVEN_TAG -> false
            GIVEN_TAG_AND_FALLBACK_TAGS -> true
            ALL -> true
        }
    }

    fun useDefaultSpeed(): Boolean {
        return when (this) {
            NONE -> false
            ONLY_GIVEN_TAG -> false
            GIVEN_TAG_AND_FALLBACK_TAGS -> false
            ALL -> true
        }
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

    fun getTrackChunkSpeedSections(
        trackChunk: DirTrackChunkId,
        tagPolicy: SpeedLimitTagHandlingPolicy,
        trainTag: String?,
        route: String?
    ): DistanceRangeMap<Speed>

    fun getTrackChunkGeom(trackChunk: TrackChunkId): LineString

    // Operational points
    fun getTrackChunkOperationalPointParts(
        trackChunk: TrackChunkId
    ): StaticIdxList<OperationalPointPart>

    fun getOperationalPointPartChunk(operationalPointPart: OperationalPointPartId): TrackChunkId

    fun getOperationalPointPartChunkOffset(
        operationalPointPart: OperationalPointPartId
    ): Offset<TrackChunk>

    fun getOperationalPointPartOpId(operationalPointPart: OperationalPointPartId): String

    fun getOperationalPointPartProps(
        operationalPointPart: OperationalPointPartId
    ): Map<String, String>
}
