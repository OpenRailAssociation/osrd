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
import fr.sncf.osrd.utils.units.sumOffsets

/**
 * This file lists all usual builder functions to generate train paths, with useful private methods
 * to help build them.
 *
 * Note: several functions could be optimized at the cost of increased code complexity, if a
 * profiler leads here.
 */

/** Build a TrainPath from a single block. */
fun buildTrainPathFromBlock(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    blockId: BlockId,
    beginOffset: Offset<Block> = Offset(0.meters),
    endOffset: Offset<Block> = blockInfra.getBlockLength(blockId),
    routes: List<RouteId>? = null,
    routeNames: List<String>? = null,
    electricalProfileMapping: ElectricalProfileMapping? = null,
): TrainPath {
    val blockMap =
        distanceRangeMapOf(
            DistanceRangeMap.RangeMapEntry(
                0.meters,
                endOffset - beginOffset,
                BlockRange(blockId, beginOffset, endOffset),
            )
        )
    return buildTrainPathFromBlockRanges(
        rawInfra,
        blockInfra,
        blockMap,
        routes,
        routeNames,
        electricalProfileMapping,
    )
}

/** Build a TrainPath from a list of blocks (each used in full). */
fun buildTrainPathFromBlocks(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    blocks: List<BlockId>,
    routes: List<RouteId>? = null,
    routeNames: List<String>? = null,
    electricalProfileMapping: ElectricalProfileMapping? = null,
): TrainPath {
    var prevBlockLength = 0.meters
    val entries = mutableListOf<DistanceRangeMap.RangeMapEntry<BlockRange>>()
    for (block in blocks) {
        val blockLength = blockInfra.getBlockLength(block)
        entries.add(
            DistanceRangeMap.RangeMapEntry(
                prevBlockLength,
                prevBlockLength + blockLength.distance,
                BlockRange(block, Offset.zero(), blockLength),
            )
        )
        prevBlockLength += blockLength.distance
    }
    val blockMap = distanceRangeMapOf(entries)
    return buildTrainPathFromBlockRanges(
        rawInfra,
        blockInfra,
        blockMap,
        routes,
        routeNames,
        electricalProfileMapping,
    )
}

/** Build a TrainPath from a list of block ranges. */
fun buildTrainPathFromBlockRanges(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    blockRanges: DistanceRangeMap<BlockRange>,
    routes: List<RouteId>? = null,
    routeNames: List<String>? = null,
    electricalProfileMapping: ElectricalProfileMapping? = null,
): TrainPath {
    require(routes == null || routeNames == null)
    val chunkMap = generateTrackChunks(rawInfra, blockInfra, blockRanges)
    val routeIds = routes ?: routeNames?.map { rawInfra.getRouteFromName(it) }
    val routeMap = routeIds?.let { generateRouteRanges(rawInfra, chunkMap, it) }
    return TrainPathNoBacktrack(
        rawInfra,
        makePathProperties(rawInfra, buildChunkPath(rawInfra, chunkMap), routeIds),
        routeMap,
        blockRanges,
        chunkMap,
        electricalProfileMapping,
    )
}

/**
 * Build a TrainPath from chunk ranges. Blocks are filled in by picking any block on each range.
 * Shouldn't be used where blocks actually matter (such as conflict detection).
 */
fun buildTrainPathFromChunks(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    chunkRanges: DistanceRangeMap<DirChunkRange>,
    routes: List<RouteId>? = null,
    routeNames: List<String>? = null,
    electricalProfileMapping: ElectricalProfileMapping? = null,
): TrainPath {
    val blockRanges = findBlockPath(rawInfra, blockInfra, chunkRanges)
    return buildTrainPathFromBlockRanges(
        rawInfra,
        blockInfra,
        blockRanges,
        routes,
        routeNames,
        electricalProfileMapping,
    )
}

/**
 * Build a TrainPath from chunk path. Blocks are filled in by picking any block on each range.
 * Shouldn't be used where blocks actually matter (such as conflict detection).
 */
