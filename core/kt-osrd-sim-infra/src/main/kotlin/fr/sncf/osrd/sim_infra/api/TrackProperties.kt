package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.railjson.schema.geom.LineString
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList


/** An operational point is a special location (such as a station).
 * It has an ID and a set of locations (parts).
 * In the current internal infra representation, we only consider the operational point parts.
 * There's no entity grouping the parts together because there's no use for it yet, it can be added later on. */
sealed interface OperationalPointPart
typealias OperationalPointPartId = StaticIdx<OperationalPointPart>

interface TrackProperties {
    fun getTrackChunkGeom(trackChunk: TrackChunkId): LineString
    fun getTrackChunkLength(trackChunk: TrackChunkId): Distance
    fun getTrackChunkOffset(trackChunk: TrackChunkId): Distance
    fun getTrackFromChunk(trackChunk: TrackChunkId): TrackSectionId

    // Operational points
    fun getTrackChunkOperationalPointParts(trackChunk: TrackChunkId): StaticIdxList<OperationalPointPart>
    fun getOperationalPointPartChunk(operationalPoint: OperationalPointPartId): TrackChunkId
    fun getOperationalPointPartChunkOffset(operationalPoint: OperationalPointPartId): Distance
    fun getOperationalPointPartName(operationalPoint: OperationalPointPartId): String

    // non-overlapping attributes:
    fun getTrackChunkSlope(trackChunk: DirTrackChunkId): DistanceRangeMap<Double>
    // TODO: voltages
    // TODO: loading gauge

    // overlapping attributes:
    // TODO: speed sections
}
