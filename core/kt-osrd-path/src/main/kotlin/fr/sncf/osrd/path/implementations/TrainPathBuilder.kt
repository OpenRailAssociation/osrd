package fr.sncf.osrd.path.implementations

import fr.sncf.osrd.path.interfaces.*
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.toIdxList
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Offset.Companion.max
import fr.sncf.osrd.utils.units.Offset.Companion.min
import fr.sncf.osrd.utils.units.meters

/**
 * This file lists all usual builder functions to generate train paths, with useful private methods
 * to help build them.
 *
 * In the past we've had too many "path conversion methods", the goal here is to only keep the
 * actual use cases and not migrate every way to generate path objects.
 *
 * Note: several functions could be optimized at the cost of increased code complexity, if a
 * profiler leads here.
 */
fun buildTrainPath(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    blockId: BlockId,
    beginOffset: Offset<Block> = Offset(0.meters),
    endOffset: Offset<Block> = blockInfra.getBlockLength(blockId),
    routes: List<RouteId>? = null,
    routeNames: List<String>? = null,
    electricalProfileMapping: ElectricalProfileMapping? = null,
): TrainPath {
    require(routes == null || routeNames == null)
    val blockMap =
        distanceRangeMapOf(
            DistanceRangeMap.RangeMapEntry(
                0.meters,
                endOffset - beginOffset,
                BlockRange(blockId, beginOffset, endOffset),
            )
        )
    val chunkMap = generateTrackChunks(rawInfra, blockInfra, blockMap)
    val routeIds = routes ?: routeNames?.map { rawInfra.getRouteFromName(it) }
    val routeMap = routeIds?.let { generateRouteRanges(rawInfra, chunkMap, it) }
    return TrainPathNoBacktrack(
        rawInfra,
        makePathProperties(rawInfra, buildChunkPath(rawInfra, chunkMap), routeIds),
        routeMap,
        blockMap,
        chunkMap,
        electricalProfileMapping,
    )
}

private fun generateTrackChunks(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    blocks: DistanceRangeMap<BlockRange>,
): DistanceRangeMap<DirChunkRange> {
    val res = distanceRangeMapOf<DirChunkRange>()
    var prevUsedChunkLength = 0.meters
    for (entry in blocks) {
        val blockRange = entry.value
        var currentChunkOffset = Offset<Block>(0.meters)
        for (chunk in blockInfra.getTrackChunksFromBlock(blockRange.value)) {
            val chunkLength = rawInfra.getTrackChunkLength(chunk.value)

            val chunkStart = Offset<TrackChunk>(blockRange.from - currentChunkOffset)
            val chunkEnd = Offset<TrackChunk>(blockRange.to - currentChunkOffset)
            val chunkRange =
                DirChunkRange(chunk, max(chunkStart, Offset.zero()), min(chunkEnd, chunkLength))
            if (chunkRange.length > 0.meters) {
                res.put(prevUsedChunkLength, prevUsedChunkLength + chunkRange.length, chunkRange)
                prevUsedChunkLength += chunkRange.length
            }

            currentChunkOffset += chunkLength.distance
        }
    }
    return res
}

private fun generateRouteRanges(
    rawInfra: RawInfra,
    chunks: DistanceRangeMap<DirChunkRange>,
    routes: List<RouteId>,
): DistanceRangeMap<RouteRange> {
    val res = distanceRangeMapOf<RouteRange>()
    val mappedChunks = chunks.map { it.value }.associateBy { it.value }
    var prevRouteUsedLength = 0.meters
    for (route in routes) {
        // We look for the first and last point where the route is used by a chunk.
        // We assume that the chunk list is continuous and follows the route.
        var usedRouteStart = Offset<Route>(Distance.MAX)
        var usedRouteEnd = Offset<Route>(0.meters)
        val chunksOnRoute = rawInfra.getChunksOnRoute(route)

        var chunkOffsetOnRoute = Offset<Route>(0.meters)
        for (chunk in chunksOnRoute) {
            mappedChunks[chunk]?.let { locatedChunk ->
                usedRouteStart =
                    min(usedRouteStart, chunkOffsetOnRoute + locatedChunk.from.distance)
                usedRouteEnd = max(usedRouteEnd, chunkOffsetOnRoute + locatedChunk.to.distance)
            }
            chunkOffsetOnRoute += rawInfra.getTrackChunkLength(chunk.value).distance
        }

        val usedRouteLength = usedRouteEnd - usedRouteStart
        if (usedRouteLength > 0.meters) {
            res.put(
                prevRouteUsedLength,
                prevRouteUsedLength + usedRouteLength,
                RouteRange(route, usedRouteStart, usedRouteEnd),
            )
            prevRouteUsedLength += usedRouteLength
        }
    }
    return res
}

private fun buildChunkPath(infra: RawInfra, chunkMap: DistanceRangeMap<DirChunkRange>): ChunkPath {
    val chunkRanges = chunkMap.asList().map { it.value }
    val chunkIds = chunkRanges.map { it.value }
    val beginOffset = chunkRanges.first().from
    val endOffset = beginOffset + (chunkMap.upperBound() - chunkMap.lowerBound())
    return buildChunkPath(infra, chunkIds.toIdxList(), beginOffset.cast(), endOffset.cast())
}
