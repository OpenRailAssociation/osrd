package fr.sncf.osrd.api.pathfinding

import com.google.common.collect.Iterables
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.path.implementations.PartialBlockRange
import fr.sncf.osrd.path.implementations.buildRangeList
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlockRanges
import fr.sncf.osrd.path.interfaces.BlockPath
import fr.sncf.osrd.path.interfaces.BlockRange
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.path.interfaces.toJsonTrainPath
import fr.sncf.osrd.pathfinding.Pathfinding
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeLocation
import fr.sncf.osrd.pathfinding.Pathfinding.EdgeRange
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.chunksOnBlocks
import fr.sncf.osrd.sim_infra.utils.chunksToRoutes
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.getBlockChunkOffset
import fr.sncf.osrd.utils.getRouteChunkOffset
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Offset.Companion.max
import fr.sncf.osrd.utils.units.Offset.Companion.min
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.sumDistances
import kotlin.math.abs

fun runPathfindingPostProcessing(
    infra: FullInfra,
    initialRequest: PathfindingBlockRequest,
    rawPath: Pathfinding.Result<BlockId, Block>,
): PathfindingBlockSuccess {
    val res = runPathfindingBlockPostProcessing(infra, rawPath)
    validatePathfindingResponse(infra, initialRequest, res)
    return res
}

fun runPathfindingBlockPostProcessing(
    infra: FullInfra,
    rawPath: Pathfinding.Result<BlockId, Block>,
): PathfindingBlockSuccess {
    // TODO: access a `TrainPath` directly from the pathfinding result.
    // We'd get more accurate routes in the (unlikely) case of ambiguity,
    // and we'd save a lot of code complexity here.

    // We reuse some of the old function of pathfindingResultConverter,
    // there will be some cleanup to be made when the old version is removed
    val oldRoutePath = makeRoutePath(infra.blockInfra, infra.rawInfra, rawPath.ranges)
    val routeList = oldRoutePath.map { it.route }
    val blockMap = makeBlocks(rawPath.ranges)

    val trainPath =
        buildTrainPathFromBlockRanges(
            infra.rawInfra,
            infra.blockInfra,
            blockMap,
            routeNames = routeList,
        )

    return PathfindingBlockSuccess(
        trainPath.toJsonTrainPath(infra.rawInfra, infra.blockInfra),
        Length(rawPath.ranges.map { it.end - it.start }.sumDistances()),
        makePathItemPositions(rawPath),
    )
}

private fun validatePathfindingResponse(
    infra: FullInfra,
    req: PathfindingBlockRequest,
    res: PathfindingBlockResponse,
) {
    // TODO path migrations: some of those checks won't be true anymore with backtracks
    if (res !is PathfindingBlockSuccess) return

    val trainPath = res.path.toTrainPath(infra.rawInfra, infra.blockInfra, null)
    val blocks = trainPath.getBlocks()
    for ((i, blockRange) in blocks.withIndex()) {
        val block = blockRange.value
        val stopAtBufferStop = infra.blockInfra.blockStopAtBufferStop(block)
        val isLastBlock = i == blocks.size - 1
        if (stopAtBufferStop && !isLastBlock) {
            val zonePath = infra.blockInfra.getBlockZonePaths(block).last()
            val detector = infra.rawInfra.getZonePathExit(zonePath)
            val detectorName = infra.rawInfra.getDetectorName(detector.value)
            val err = OSRDError(ErrorType.MissingSignalOnRouteTransition)
            err.context["detector"] = "detector=$detectorName, dir=${detector.direction}"
            throw err
        }
    }

    if (res.pathItemPositions.size != req.pathItems.size)
        throw OSRDError(ErrorType.PathHasInvalidItemPositions)

    if (res.pathItemPositions[0].distance.millimeters != 0L)
        throw OSRDError(ErrorType.PathHasInvalidItemPositions)

    if (res.pathItemPositions[res.pathItemPositions.size - 1] != res.length)
        throw OSRDError(ErrorType.PathHasInvalidItemPositions)
}

