package fr.sncf.osrd.path.implementations

import fr.sncf.osrd.path.interfaces.*
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/**
 * A ChunkPath is a list of directional track chunks which form a path, with beginOffset being the
 * offset on the first chunk, and endOffset on the last chunk. *
 *
 * TODO path migration: remove remaining uses
 */
data class ChunkPath(
    /**
     * Ordered list of chunks on the path. Chunks that are fully outside the path are trimmed. Note:
     * when the path starts or ends precisely at the border between two chunks, the extra bordering
     * chunks are included. But code that uses this class should ideally work with either version.
     */
    val chunks: List<DirTrackChunkId>,

    /**
     * Offset of the head of the train when it starts its path, compared to the start of the first
     * element in `chunks`.
     */
    val beginOffset: Offset<BlockPath>,

    /**
     * Offset of the head of the train when it ends its path, compared to the start of the first
     * element in `chunks`.
     */
    val endOffset: Offset<BlockPath>,
) {
    val length: Distance = endOffset.distance - beginOffset.distance
}

/**
 * Build chunkPath, which is the subset of the given chunks corresponding to the beginOffset and
 * endOffset. *
 */
fun buildChunkPath(
    infra: TrackProperties,
    chunks: List<DirTrackChunkId>,
    pathBeginOffset: Offset<BlockPath>,
    pathEndOffset: Offset<BlockPath>,
): ChunkPath {
    val filteredChunks = mutableDirStaticIdxArrayListOf<TrackChunk>()
    var totalChunksLength = Offset<BlockPath>(0.meters)
    var mutBeginOffset = pathBeginOffset
    var mutEndOffset = pathEndOffset
    for (dirChunkId in chunks) {
        if (totalChunksLength > pathEndOffset) break
        val length = infra.getTrackChunkLength(dirChunkId.value)
        val chunkEndOffset = totalChunksLength + length.distance

        // if the chunk ends before the path starts, it can be safely skipped
        if (pathBeginOffset > chunkEndOffset) {
            mutBeginOffset -= length.distance
            mutEndOffset -= length.distance
        } else {
            filteredChunks.add(dirChunkId)
        }
        totalChunksLength += length.distance
    }
    return ChunkPath(filteredChunks, mutBeginOffset, mutEndOffset)
}
