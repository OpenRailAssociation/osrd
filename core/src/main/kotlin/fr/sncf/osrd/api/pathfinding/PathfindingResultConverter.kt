package fr.sncf.osrd.api.pathfinding

import com.google.common.collect.Iterables
import fr.sncf.osrd.api.pathfinding.response.PathWaypointResult
import fr.sncf.osrd.api.pathfinding.response.PathWaypointResult.PathWaypointLocation
import fr.sncf.osrd.graph.PathfindingEdgeRangeId
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.chunksOnBlocks
import fr.sncf.osrd.sim_infra.utils.chunksToRoutes
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.StaticIdxList
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.math.abs

// TODO: change name and localisation, this is an utils class now
/** Returns all the operational points on the path as waypoints */
fun makeOperationalPoints(
    infra: RawSignalingInfra,
    path: PathProperties
): Collection<PathWaypointResult> {
    val res = ArrayList<PathWaypointResult>()
    for ((opId, offset) in path.getOperationalPointParts()) {
        res.add(makePendingOPWaypoint(infra, offset, opId))
    }
    return res
}

/** Creates a pending waypoint from an operational point part */
private fun makePendingOPWaypoint(
    infra: RawSignalingInfra,
    pathOffset: Offset<TravelledPath>,
    opPartId: OperationalPointPartId
): PathWaypointResult {
    val partChunk = infra.getOperationalPointPartChunk(opPartId)
    val partChunkOffset = infra.getOperationalPointPartChunkOffset(opPartId)
    val opId = infra.getOperationalPointPartOpId(opPartId)
    val trackId = infra.getTrackFromChunk(partChunk)
    val trackOffset = partChunkOffset + infra.getTrackChunkOffset(partChunk).distance
    val trackName = infra.getTrackSectionName(trackId)
    val location = PathWaypointLocation(trackName, trackOffset.distance.meters)
    return PathWaypointResult(location, pathOffset.distance.meters, true, opId)
}

/** Returns the route path, from the raw block pathfinding result */
fun makeRoutePath(
    blockInfra: BlockInfra,
    rawInfra: RawSignalingInfra,
    ranges: List<PathfindingEdgeRangeId<Block>>
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
            Iterables.getLast(ranges)
        )
    return convertRoutesToRJS(rawInfra, routes, startOffset, endOffset)
}

/** Converts a list of route with start/end offsets into a list of RJSRoutePath */
private fun convertRoutesToRJS(
    infra: RawSignalingInfra,
    routes: StaticIdxList<Route>,
    startOffset: Offset<Route>,
    endOffset: Offset<Route>
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
    endOffset: Offset<Route>?
): RJSRoutePath {
    var mutStartOffset = startOffset
    var mutEndOffset = endOffset
    if (mutStartOffset == null) mutStartOffset = Offset(0.meters)
    if (mutEndOffset == null) mutEndOffset = rawInfra.getRouteLength(route)
    return RJSRoutePath(
        rawInfra.getRouteName(route),
        makeRJSTrackRanges(rawInfra, route, mutStartOffset, mutEndOffset),
        "BAL3"
    )
}

/** Make the list of RJSDirectionalTrackRange on a route */
private fun makeRJSTrackRanges(
    infra: RawSignalingInfra,
    route: RouteId,
    routeStartOffset: Offset<Route>,
    routeEndOffset: Offset<Route>
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
        val dirRangeStartOnTrack = Offset.max(dirTrackChunkOffset, dirStartOfRouteRange)
        val dirRangeEndOnTrack =
            Offset.min(dirTrackChunkOffset + chunkLength.distance, dirEndOfRouteRange)
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
                    rangeStartOnTrack.distance.meters,
                    rangeEndOnTrack.distance.meters,
                    direction
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
    range: PathfindingEdgeRangeId<Block>
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
    range: PathfindingEdgeRangeId<Block>
): Offset<Route> {
    return getRouteChunkOffset(rawInfra, routeStaticIdx, lastChunk) -
        getBlockChunkOffset(blockInfra, rawInfra, lastChunk, range).distance + range.end.distance
}

private fun getBlockChunkOffset(
    blockInfra: BlockInfra,
    rawInfra: RawSignalingInfra,
    chunk: DirTrackChunkId,
    range: PathfindingEdgeRangeId<Block>
): Offset<Block> {
    var offset = Offset<Block>(0.meters)
    for (dirChunkId in blockInfra.getTrackChunksFromBlock(range.edge)) {
        if (dirChunkId == chunk) break
        offset += rawInfra.getTrackChunkLength(dirChunkId.value).distance
    }
    return offset
}

private fun getRouteChunkOffset(
    rawInfra: RawSignalingInfra,
    routeStaticIdx: RouteId,
    chunk: DirTrackChunkId
): Offset<Route> {
    var offset = Offset<Route>(0.meters)
    for (dirChunkId in rawInfra.getChunksOnRoute(routeStaticIdx)) {
        if (dirChunkId == chunk) break
        offset += rawInfra.getTrackChunkLength(dirChunkId.value).distance
    }
    return offset
}