fun makePathItemPositions(path: Pathfinding.Result<BlockId, Block>): List<Offset<TravelledPath>> {
    val pathItemLocations = mutableMapOf<BlockId, MutableList<EdgeLocation<BlockId, Block>>>()
    for (waypoint in path.waypoints) {
        val edgeWaypoints = pathItemLocations.computeIfAbsent(waypoint.edge) { mutableListOf() }
        edgeWaypoints.add(waypoint)
    }
    var offsetSinceStart = Offset<TravelledPath>(0.meters)
    val res = mutableListOf<Offset<TravelledPath>>()
    for (range in path.ranges) {
        for (waypoint in pathItemLocations[range.edge] ?: listOf()) {
            res.add(offsetSinceStart + waypoint.offset.distance - range.start.distance)
        }
        offsetSinceStart += range.end - range.start
    }
    return res
}

private fun makeBlocks(ranges: List<EdgeRange<BlockId, Block>>): List<BlockRange> {
    val blockRanges = mutableListOf<PartialBlockRange>()
    for ((blockId, start, end) in ranges) {
        val lastAddedRange = blockRanges.lastOrNull()
        if (lastAddedRange == null || lastAddedRange.value != blockId) {
            blockRanges.add(PartialBlockRange(blockId, start, end))
        } else {
            require(lastAddedRange.objectEnd == start)
            blockRanges[blockRanges.lastIndex] = lastAddedRange.copy(objectEnd = end)
        }
    }
    return buildRangeList(blockRanges)
}

/** Returns the route path, from the raw block pathfinding result */
private fun makeRoutePath(
    blockInfra: BlockInfra,
    rawInfra: RawSignalingInfra,
    ranges: List<EdgeRange<BlockId, Block>>,
): List<RJSRoutePath> {
    val blocks = ranges.stream().map { x -> x.edge }.toList()
    val chunkPath = blockInfra.chunksOnBlocks(blocks)
    val routes = blockInfra.chunksToRoutes(rawInfra, chunkPath)
    val startOffset = findStartOffset(blockInfra, rawInfra, chunkPath[0], routes[0], ranges[0])
    val endOffset =
        findEndOffset(
            blockInfra,
            rawInfra,
            Iterables.getLast(chunkPath),
            Iterables.getLast(routes),
            Iterables.getLast(ranges),
        )
    return convertRoutesToRJS(rawInfra, routes, startOffset, endOffset)
}

/** Converts a list of route with start/end offsets into a list of RJSRoutePath */
private fun convertRoutesToRJS(
    infra: RawSignalingInfra,
    routes: List<RouteId>,
    startOffset: Offset<Route>,
    endOffset: Offset<Route>,
): List<RJSRoutePath> {
    if (routes.size == 0) return listOf()
    if (routes.size == 1) return listOf(convertRouteToRJS(infra, routes[0], startOffset, endOffset))
    val res = ArrayList<RJSRoutePath>()
    res.add(convertRouteToRJS(infra, routes[0], startOffset, null))
    for (i in 1 until routes.size - 1) res.add(convertRouteToRJS(infra, routes[i], null, null))
    res.add(convertRouteToRJS(infra, routes[routes.size - 1], null, endOffset))
    return res
}

/** Converts a single route to RJSRoutePath */
private fun convertRouteToRJS(
    rawInfra: RawSignalingInfra,
    route: RouteId,
    startOffset: Offset<Route>?,
    endOffset: Offset<Route>?,
): RJSRoutePath {
    var mutStartOffset = startOffset
    var mutEndOffset = endOffset
    if (mutStartOffset == null) mutStartOffset = Offset(0.meters)
    if (mutEndOffset == null) mutEndOffset = rawInfra.getRouteLength(route)
    return RJSRoutePath(
        rawInfra.getRouteName(route),
        makeRJSTrackRanges(rawInfra, route, mutStartOffset, mutEndOffset),
    )
}

