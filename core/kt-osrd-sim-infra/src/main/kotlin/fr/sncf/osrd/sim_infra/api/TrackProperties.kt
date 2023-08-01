package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.impl.DeadSection
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Speed


/** An operational point is a special location (such as a station).
 * It has an ID and a set of locations (parts).
 * In the current internal infra representation, we only consider the operational point parts.
 * There's no entity grouping the parts together because there's no use for it yet, it can be added later on. */
sealed interface OperationalPointPart
typealias OperationalPointPartId = StaticIdx<OperationalPointPart>

@Suppress("INAPPLICABLE_JVM_NAME")
interface TrackProperties {

    // Chunk attributes
    @JvmName("getTrackChunkLength")
    fun getTrackChunkLength(trackChunk: TrackChunkId): Distance
    @JvmName("getTrackChunkOffset")
    fun getTrackChunkOffset(trackChunk: TrackChunkId): Distance
    @JvmName("getTrackFromChunk")
    fun getTrackFromChunk(trackChunk: TrackChunkId): TrackSectionId

    // Linear track attributes
    fun getTrackChunkSlope(trackChunk: DirTrackChunkId): DistanceRangeMap<Double>
    fun getTrackChunkCurve(trackChunk: DirTrackChunkId): DistanceRangeMap<Double>
    fun getTrackChunkGradient(trackChunk: DirTrackChunkId): DistanceRangeMap<Double>
    fun getTrackChunkLoadingGaugeConstraints(trackChunk: TrackChunkId): DistanceRangeMap<LoadingGaugeConstraint>
    fun getTrackChunkCatenaryVoltage(trackChunk: TrackChunkId): DistanceRangeMap<String>
    @JvmName("getTrackChunkDeadSection")
    fun getTrackChunkDeadSection(trackChunk: DirTrackChunkId): DistanceRangeMap<DeadSection>
    fun getTrackChunkSpeedSections(trackChunk: DirTrackChunkId, trainTag: String?): DistanceRangeMap<Speed>
    @JvmName("getTrackChunkGeom")
    fun getTrackChunkGeom(trackChunk: TrackChunkId): LineString

    // Operational points
    fun getTrackChunkOperationalPointParts(trackChunk: TrackChunkId): StaticIdxList<OperationalPointPart>
    fun getOperationalPointPartChunk(operationalPoint: OperationalPointPartId): TrackChunkId
    fun getOperationalPointPartChunkOffset(operationalPoint: OperationalPointPartId): Distance
    @JvmName("getOperationalPointPartName")
    fun getOperationalPointPartName(operationalPoint: OperationalPointPartId): String
}
