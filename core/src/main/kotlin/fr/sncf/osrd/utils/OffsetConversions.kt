package fr.sncf.osrd.utils

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/** Returns the offset where the train actually starts, compared to the start of the first route. */
fun getRoutePathStartOffset(
    infra: RawInfra,
    chunkPath: ChunkPath,
    routes: StaticIdxList<Route>
): Offset<Path> {
    val zonePaths = routes.flatMap { infra.getRoutePath(it) }
    return trainPathZonePathOffset(infra, zonePaths, chunkPath)
}

/**
 * Computes the offset between the beginning of the first block and the beginning of the train path
 */
fun trainPathBlockOffset(
    infra: RawInfra,
    blockInfra: BlockInfra,
    blockPath: StaticIdxList<Block>,
    chunkPath: ChunkPath
): Offset<Path> {
    val zonePaths = blockPath.flatMap { blockInfra.getBlockPath(it) }
    return trainPathZonePathOffset(infra, zonePaths, chunkPath)
}

/**
 * Computes the offset between the beginning of the first zone path and the beginning of the train
 * path
 */
fun trainPathZonePathOffset(
    infra: RawInfra,
    zonePaths: List<ZonePathId>,
    chunkPath: ChunkPath
): Offset<Path> {
    var prevChunksLength = Offset<Path>(0.meters)
    val routeChunks = zonePaths.flatMap { infra.getZonePathChunks(it) }

    val firstChunk = Pair(chunkPath.chunks[0], chunkPath.beginOffset)
    val startChunkCandidates = mutableListOf(firstChunk)
    val firstChunkLength = infra.getTrackChunkLength(firstChunk.first.value)
    if (firstChunkLength == firstChunk.second && chunkPath.chunks.size > 1) {
        // If the path starts precisely at the end of the first chunk, it may not be present in the
        // route path. We can look for the next chunk instead.
        startChunkCandidates.add(Pair(chunkPath.chunks[1], Offset.zero()))
    }

    for (chunk in routeChunks) {
        val matchingStart = startChunkCandidates.firstOrNull { chunk == it.first }
        if (matchingStart != null) {
            return prevChunksLength + matchingStart.second.distance
        }
        val len = infra.getTrackChunkLength(chunk.value).distance
        prevChunksLength += len
    }
    throw RuntimeException("Unreachable (couldn't find first chunk in zone path list)")
}
