package fr.sncf.osrd.utils

import fr.sncf.osrd.api.DirectionalTrackRange
import fr.sncf.osrd.path.implementations.ChunkPath
import fr.sncf.osrd.path.implementations.buildChunkPath
import fr.sncf.osrd.path.implementations.buildRangeMap
import fr.sncf.osrd.path.implementations.buildTrainPathFromChunks
import fr.sncf.osrd.path.interfaces.DirChunkRange
import fr.sncf.osrd.path.interfaces.PathProperties
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Distance.Companion.max
import fr.sncf.osrd.utils.units.Distance.Companion.min
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/** Builds a PathProperties from a List<TrackRange> */
fun makePathProps(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    trackRanges: List<DirectionalTrackRange>,
    routes: List<RouteId>? = null,
): PathProperties {
    val chunkPath = makeChunkPath(rawInfra, trackRanges)

    val chunkRanges = mutableListOf<DirChunkRange>()
    var prevChunksLength = 0.meters
    for (chunk in chunkPath.chunks) {
        val chunkLength = rawInfra.getTrackChunkLength(chunk.value)
        val start = max(chunkPath.beginOffset.distance - prevChunksLength, 0.meters)
        val end = min(chunkPath.endOffset.distance - prevChunksLength, chunkLength.distance)
        val range = DirChunkRange(chunk, Offset(start), Offset(end))
        chunkRanges.add(range)
        prevChunksLength += chunkLength.distance
    }
    return buildTrainPathFromChunks(
        rawInfra,
        blockInfra,
        buildRangeMap(chunkRanges),
        routes = routes,
    )
}

fun makeChunkPath(
    rawInfra: RawSignalingInfra,
    trackRanges: List<DirectionalTrackRange>,
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

/** Convert a list of route names into a route id list. */
fun convertRoutePath(infra: RawInfra, routes: List<String>): StaticIdxList<Route> {
    val res = mutableStaticIdxArrayListOf<Route>()
    for (route in routes) res.add(infra.getRouteFromName(route))
    return res
}

/** Convert a list of block names into a block id list. */
@Throws(OSRDError::class)
fun convertBlockPath(blockInfra: BlockInfra, blocks: List<String>): StaticIdxList<Block> {
    val res = mutableStaticIdxArrayListOf<Block>()
    for (blockName in blocks) res.add(
        blockInfra.getBlockFromName(blockName) ?: throw OSRDError(ErrorType.UnknownBlock)
    )
    return res
}
