package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.*


/** Detectors detect when trains arrive and leave a given point location */
sealed interface Detector
typealias DetectorId = StaticIdx<Detector>

/** A track chunk are internal subdivisions of track sections. These subdivisions are separated by detectors. */
sealed interface TrackChunk
typealias TrackChunkId = StaticIdx<TrackChunk>


interface TrackInfra {
    fun getTrackSectionId(trackSection: TrackSectionId): String
    fun getTrackSectionDetectors(trackSection: TrackSectionId): StaticIdxList<Detector>
    fun getTrackSectionChunks(trackSection: TrackSectionId): StaticIdxList<TrackChunk>
}

/** A directional detector encodes a direction over a detector */
typealias DirDetectorId = DirStaticIdx<Detector>
val DetectorId.increasing get() = DirDetectorId(this, Direction.INCREASING)
val DetectorId.decreasing get() = DirDetectorId(this, Direction.DECREASING)


/** A directional detector encodes a direction over a track chunk */
typealias DirTrackChunkId = DirStaticIdx<TrackChunk>
typealias OptDirTrackChunkId = OptDirStaticIdx<TrackChunk>