fun buildTrainPathFromChunkPath(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    chunkPath: ChunkPath,
    routes: List<RouteId>? = null,
    routeNames: List<String>? = null,
    electricalProfileMapping: ElectricalProfileMapping? = null,
): TrainPath {
    val chunkRanges = mutableListOf<DirChunkRange>()
    var prevChunkLength = 0.meters
    for ((i, chunk) in chunkPath.chunks.withIndex()) {
        val isFirst = i == 0
        val isLast = i == chunkPath.chunks.size - 1
        val chunkLength = rawInfra.getTrackChunkLength(chunk.value)
        val from = if (isFirst) chunkPath.beginOffset.cast<TrackChunk>() else Offset.zero()
        var to = chunkLength
        if (isLast) to = Offset(chunkPath.endOffset.distance - prevChunkLength)
        chunkRanges.add(DirChunkRange(chunk, from, to))
        prevChunkLength += chunkLength.distance
    }
    return buildTrainPathFromChunks(
        rawInfra,
        blockInfra,
        buildRangeMap(chunkRanges),
        routes,
        routeNames,
        electricalProfileMapping,
    )
}

/** Create a range map from list of ranges, mapping them to the path offset (starting at 0). */
fun <ValueType, OffsetType> buildRangeMap(
    ranges: List<GenericLinearRange<ValueType, OffsetType>>
): DistanceRangeMap<GenericLinearRange<ValueType, OffsetType>> {
    var prevRangeLength = 0.meters
    val entries =
        mutableListOf<DistanceRangeMap.RangeMapEntry<GenericLinearRange<ValueType, OffsetType>>>()
    for (range in ranges) {
        entries.add(
            DistanceRangeMap.RangeMapEntry(prevRangeLength, prevRangeLength + range.length, range)
        )
        prevRangeLength += range.length
    }
    return distanceRangeMapOf(entries)
}

/** Generate the chunk ranges from given block ranges. */
private fun generateTrackChunks(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    blocks: DistanceRangeMap<BlockRange>,
): DistanceRangeMap<DirChunkRange> {
    val res = mutableListOf<DirChunkRange>()
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
                res.add(chunkRange)
            }

            currentChunkOffset += chunkLength.distance
        }
    }
    return buildRangeMap(res)
}

/**
 * Generate the route ranges from given chunk ranges, with actual route IDs given as input. This
 * just maps the offsets and precise ranges.
 */
private fun generateRouteRanges(
    rawInfra: RawInfra,
    chunks: DistanceRangeMap<DirChunkRange>,
    routes: List<RouteId>,
): DistanceRangeMap<RouteRange> {
    val res = mutableListOf<RouteRange>()
    val mappedChunks = chunks.map { it.value }.associateBy { it.value }
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
            res.add(RouteRange(route, usedRouteStart, usedRouteEnd))
        }
    }
    return buildRangeMap(res)
}

/**
 * Build a ChunkPath from the given chunk ranges. Used to instantiate the internal `PathProperties`
 * instance.
 */
private fun buildChunkPath(infra: RawInfra, chunkMap: DistanceRangeMap<DirChunkRange>): ChunkPath {
    val chunkRanges = chunkMap.asList().map { it.value }
    val chunkIds = chunkRanges.map { it.value }
    val beginOffset = chunkRanges.first().from
    val endOffset = beginOffset + (chunkMap.upperBound() - chunkMap.lowerBound())
    return buildChunkPath(infra, chunkIds.toIdxList(), beginOffset.cast(), endOffset.cast())
}

/**
 * Find a valid block sequence covering the path.
 *
 * We don't look for the best matching one, blocks may only be partially used even in the middle of
 * the path. Used in places where exact blocks don't matter that much (like path properties
 * endpoint).
 */
private fun findBlockPath(
    infra: RawInfra,
    blockInfra: BlockInfra,
    chunks: DistanceRangeMap<DirChunkRange>,
): DistanceRangeMap<BlockRange> {
    val res = mutableListOf<BlockRange>()
    for (chunkEntry in chunks) {
        val dirChunkRange = chunkEntry.value
        val dirChunkId = dirChunkRange.value
        val block =
            blockInfra.getBlocksFromTrackChunk(dirChunkId.value, dirChunkId.direction).first()
        val allBlockChunks = blockInfra.getTrackChunksFromBlock(block)
        val chunkOffsetOnBlock =
            allBlockChunks
                .takeWhile { it != dirChunkId }
                .map { infra.getTrackChunkLength(it.value) }
                .sumOffsets()
                .cast<Block>()
        val newRange =
            BlockRange(
                block,
                chunkOffsetOnBlock + dirChunkRange.from.distance,
                chunkOffsetOnBlock + dirChunkRange.to.distance,
            )
        res.add(newRange)
    }
    return buildRangeMap(res)
}
