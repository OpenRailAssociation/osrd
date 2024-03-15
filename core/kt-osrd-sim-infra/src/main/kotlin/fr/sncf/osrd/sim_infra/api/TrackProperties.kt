package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.impl.NeutralSection
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed

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
        trainTag: String?,
        route: String?
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
