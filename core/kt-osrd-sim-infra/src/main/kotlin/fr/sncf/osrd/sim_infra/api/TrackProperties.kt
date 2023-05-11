package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.railjson.schema.geom.LineString
import fr.sncf.osrd.utils.indexing.StaticIdxCollection
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.DistanceRangeMap

interface TrackProperties {
    fun getTrackChunkGeom(trackChunk: TrackChunkId): LineString
    fun getTrackChunkLength(trackChunk: TrackChunkId): Distance
    fun getTrackFromChunk(trackChunk: TrackChunkId): TrackSectionId

    // non-overlapping attributes:
    fun getTrackChunkSlope(trackChunk: DirTrackChunkId): DistanceRangeMap<Double>
    // TODO: voltages
    // TODO: loading gauge

    // overlapping attributes:
    // TODO: speed sections
    // TODO: operational points
}
