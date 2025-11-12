package fr.sncf.osrd.path.implementations

import fr.sncf.osrd.path.interfaces.*
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Directed
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.forceDirected
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
    val blockList =
        listOf(
            BlockRange(
                blockId,
                beginOffset,
                endOffset,
                Offset.zero(),
                Offset(endOffset - beginOffset),
                blockInfra.getBlockLength(blockId),
            )
        )
    return buildTrainPathFromBlockRanges(
        rawInfra,
        blockInfra,
        blockList,
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
    var prevBlockFinalOffset: Offset<TrainPath> = Offset.zero()
    val blockRanges = mutableListOf<BlockRange>()
    for (block in blocks) {
        val blockLength = blockInfra.getBlockLength(block)
        blockRanges.add(
            BlockRange(
                block,
                Offset.zero(),
                blockLength,
                prevBlockFinalOffset,
                prevBlockFinalOffset + blockLength.distance,
                blockLength,
            )
        )
        prevBlockFinalOffset += blockLength.distance
    }
    return buildTrainPathFromBlockRanges(
        rawInfra,
        blockInfra,
        blockRanges,
        routes,
        routeNames,
        electricalProfileMapping,
    )
}

/** Build a TrainPath from a list of block ranges. */
fun buildTrainPathFromBlockRanges(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    blockRanges: List<BlockRange>,
    routes: List<RouteId>? = null,
    routeNames: List<String>? = null,
    electricalProfileMapping: ElectricalProfileMapping? = null,
    haveApproximateBlocks: Boolean = false,
): TrainPath {
    require(routes == null || routeNames == null)
    val chunks = generateTrackChunks(rawInfra, blockInfra, blockRanges)
    val routeIds = routes ?: routeNames?.map { rawInfra.getRouteFromName(it) }
    val routes = routeIds?.let { generateRouteRanges(rawInfra, chunks, it) }
    return TrainPathNoBacktrack(
        rawInfra,
        blockInfra,
        makePathProperties(rawInfra, buildChunkPath(rawInfra, chunks), routeIds),
        routes,
        blockRanges,
        chunks,
        electricalProfileMapping,
        haveApproximateBlocks = haveApproximateBlocks,
    )
}

/**
 * Build a TrainPath from chunk ranges. Blocks are filled in by picking any block on each range.
 * Shouldn't be used where blocks actually matter (such as conflict detection).
 */
fun buildTrainPathFromChunks(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    chunkRanges: List<DirChunkRange>,
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
        haveApproximateBlocks = true,
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
    val chunkRanges = mutableListOf<PartialDirChunkRange>()
    var prevChunkFinalOffset = 0.meters
    for ((i, chunk) in chunkPath.chunks.withIndex()) {
        val isFirst = i == 0
        val isLast = i == chunkPath.chunks.size - 1
        val chunkLength = rawInfra.getTrackChunkLength(chunk.value)
        val from =
            if (isFirst) chunkPath.beginOffset.cast<Directed<TrackChunk>>() else Offset.zero()
        var to = chunkLength.forceDirected()
        if (isLast) to = Offset(chunkPath.endOffset.distance - prevChunkFinalOffset)
        chunkRanges.add(PartialDirChunkRange(chunk, from, to, chunkLength.forceDirected()))
        prevChunkFinalOffset += chunkLength.distance
    }
    return buildTrainPathFromChunks(
        rawInfra,
        blockInfra,
        buildRangeList(chunkRanges),
        routes,
        routeNames,
        electricalProfileMapping,
    )
}

/** Create a list of ranges from a list of partial ranges, mapping path offsets (starting at 0). */
fun <ValueType, OffsetType> buildRangeList(
    ranges: List<PartialGenericLinearRange<ValueType, OffsetType>>
): List<GenericLinearRange<ValueType, OffsetType>> {
    // Merge adjacent ranges of the same object
    val merged = mutableListOf<PartialGenericLinearRange<ValueType, OffsetType>>()
    for (range in ranges) {
        if (merged.isEmpty() || merged.last().value != range.value) merged.add(range)
        else merged[merged.lastIndex] = merged.last().copy(objectEnd = range.objectEnd)
    }

    var prevRangeLength: Offset<TrainPath> = Offset.zero()
    val res = mutableListOf<GenericLinearRange<ValueType, OffsetType>>()
    for (range in merged) {
        res.add(
            GenericLinearRange(
                range.value,
                range.objectBegin,
                range.objectEnd,
                prevRangeLength,
                prevRangeLength + range.length,
                range.objectLength,
            )
        )
        prevRangeLength += range.length
    }
    return res
}

