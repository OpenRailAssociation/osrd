package fr.sncf.osrd.api.pathfinding

import com.google.common.collect.Iterables
import fr.sncf.osrd.api.api_v2.DirectionalTrackRange
import fr.sncf.osrd.graph.PathfindingEdgeRangeId
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.impl.buildChunkPath
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/** Creates the path from a given block id */
@JvmName("makePathProps")
fun makePathProps(
    blockInfra: BlockInfra,
    rawInfra: RawSignalingInfra,
    blockIdx: BlockId,
    beginOffset: Offset<Block> = Offset(0.meters),
    endOffset: Offset<Block> = blockInfra.getBlockLength(blockIdx),
    routes: List<String>? = null
): PathProperties {
    return buildPathPropertiesFrom(
        rawInfra,
        blockInfra.getTrackChunksFromBlock(blockIdx),
        beginOffset.cast(),
        endOffset.cast(),
        routes?.map { r -> rawInfra.getRouteFromName(r) }
    )
}

/**
 * Creates the path from given blocks.
 *
 * @param rawInfra RawSignalingInfra
 * @param blockInfra BlockInfra
 * @param blockIds the blocks in the order they are encountered
 * @param offsetFirstBlock the path offset on the first block in millimeters
 * @param routes non-overlapping list of routes the path follows
 * @return corresponding path
 */
fun makePathProps(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    blockIds: List<BlockId>,
    offsetFirstBlock: Length<Path>,
    routes: List<RouteId>? = null
): PathProperties {
    val chunks = MutableDirStaticIdxArrayList<TrackChunk>()
    var totalLength: Length<Path> = Length(0.meters)
    for (blockId in blockIds) {
        for (zoneId in blockInfra.getBlockPath(blockId)) {
            chunks.addAll(rawInfra.getZonePathChunks(zoneId))
            totalLength += rawInfra.getZonePathLength(zoneId).distance
        }
    }
    return buildPathPropertiesFrom(rawInfra, chunks, offsetFirstBlock, totalLength, routes)
}

/** Creates a `Path` instance from a list of block ranges */
fun makePathProps(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    blockRanges: List<PathfindingEdgeRangeId<Block>>,
    routes: List<RouteId>? = null
): PathProperties {
    val chunkPath = makeChunkPath(rawInfra, blockInfra, blockRanges)
    return makePathProperties(rawInfra, chunkPath, routes = routes)
}

/** Builds a PathProperties from an RJSTrainPath */
fun makePathProps(rawInfra: RawSignalingInfra, rjsPath: RJSTrainPath): PathProperties {
    val chunkPath = makeChunkPath(rawInfra, rjsPath)
    return makePathProperties(rawInfra, chunkPath)
}

/** Builds a PathProperties from a List<TrackRange> */
fun makePathProps(
    rawInfra: RawSignalingInfra,
    trackRanges: List<DirectionalTrackRange>
): PathProperties {
    val chunkPath = makeChunkPath(rawInfra, trackRanges)
    return makePathProperties(rawInfra, chunkPath)
}

/** Creates a ChunkPath from a list of block ranges */
fun makeChunkPath(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    blockRanges: List<PathfindingEdgeRangeId<Block>>
): ChunkPath {
    assert(blockRanges.isNotEmpty())
    var totalBlockPathLength: Length<Path> = Length(0.meters)
    val chunks = MutableDirStaticIdxArrayList<TrackChunk>()
    for (range in blockRanges) {
        val zonePaths = blockInfra.getBlockPath(range.edge)
        for (zonePath in zonePaths) {
            chunks.addAll(rawInfra.getZonePathChunks(zonePath))
            val zoneLength = rawInfra.getZonePathLength(zonePath)
            totalBlockPathLength += zoneLength.distance
        }
    }
    val startOffset: Offset<Path> = blockRanges[0].start.cast()
    val lastRange = blockRanges[blockRanges.size - 1]
    val lastBlockLength = blockInfra.getBlockLength(lastRange.edge)
    val endOffset = totalBlockPathLength - lastBlockLength.distance + lastRange.end.distance
    return buildChunkPath(rawInfra, chunks, startOffset, endOffset)
}

