package fr.sncf.osrd.api.pathfinding

import com.google.common.collect.Iterables
import fr.sncf.osrd.api.pathfinding.response.CurveChartPointResult
import fr.sncf.osrd.api.pathfinding.response.PathWaypointResult
import fr.sncf.osrd.api.pathfinding.response.PathWaypointResult.PathWaypointLocation
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult
import fr.sncf.osrd.api.pathfinding.response.SlopeChartPointResult
import fr.sncf.osrd.graph.PathfindingEdgeRangeId
import fr.sncf.osrd.graph.PathfindingResultId
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.utils.chunksOnBlocks
import fr.sncf.osrd.sim_infra.utils.chunksToRoutes
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.*
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.function.BiFunction
import java.util.stream.Stream
import kotlin.math.abs

/**
 * The pathfinding algorithm produces a path in the block graph. This makes total sense, but also
 * isn't enough: the caller wants to know which waypoints were encountered, as well as the track
 * section path and its geometry.
 */
fun convertPathfindingResult(
    blockInfra: BlockInfra,
    rawInfra: RawSignalingInfra,
    rawPath: PathfindingResultId<Block>,
    warningRecorder: DiagnosticRecorderImpl
): PathfindingResult {
    val path = makePathProps(rawInfra, blockInfra, rawPath.ranges)
    val result = PathfindingResult(path.getLength().distance.meters)
    result.routePaths = makeRoutePath(blockInfra, rawInfra, rawPath.ranges)
    result.pathWaypoints = makePathWaypoint(path, rawPath, rawInfra, blockInfra)
    result.geographic = makeGeographic(path)
    result.slopes = makeSlopes(path)
    result.curves = makeCurves(path)
    result.warnings = warningRecorder.getWarnings()
    return result
}

/**
 * Make the list of waypoints on the path, in order. Both user-defined waypoints and operational
 * points.
 */
fun makePathWaypoint(
    path: PathProperties,
    rawPath: PathfindingResultId<Block>,
    infra: RawSignalingInfra,
    blockInfra: BlockInfra
): List<PathWaypointResult> {
    val waypoints = ArrayList<PathWaypointResult>()
    waypoints.addAll(makeUserDefinedWaypoints(path, infra, blockInfra, rawPath))
    waypoints.addAll(makeOperationalPoints(infra, path))
    return sortAndMergeDuplicates(waypoints)
}

/** Returns all the user defined waypoints on the path */
private fun makeUserDefinedWaypoints(
    path: PathProperties,
    infra: RawSignalingInfra,
    blockInfra: BlockInfra,
    rawPath: PathfindingResultId<Block>
): Collection<PathWaypointResult> {
    // Builds a mapping between blocks and all user defined waypoints on the block
    val userDefinedWaypointsPerBlock = HashMap<BlockId, MutableList<Offset<Block>>>()
    for (waypoint in rawPath.waypoints) {
        val offsets =
            userDefinedWaypointsPerBlock.computeIfAbsent(waypoint.edge) { _ -> ArrayList() }
        offsets.add(waypoint.offset)
    }
    val res = ArrayList<PathWaypointResult>()
    var lengthPrevBlocks: Offset<Path> = Offset(0.meters)
    val startFirstRange = rawPath.ranges[0].start
    for (blockRange in rawPath.ranges) {
        for (waypoint in userDefinedWaypointsPerBlock.getOrDefault(blockRange.edge, ArrayList())) {
            if (blockRange.start <= waypoint && waypoint <= blockRange.end) {
                val pathOffset = lengthPrevBlocks + waypoint.distance - startFirstRange.distance
                res.add(makePendingUserDefinedWaypoint(infra, path, pathOffset))
            }
        }
        lengthPrevBlocks += blockInfra.getBlockLength(blockRange.edge).distance
    }
    return res
}

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
    pathOffset: Offset<Path>,
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

/** Creates a pending waypoint from a path and its offset */
private fun makePendingUserDefinedWaypoint(
    infra: RawSignalingInfra,
    path: PathProperties,
    pathOffset: Offset<Path>
): PathWaypointResult {
    val (trackId, offset) = path.getTrackLocationAtOffset(pathOffset)
    val trackName = infra.getTrackSectionName(trackId)
    val location = PathWaypointLocation(trackName, offset.distance.meters)
    return PathWaypointResult(location, pathOffset.distance.meters, false, null)
}

/** Sorts the waypoints on the path. When waypoints overlap, the user-defined one is kept. */
private fun sortAndMergeDuplicates(
    waypoints: ArrayList<PathWaypointResult>
): List<PathWaypointResult> {
    waypoints.sortWith(Comparator.comparingDouble { wp: PathWaypointResult -> wp.pathOffset })
    val res = ArrayList<PathWaypointResult>()
    var last: PathWaypointResult? = null
    for (waypoint in waypoints) {
        if (last != null && last.isDuplicate(waypoint)) last.merge(waypoint)
        else {
            last = waypoint
            res.add(last)
        }
    }
    return res
}

/** Returns the geographic linestring of the path */
private fun makeGeographic(path: PathProperties): RJSLineString {
    return toRJSLineString(path.getGeo())
}

/** Returns the slopes on the path */
private fun makeSlopes(path: PathProperties): List<SlopeChartPointResult> {
    return generateChartPoints(path.getSlopes()) { position: Double?, gradient: Double? ->
        SlopeChartPointResult(position!!, gradient!!)
    }
}

/** Returns the curves on the path */
private fun makeCurves(path: PathProperties): List<CurveChartPointResult> {
    return generateChartPoints(path.getCurves()) { position: Double?, radius: Double? ->
        CurveChartPointResult(position!!, radius!!)
    }
}

/**
 * Generates and returns a list of points, generated by `factory` for both the lower and upper
 * endpoint of each range of `ranges`, in ascending order.
 */
private fun <T> generateChartPoints(
    ranges: DistanceRangeMap<Double>,
    factory: BiFunction<Double, Double, T>
): List<T> {
    return ranges
        .asList()
        .stream()
        .flatMap { (lower, upper, value): DistanceRangeMap.RangeMapEntry<Double> ->
            Stream.of(factory.apply(lower.meters, value), factory.apply(upper.meters, value))
        }
        .toList()
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
    var chunkStartPathOffset: Offset<Path> = Offset(0.meters)
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
