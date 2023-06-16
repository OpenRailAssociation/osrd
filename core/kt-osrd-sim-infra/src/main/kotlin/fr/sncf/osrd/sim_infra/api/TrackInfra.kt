package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.reporting.exceptions.OSRDError.newUnknownTrackSectionError
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Distance


/** Detectors detect when trains arrive and leave a given point location */
sealed interface Detector
typealias DetectorId = StaticIdx<Detector>

/** A track chunk are internal subdivisions of track sections. These subdivisions are separated by detectors. */
sealed interface TrackChunk
typealias TrackChunkId = StaticIdx<TrackChunk>


@Suppress("INAPPLICABLE_JVM_NAME")
interface TrackInfra {
    @JvmName("getTrackSectionName")
    fun getTrackSectionName(trackSection: TrackSectionId): String
    fun getTrackSectionFromName(name: String): TrackSectionId?
    @JvmName("getTrackSectionChunks")
    fun getTrackSectionChunks(trackSection: TrackSectionId): StaticIdxList<TrackChunk>
    @JvmName("getTrackSectionLength")
    fun getTrackSectionLength(trackSection: TrackSectionId): Distance
}

/** A directional detector encodes a direction over a detector */
typealias DirDetectorId = DirStaticIdx<Detector>

/** A directional detector encodes a direction over a track chunk */
typealias DirTrackChunkId = DirStaticIdx<TrackChunk>
typealias OptDirTrackChunkId = OptDirStaticIdx<TrackChunk>

val <T> StaticIdx<T>.increasing get() = DirStaticIdx(this, Direction.INCREASING)
val <T> StaticIdx<T>.decreasing get() = DirStaticIdx(this, Direction.DECREASING)

/** Iterates over the elements in the right direction */
fun <T> StaticIdxList<T>.dirIter(direction: Direction): Iterable<DirStaticIdx<T>> {
    var list = this
    if (direction == Direction.DECREASING)
        list = list.reversed()
    val res = mutableDirStaticIdxArrayListOf<T>()
    for (element in list)
        res.add(DirStaticIdx(element, direction))
    return res
}

/** Get existing track section from name, throw if not found **/
fun getTrackSectionFromNameOrThrow(name: String, trackInfra: TrackInfra): TrackSectionId {
    return trackInfra.getTrackSectionFromName(name) ?: throw newUnknownTrackSectionError(name)
}