/** Builds a ChunkPath from an RJSTrainPath */
fun makeChunkPath(rawInfra: RawSignalingInfra, rjsPath: RJSTrainPath): ChunkPath {
    val trackRanges = ArrayList<RJSDirectionalTrackRange?>()
    for (routePath in rjsPath.routePath) {
        for (trackRange in routePath.trackSections) {
            val lastTrackRange = Iterables.getLast(trackRanges, null)
            if (
                lastTrackRange != null && lastTrackRange.trackSectionID == trackRange.trackSectionID
            ) {
                assert(lastTrackRange.getEnd() == trackRange.getBegin())
                assert(lastTrackRange.direction == trackRange.direction)
                if (trackRange.direction == EdgeDirection.START_TO_STOP)
                    lastTrackRange.end = trackRange.end
                else lastTrackRange.begin = trackRange.begin
            } else {
                trackRanges.add(trackRange)
            }
        }
    }
    val chunks = MutableDirStaticIdxArrayList<TrackChunk>()
    for (trackRange in trackRanges) {
        val trackId = getTrackSectionFromNameOrThrow(trackRange!!.trackSectionID, rawInfra)
        val dir =
            if (trackRange.direction == EdgeDirection.START_TO_STOP) Direction.INCREASING
            else Direction.DECREASING
        val chunksOnTrack =
            if (dir == Direction.INCREASING) rawInfra.getTrackSectionChunks(trackId)
            else rawInfra.getTrackSectionChunks(trackId).reversed()
        for (chunk in chunksOnTrack) chunks.add(DirStaticIdx(chunk, dir))
    }
    val firstRange = trackRanges[0]
    var startOffset = fromMeters(firstRange!!.begin)
    if (firstRange.direction == EdgeDirection.STOP_TO_START) {
        val firstTrackId = getTrackSectionFromNameOrThrow(trackRanges[0]!!.trackSectionID, rawInfra)
        startOffset =
            rawInfra.getTrackSectionLength(firstTrackId).distance - fromMeters(firstRange.end)
    }
    val endOffset =
        startOffset +
            fromMeters(
                trackRanges
                    .stream()
                    .mapToDouble { r: RJSDirectionalTrackRange? -> r!!.end - r.begin }
                    .sum()
            )
    return buildChunkPath(rawInfra, chunks, Length(startOffset), Length(endOffset))
}

fun makeChunkPath(
    rawInfra: RawSignalingInfra,
    trackRanges: List<DirectionalTrackRange>
): ChunkPath {
    val chunks = MutableDirStaticIdxArrayList<TrackChunk>()
    val firstRange = trackRanges[0]
    var startOffset = firstRange.begin.distance
    if (firstRange.direction == EdgeDirection.STOP_TO_START) {
        val firstTrackId = getTrackSectionFromNameOrThrow(firstRange.trackSection, rawInfra)
        startOffset = rawInfra.getTrackSectionLength(firstTrackId) - firstRange.end
    }
    var endOffset = startOffset
    for (trackRange in trackRanges) {
        endOffset += trackRange.end - trackRange.begin
        val trackId = getTrackSectionFromNameOrThrow(trackRange.trackSection, rawInfra)
        val dir =
            if (trackRange.direction == EdgeDirection.START_TO_STOP) Direction.INCREASING
            else Direction.DECREASING
        val chunksOnTrack =
            if (dir == Direction.INCREASING) rawInfra.getTrackSectionChunks(trackId)
            else rawInfra.getTrackSectionChunks(trackId).reversed()
        for (chunk in chunksOnTrack) chunks.add(DirStaticIdx(chunk, dir))
    }
    return buildChunkPath(rawInfra, chunks, Offset(startOffset), Offset(endOffset))
}
