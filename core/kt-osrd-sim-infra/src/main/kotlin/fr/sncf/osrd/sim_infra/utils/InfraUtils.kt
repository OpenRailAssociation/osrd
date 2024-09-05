package fr.sncf.osrd.sim_infra.utils

import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.*

fun TrackNetworkInfra.getNextTrackSections(
    trackSection: DirTrackSectionId
): DirStaticIdxList<TrackSection> {
    val nextTrackSections = mutableDirStaticIdxArrayListOf<TrackSection>()
    val node = getNextTrackNode(trackSection)
    if (!node.isNone) {
        val configs = getTrackNodeConfigs(node.asIndex())
        for (config in configs) {
            val nextTrackSection = getNextTrackSection(trackSection, config)
            if (!nextTrackSection.isNone) nextTrackSections.add(nextTrackSection.asIndex())
        }
    }
    return nextTrackSections
}

/** Converts a list of dir chunks into a list of routes */
fun BlockInfra.chunksToRoutes(
    infra: RawSignalingInfra,
    pathChunks: DirStaticIdxList<TrackChunk>
): StaticIdxList<Route> {
    var chunkStartIndex = 0
    val res = mutableStaticIdxArrayListOf<Route>()
    while (chunkStartIndex < pathChunks.size) {
        val route = findRoute(infra, this, pathChunks, chunkStartIndex, chunkStartIndex != 0)
        res.add(route)
        val chunkSetOnRoute = infra.getChunksOnRoute(route).toSet()
        while (
            chunkStartIndex < pathChunks.size &&
                chunkSetOnRoute.contains(pathChunks[chunkStartIndex])
        ) chunkStartIndex++ // Increase the index in the chunk path, for as long as it is covered by
        // the route
    }
    return res
}

/** Returns the list of dir chunk id on the given block list */
fun BlockInfra.chunksOnBlocks(blockIds: List<BlockId>): DirStaticIdxList<TrackChunk> {
    val res = mutableDirStaticIdxArrayListOf<TrackChunk>()
    for (block in blockIds) for (chunk in getTrackChunksFromBlock(block)) res.add(chunk)
    return res
}

/** Returns all routes that cover the given block */
fun BlockInfra.routesOnBlock(rawInfra: RawInfra, block: BlockId): StaticIdxList<Route> {
    val chunks = getTrackChunksFromBlock(block)
    val routes = rawInfra.getRoutesOnTrackChunk(chunks[0])
    val res = mutableStaticIdxArrayListOf<Route>()
    for (routeId in routes) {
        if (getRouteBlocks(rawInfra, routeId).contains(block)) {
            res.add(routeId)
        }
    }
    return res
}

/** Returns the blocks that follow the given one */
fun BlockInfra.getNextBlocks(infra: RawSignalingInfra, blockId: BlockId): Set<BlockId> {
    val entry = getBlockExit(infra, blockId)
    return getBlocksStartingAtDetector(entry).toSet()
}

/** Returns the block's entry detector */
fun BlockInfra.getBlockEntry(rawInfra: RawInfra, block: BlockId): DirDetectorId {
    val blockPath: StaticIdxList<ZonePath> = getBlockPath(block)
    val firstZone: ZonePathId = blockPath[0]
    return rawInfra.getZonePathEntry(firstZone)
}

/** Returns the block's exit detector */
fun BlockInfra.getBlockExit(rawInfra: RawInfra, block: BlockId): DirDetectorId {
    val blockPath: StaticIdxList<ZonePath> = getBlockPath(block)
    val lastZonePath: ZonePathId = blockPath[blockPath.size - 1]
    return rawInfra.getZonePathExit(lastZonePath)
}

/** Returns the blocks that lead into the given one */
fun BlockInfra.getPreviousBlocks(infra: RawSignalingInfra, blockId: BlockId): Set<BlockId> {
    val entry = getBlockEntry(infra, blockId)
    return getBlocksEndingAtDetector(entry).toSet()
}

/** Returns the route's corresponding blocks */
fun BlockInfra.getRouteBlocks(
    rawInfra: RawInfra,
    route: RouteId,
    allowedSigSystems: StaticIdxList<SignalingSystem>? = null
): StaticIdxList<Block> {
    val blockPaths =
        recoverBlocks(rawInfra, this, mutableStaticIdxArrayListOf(route), allowedSigSystems)
    if (blockPaths.isEmpty()) return mutableStaticIdxArrayListOf()
    // No signaling system for now, take the first block path possibility.
    // Correct when signalisation is taken into account.
    val blocks = blockPaths[0].toBlockList()
    return blocks
}

/** Finds a valid route that follows the given path */
private fun findRoute(
    infra: RawSignalingInfra,
    blockInfra: BlockInfra,
    chunks: DirStaticIdxList<TrackChunk>,
    startIndex: Int,
    routeMustIncludeStart: Boolean
): RouteId {
    val routes = infra.getRoutesOnTrackChunk(chunks[startIndex])

    // We need to evaluate the longest route first, in case one route covers a subset of another
    val sortedRoutes = routes.sortedBy { r -> -infra.getChunksOnRoute(r).size }
    for (routeId in sortedRoutes) {
        if (routeMatchPath(infra, blockInfra, chunks, startIndex, routeMustIncludeStart, routeId)) {
            return routeId
        }
    }
    throw OSRDError(ErrorType.MissingRouteFromChunkPath)
}

/** Returns false if the route differs from the path */
private fun routeMatchPath(
    infra: RawSignalingInfra,
    blockInfra: BlockInfra,
    chunks: DirStaticIdxList<TrackChunk>,
    chunkIndex: Int,
    routeMustIncludeStart: Boolean,
    routeId: RouteId
): Boolean {
    var mutChunkIndex = chunkIndex
    if (!routeHasBlockPath(infra, blockInfra, routeId))
        return false // Filter out routes that don't have block, they would cause issues later on
    val firstChunk = chunks[mutChunkIndex]
    val routeChunks = infra.getChunksOnRoute(routeId)
    var routeChunkIndex = 0
    if (routeMustIncludeStart) {
        if (routeChunks[0] != firstChunk) return false
    } else {
        while (routeChunks[routeChunkIndex] != firstChunk) routeChunkIndex++
    }
    while (true) {
        if (routeChunkIndex == routeChunks.size) return true // end of route
        if (mutChunkIndex == chunks.size) return true // end of path
        if (routeChunks[routeChunkIndex] != chunks[mutChunkIndex])
            return false // route and path differ
        routeChunkIndex++
        mutChunkIndex++
    }
}

/**
 * Returns true if the route contains a valid block path.
 *
 * This should always be true, but it can be false on infrastructures with errors in its signaling
 * data (such as the ones imported from poor data sources). At this step we know that there is at
 * least one route with a valid block path, we just need to filter out the ones that don't.
 */
private fun routeHasBlockPath(
    infra: RawSignalingInfra,
    blockInfra: BlockInfra,
    routeId: RouteId
): Boolean {
    val blockPaths = recoverBlocks(infra, blockInfra, mutableStaticIdxArrayListOf(routeId), null)
    return blockPaths.isNotEmpty()
}