/** Generate the chunk ranges from given block ranges. */
private fun generateTrackChunks(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    blocks: List<BlockRange>,
): List<DirChunkRange> {
    val res =
        blocks.mapSubObjects(
            blockInfra::getTrackChunksFromBlock,
            { rawInfra.getTrackChunkLength(it.value).forceDirected() },
        )
    // We need to filter out zero-length ranges that aren't first or last
    val filtered = mutableListOf<DirChunkRange>()
    for ((i, chunkRange) in res.withIndex()) {
        if (i == 0 || i == res.size - 1 || chunkRange.length > 0.meters) filtered.add(chunkRange)
    }
    return filtered
}

/**
 * Generate the route ranges from given chunk ranges, with actual route IDs given as input. This
 * just maps the offsets and precise ranges.
 */
internal fun generateRouteRanges(
    rawInfra: RawInfra,
    chunks: List<DirChunkRange>,
    routes: List<RouteId>,
): List<RouteRange> {
    // This implementation isn't the most optimized as we go over the chunk list several times. But
    // the "proper" version is quite more verbose and complex. The difficult part is handling a
    // single route that is partially used both at the start and end of the path.
    // The profiler hints that this isn't a function worth making more complex for speed.
    if (routes.isEmpty()) return listOf()
    val res = mutableListOf<RouteRange>()
    var routeIndex = 0
    fun getRouteRange(chunk: DirChunkRange): RouteRange {
        while (true) {
            assert(routeIndex < routes.size)
            val route = routes[routeIndex]
            val res =
                chunk.mapOuterObject<RouteId, Route>(
                    route,
                    rawInfra.getRouteLength(route),
                    rawInfra.getChunksOnRoute(route),
                ) {
                    rawInfra.getTrackChunkLength(it.value).forceDirected()
                }
            if (res != null) return res
            // If not found in the current route, move on to the next
            routeIndex++
        }
    }
    for (chunk in chunks) res.addLinearObjects(listOf(getRouteRange(chunk)))
    return res
}

/**
 * Build a ChunkPath from the given chunk ranges. Used to instantiate the internal `PathProperties`
 * instance.
 */
private fun buildChunkPath(infra: RawInfra, chunks: List<DirChunkRange>): ChunkPath {
    val chunkIds = chunks.map { it.value }
    val beginOffset = chunks.first().objectBegin
    val endOffset = beginOffset + (chunks.last().pathEnd - chunks.first().pathBegin)
    return buildChunkPath(infra, chunkIds, beginOffset.cast(), endOffset.cast())
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
    chunks: List<DirChunkRange>,
): List<BlockRange> {
    val res = mutableListOf<PartialBlockRange>()
    for (dirChunkRange in chunks) {
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
            PartialBlockRange(
                block,
                chunkOffsetOnBlock + dirChunkRange.objectBegin.distance,
                chunkOffsetOnBlock + dirChunkRange.objectEnd.distance,
                blockInfra.getBlockLength(block),
            )
        res.add(newRange)
    }
    return buildRangeList(res)
}

/**
 * Intermediate object used to build lists of `GenericLinearRange`. The path offsets aren't set yet.
 */
data class PartialGenericLinearRange<ValueType, OffsetType>(
    val value: ValueType,
    val objectBegin: Offset<OffsetType>,
    val objectEnd: Offset<OffsetType>,
    val objectLength: Length<OffsetType>,
) {
    val length = objectEnd - objectBegin
}

typealias PartialLinearObjectRange<T> = PartialGenericLinearRange<StaticIdx<T>, T>

typealias PartialLinearDirObjectRange<T> = PartialGenericLinearRange<DirStaticIdx<T>, Directed<T>>

typealias PartialRouteRange = PartialLinearObjectRange<Route>

typealias PartialBlockRange = PartialLinearObjectRange<Block>

typealias PartialDirChunkRange = PartialLinearDirObjectRange<TrackChunk>
