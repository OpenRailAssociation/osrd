package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.SelfTypeHolder
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed

data class NeutralSection(
    val lowerPantograph: Boolean,
    val isAnnouncement: Boolean,
)

@JvmRecord
data class SpeedLimitProperty(
    val speed: Speed,
    val source: SpeedLimitSource? // if train-tag used, source of the speed-limit
)

sealed class SpeedLimitSource : SelfTypeHolder {
    override val selfType: Class<out SelfTypeHolder>
        get() = SpeedLimitSource::class.java

    /** Given train-tag was found on the track and used */
    data class GivenTrainTag(val tag: String) : SpeedLimitSource()

    /** Given train-tag is unknown on the track, using one of its configured fallbacks */
    data class FallbackTag(val tag: String) : SpeedLimitSource()

    /**
     * Given train-tag and its configured fallbacks (if configured) are unknown on the track: no
     * speed-limit applied from tag
     */
    class UnknownTag : SpeedLimitSource() {
        override fun equals(other: Any?): Boolean {
            if (other is UnknownTag) return true
            return super.equals(other)
        }

        override fun hashCode(): Int {
            return 1
        }
    }

    /**
     * The speed limit comes from a safety approach area: the train must slow down before reaching
     * the next signal
     */
    data object SafetyApproachSpeed : SpeedLimitSource()
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

    fun getTrackChunkSpeedLimitProperties(
        trackChunk: DirTrackChunkId,
        trainTag: String?,
        route: String?
    ): DistanceRangeMap<SpeedLimitProperty>

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
