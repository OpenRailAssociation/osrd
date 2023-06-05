package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.railjson.schema.geom.LineString
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxList


/** A track chunk are internal subdivisions of track sections. These subdivisions are separated by detectors. */
sealed interface OperationalPoint
typealias OperationalPointId = StaticIdx<OperationalPoint>

interface TrackProperties : PathProperties {
    fun getTrackChunkGeom(trackChunk: TrackChunkId): LineString
    fun getTrackChunkLength(trackChunk: TrackChunkId): Distance
    fun getTrackChunkOffset(trackChunk: TrackChunkId): Distance
    fun getTrackFromChunk(trackChunk: TrackChunkId): TrackSectionId

    // Operational points
    fun getTrackChunkOperationalPoints(trackChunk: TrackChunkId): StaticIdxList<OperationalPoint>
    fun getOperationalPointChunk(operationalPoint: OperationalPointId): TrackChunkId
    fun getOperationalPointChunkOffset(operationalPoint: OperationalPointId): Distance
    fun getOperationalPointName(operationalPoint: OperationalPointId): String

    // non-overlapping attributes:
    fun getTrackChunkSlope(trackChunk: DirTrackChunkId): DistanceRangeMap<Double>
    // TODO: voltages
    // TODO: loading gauge

    // overlapping attributes:
    // TODO: speed sections
}
