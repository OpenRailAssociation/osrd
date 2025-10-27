package fr.sncf.osrd.utils

import fr.sncf.osrd.path.implementations.ChunkPath
import fr.sncf.osrd.path.interfaces.BlockPath
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeRange
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/**
 * Computes the offset between the beginning of the first block and the beginning of the train path
 */
fun trainPathBlockOffset(
    infra: RawInfra,
    blockInfra: BlockInfra,
    blockPath: List<BlockId>,
    chunkPath: ChunkPath,
): Offset<BlockPath> {
    val zonePaths = blockPath.flatMap { blockInfra.getBlockZonePaths(it) }
    return trainPathZonePathOffset(infra, zonePaths, chunkPath)
}

/**
 * Computes the offset between the beginning of the first zone path and the beginning of the train
 * path
 */
fun trainPathZonePathOffset(
    infra: RawInfra,
    zonePaths: List<ZonePathId>,
    chunkPath: ChunkPath,
): Offset<BlockPath> {
    var prevChunksLength = Offset<BlockPath>(0.meters)
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

/** Compute the block offset of a chunk on a block pathfinding edge. */
fun getBlockChunkOffset(
    blockInfra: BlockInfra,
    rawInfra: RawSignalingInfra,
    chunk: DirTrackChunkId,
    range: EdgeRange<BlockId, Block>,
): Offset<Block> {
    var offset = Offset<Block>(0.meters)
    for (dirChunkId in blockInfra.getTrackChunksFromBlock(range.edge)) {
        if (dirChunkId == chunk) break
        offset += rawInfra.getTrackChunkLength(dirChunkId.value).distance
    }
    return offset
}

/** Compute the route offset of a chunk on a route. */
fun getRouteChunkOffset(
    rawInfra: RawSignalingInfra,
    routeStaticIdx: RouteId,
    chunk: DirTrackChunkId,
): Offset<Route> {
    var offset = Offset<Route>(0.meters)
    for (dirChunkId in rawInfra.getChunksOnRoute(routeStaticIdx)) {
        if (dirChunkId == chunk) break
        offset += rawInfra.getTrackChunkLength(dirChunkId.value).distance
    }
    return offset
}
