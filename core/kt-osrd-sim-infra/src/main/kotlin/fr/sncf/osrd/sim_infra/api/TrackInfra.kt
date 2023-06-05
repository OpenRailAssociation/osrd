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
    fun getTrackSectionFromId(id: String): TrackSectionId?
    fun getTrackSectionChunks(trackSection: TrackSectionId): StaticIdxList<TrackChunk>
    fun getDirTrackSectionChunks(trackSection: TrackSectionId, direction: Direction): DirStaticIdxList<TrackChunk>
}

/** A directional detector encodes a direction over a detector */
typealias DirDetectorId = DirStaticIdx<Detector>

/** A directional detector encodes a direction over a track chunk */
typealias DirTrackChunkId = DirStaticIdx<TrackChunk>
typealias OptDirTrackChunkId = OptDirStaticIdx<TrackChunk>

val <T> StaticIdx<T>.increasing get() = DirStaticIdx(this, Direction.INCREASING)
val <T> StaticIdx<T>.decreasing get() = DirStaticIdx(this, Direction.DECREASING)