/** Make the list of RJSDirectionalTrackRange on a route */
private fun makeRJSTrackRanges(
    infra: RawSignalingInfra,
    route: RouteId,
    routeStartOffset: Offset<Route>,
    routeEndOffset: Offset<Route>,
): List<RJSDirectionalTrackRange> {
    val res = ArrayList<RJSDirectionalTrackRange>()
    var chunkStartPathOffset: Offset<BlockPath> = Offset(0.meters)
    for (dirChunkId in infra.getChunksOnRoute(route)) {
        val chunkLength = infra.getTrackChunkLength(dirChunkId.value)
        val trackId = infra.getTrackFromChunk(dirChunkId.value)
        val chunkTrackOffset = infra.getTrackChunkOffset(dirChunkId.value)
        val dirTrackChunkOffset: Offset<TrackSection> =
            if (dirChunkId.direction == Direction.INCREASING) chunkTrackOffset
            else
                Offset(
                    infra.getTrackSectionLength(trackId) - chunkTrackOffset - chunkLength.distance
                )
        val dirStartOfRouteRange =
            dirTrackChunkOffset + routeStartOffset.distance - chunkStartPathOffset.distance
        val dirEndOfRouteRange =
            dirTrackChunkOffset + routeEndOffset.distance - chunkStartPathOffset.distance
        val dirRangeStartOnTrack = max(dirTrackChunkOffset, dirStartOfRouteRange)
        val dirRangeEndOnTrack = min(dirTrackChunkOffset + chunkLength.distance, dirEndOfRouteRange)
        if (dirRangeStartOnTrack <= dirRangeEndOnTrack) {
            val trackName = infra.getTrackSectionName(trackId)
            val direction =
                if (dirChunkId.direction === Direction.INCREASING) EdgeDirection.START_TO_STOP
                else EdgeDirection.STOP_TO_START
            val trackLength = infra.getTrackSectionLength(trackId)
            val rangeStartOnTrack =
                if (direction == EdgeDirection.START_TO_STOP) dirRangeStartOnTrack
                else Offset(trackLength.distance - dirRangeEndOnTrack.distance)
            val rangeEndOnTrack =
                if (direction == EdgeDirection.START_TO_STOP) dirRangeEndOnTrack
                else Offset(trackLength.distance - dirRangeStartOnTrack.distance)
            res.add(
                RJSDirectionalTrackRange(
                    trackName,
                    rangeStartOnTrack.meters,
                    rangeEndOnTrack.meters,
                    direction,
                )
            )
        }
        chunkStartPathOffset += chunkLength.distance
    }

    // Merge the adjacent ranges
    var i = 1
    while (i < res.size) {
        if (res[i].trackSectionID == res[i - 1].trackSectionID) {
            assert(res[i - 1].direction == res[i].direction)
            if (res[i - 1].direction == EdgeDirection.START_TO_STOP) {
                assert(abs(res[i - 1].end - res[i].begin) < 1e-5)
                res[i - 1].end = res[i].end
            } else {
                assert(abs(res[i - 1].begin - res[i].end) < 1e-5)
                res[i - 1].begin = res[i].begin
            }
            res.removeAt(i--)
        }
        i++
    }
    return res
}

/** Returns the offset of the range start on the given route */
private fun findStartOffset(
    blockInfra: BlockInfra,
    rawInfra: RawSignalingInfra,
    firstChunk: DirTrackChunkId,
    routeStaticIdx: RouteId,
    range: EdgeRange<BlockId, Block>,
): Offset<Route> {
    return getRouteChunkOffset(rawInfra, routeStaticIdx, firstChunk) -
        getBlockChunkOffset(blockInfra, rawInfra, firstChunk, range).distance + range.start.distance
}

/** Returns the offset of the range end on the given route */
private fun findEndOffset(
    blockInfra: BlockInfra,
    rawInfra: RawSignalingInfra,
    lastChunk: DirTrackChunkId,
    routeStaticIdx: RouteId,
    range: EdgeRange<BlockId, Block>,
): Offset<Route> {
    return getRouteChunkOffset(rawInfra, routeStaticIdx, lastChunk) -
        getBlockChunkOffset(blockInfra, rawInfra, lastChunk, range).distance + range.end.distance
}
