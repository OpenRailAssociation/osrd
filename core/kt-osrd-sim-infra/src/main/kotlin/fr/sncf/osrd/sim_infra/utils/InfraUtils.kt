package fr.sncf.osrd.sim_infra.utils

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.logger
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf

fun TrackNetworkInfra.getNextTrackSections(
    trackSection: DirTrackSectionId
): List<DirTrackSectionId> {
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

/** Returns all routes that cover the given block */
fun BlockInfra.routesOnBlock(rawInfra: RawInfra, block: BlockId): List<RouteId> {
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

/** Returns the block's entry detector */
fun BlockInfra.getBlockEntry(rawInfra: RawInfra, block: BlockId): DirDetectorId {
    val blockZonePaths = getBlockZonePaths(block)
    val firstZone: ZonePathId = blockZonePaths[0]
    return rawInfra.getZonePathEntry(firstZone)
}

/** Returns the block's exit detector */
fun BlockInfra.getBlockExit(rawInfra: RawInfra, block: BlockId): DirDetectorId {
    val blockZonePaths = getBlockZonePaths(block)
    val lastZonePath: ZonePathId = blockZonePaths[blockZonePaths.size - 1]
    return rawInfra.getZonePathExit(lastZonePath)
}

/** Returns the route's corresponding blocks */
fun BlockInfra.getRouteBlocks(
    rawInfra: RawInfra,
    route: RouteId,
    allowedSigSystems: List<SignalingSystemId>? = null,
): List<BlockId> {
    val blockPaths =
        recoverBlocks(rawInfra, this, mutableStaticIdxArrayListOf(route), allowedSigSystems)
    if (blockPaths.isEmpty()) {
        // quite "common" situation
        logger.trace("Route ${rawInfra.getRouteName(route)} has no block")
        return mutableStaticIdxArrayListOf()
    }
    // No signaling system for now, take the first block path possibility.
    // Correct when signaling is taken into account.
    val blocks = blockPaths[0].toBlockList()
    return blocks
}
