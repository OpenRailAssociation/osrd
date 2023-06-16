package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.START_TO_STOP;
import static fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.STOP_TO_START;
import static fr.sncf.osrd.sim_infra.api.PathKt.buildPathFrom;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;
import static fr.sncf.osrd.utils.indexing.DirStaticIdxKt.toDirection;
import static fr.sncf.osrd.utils.indexing.DirStaticIdxKt.toValue;
import static fr.sncf.osrd.utils.units.Distance.toMeters;

import com.google.common.collect.HashMultimap;
import com.google.common.collect.Iterables;
import fr.sncf.osrd.api.pathfinding.response.CurveChartPointResult;
import fr.sncf.osrd.api.pathfinding.response.PathWaypointResult;
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult;
import fr.sncf.osrd.api.pathfinding.response.SlopeChartPointResult;
import fr.sncf.osrd.railjson.schema.geom.RJSLineString;
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.sim_infra.api.TrackChunk;
import fr.sncf.osrd.utils.Direction;
import fr.sncf.osrd.utils.DistanceRangeMap;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.function.BiFunction;
import java.util.stream.Stream;

public class PathfindingResultConverter {

    /**
     * The pathfinding algorithm produces a path in the block graph.
     * This makes total sense, but also isn't enough: the caller wants to know
     * which waypoints were encountered, as well as the track section path and
     * its geometry.
     */
    public static PathfindingResult convert(
            BlockInfra blockInfra,
            RawSignalingInfra rawInfra,
            Pathfinding.Result<Integer> rawPath,
            DiagnosticRecorderImpl warningRecorder
    ) {
        var path = makePath(rawInfra, blockInfra, rawPath.ranges());
        var result = new PathfindingResult(toMeters(path.getLength()));
        result.routePaths = makeRoutePath(blockInfra, rawInfra, rawPath.ranges());
        result.pathWaypoints = makePathWaypoint(path, rawPath, rawInfra, blockInfra);
        result.geographic = makeGeographic(path);
        result.schematic = makeSchematic(path);
        result.slopes = makeSlopes(path);
        result.curves = makeCurves(path);
        result.warnings = warningRecorder.getWarnings();
        return result;
    }

    /** Creates a `Path` instance from a list of block range */
    static Path makePath(
            RawSignalingInfra infra,
            BlockInfra blockInfra,
            List<Pathfinding.EdgeRange<Integer>> blockRanges
    ) {
        assert (blockRanges.size() > 0);
        long totalBlockPathLength = 0;
        var chunks = new MutableDirStaticIdxArrayList<TrackChunk>();
        for (var range : blockRanges) {
            var zonePaths = blockInfra.getBlockPath(range.edge());
            for (var zonePath : toIntList(zonePaths)) {
                chunks.addAll(infra.getZonePathChunks(zonePath));
                var zoneLength = infra.getZonePathLength(zonePath);
                totalBlockPathLength += zoneLength;
            }
        }
        long startOffset = (long) blockRanges.get(0).start();
        var lastRange = blockRanges.get(blockRanges.size() - 1);
        var lastBlockLength = blockInfra.getBlockLength(lastRange.edge());
        var endOffset = totalBlockPathLength - lastBlockLength + Math.round(lastRange.end());
        return buildPathFrom(infra, chunks, startOffset, endOffset);
    }

    /** Make the list of waypoints on the path, in order. Both user-defined waypoints and operational points. */
    static List<PathWaypointResult> makePathWaypoint(
            Path path,
            Pathfinding.Result<Integer> rawPath,
            RawSignalingInfra infra,
            BlockInfra blockInfra) {
        var waypoints = new ArrayList<PathWaypointResult>();
        waypoints.addAll(makeUserDefinedWaypoints(path, infra, blockInfra, rawPath));
        waypoints.addAll(makeOperationalPoints(infra, path));
        return sortAndMergeDuplicates(waypoints);
    }

    /** Returns all the user defined waypoints on the path */
    private static Collection<PathWaypointResult> makeUserDefinedWaypoints(
            Path path,
            RawSignalingInfra infra,
            BlockInfra blockInfra,
            Pathfinding.Result<Integer> rawPath
    ) {
        // Builds a mapping between blocks and all user defined waypoints on the block
        var userDefinedWaypointsPerBlock = HashMultimap.<Integer, Long>create();
        for (var waypoint : rawPath.waypoints())
            userDefinedWaypointsPerBlock.put(waypoint.edge(), (long) waypoint.offset());

        var res = new ArrayList<PathWaypointResult>();

        long lengthPrevBlocks = 0;
        long startFirstRange = Math.round(rawPath.ranges().get(0).start());
        for (var blockRange : rawPath.ranges()) {
            for (var waypoint : userDefinedWaypointsPerBlock.get(blockRange.edge())) {
                var pathOffset = lengthPrevBlocks + waypoint - startFirstRange;
                res.add(makePendingWaypoint(infra, path, false, pathOffset, null));
            }
            lengthPrevBlocks += blockInfra.getBlockLength(blockRange.edge());
        }
        return res;
    }


    /** Returns all the operational points on the path as waypoints */
    private static Collection<PathWaypointResult> makeOperationalPoints(
            RawSignalingInfra infra,
            Path path
    ) {
        var res = new ArrayList<PathWaypointResult>();
        for (var opWithOffset : path.getOperationalPointParts()) {
            var opId = opWithOffset.getValue();
            var opName = infra.getOperationalPointPartName(opId);
            res.add(makePendingWaypoint(infra, path, true, opWithOffset.getOffset(), opName));
        }
        return res;
    }

    /** Creates a pending waypoint from a path and its offset */
    private static PathWaypointResult makePendingWaypoint(
            RawSignalingInfra infra,
            Path path,
            boolean suggestion,
            long pathOffset,
            String opName
    ) {
        var rawLocation = path.getTrackLocationAtOffset(pathOffset);
        var trackName = infra.getTrackSectionName(rawLocation.getTrackId());
        var location = new PathWaypointResult.PathWaypointLocation(
                trackName,
                toMeters(rawLocation.getOffset())
        );
        return new PathWaypointResult(location, toMeters(pathOffset), suggestion, opName);
    }

    /** Sorts the waypoints on the path. When waypoints overlap, the user-defined one is kept. */
    private static List<PathWaypointResult> sortAndMergeDuplicates(ArrayList<PathWaypointResult> waypoints) {
        waypoints.sort(Comparator.comparingDouble(wp -> wp.pathOffset));
        var res = new ArrayList<PathWaypointResult>();
        PathWaypointResult last = null;
        for (var waypoint : waypoints) {
            if (last != null && last.isDuplicate(waypoint))
                last.merge(waypoint);
            else {
                last = waypoint;
                res.add(last);
            }
        }
        return res;
    }

    /** Returns the geographic linestring of the path */
    private static RJSLineString makeGeographic(Path path) {
        return GeomUtils.toRJSLineString(path.getGeo());
    }

    /** Returns the schematic linestring of the path */
    private static RJSLineString makeSchematic(Path path) {
        return makeGeographic(path);    // TODO: add schematic data to the infra
    }

    /** Returns the slopes on the path */
    private static List<SlopeChartPointResult> makeSlopes(Path path) {
        return generateChartPoints(path.getSlopes(), SlopeChartPointResult::new);
    }

    /** Returns the curves on the path */
    private static List<CurveChartPointResult> makeCurves(Path path) {
        return generateChartPoints(path.getCurves(), CurveChartPointResult::new);
    }

    /**
     * Generates and returns a list of points, generated by `factory` for both the lower and upper endpoint of
     * each range of `ranges`, in ascending order.
     */
    private static <T> List<T> generateChartPoints(
            DistanceRangeMap<Double> ranges,
            BiFunction<Double, Double, T> factory
    ) {
        return ranges.asList().stream().flatMap(entry -> Stream.of(
                factory.apply(toMeters(entry.getLower()), entry.getValue()),
                factory.apply(toMeters(entry.getUpper()), entry.getValue())
        )).toList();
    }

    /** Returns the route path, from the raw block pathfinding result */
    static List<RJSRoutePath> makeRoutePath(
            BlockInfra blockInfra,
            RawSignalingInfra rawInfra,
            List<Pathfinding.EdgeRange<Integer>> ranges
    ) {
        var blocks = ranges.stream()
                .map(Pathfinding.EdgeRange::edge)
                .toList();
        var chunkPath = new ArrayList<Integer>();
        var routes = blocksToRoutes(chunkPath, blockInfra, rawInfra, blocks);
        var startOffset = findStartOffset(blockInfra, rawInfra, chunkPath.get(0), routes.get(0), ranges.get(0));
        var endOffset = findEndOffset(blockInfra, rawInfra, Iterables.getLast(chunkPath),
                Iterables.getLast(routes), Iterables.getLast(ranges));
        return convertRoutesToRJS(rawInfra, routes, startOffset, endOffset);
    }

    /** Converts a list of route with start/end offsets into a list of RJSRoutePath */
    private static List<RJSRoutePath> convertRoutesToRJS(
            RawSignalingInfra infra,
            List<Integer> routes,
            long startOffset,
            long endOffset
    ) {
        if (routes.size() == 0)
            return List.of();
        if (routes.size() == 1)
            return List.of(convertRouteToRJS(infra, routes.get(0), startOffset, endOffset));
        var res = new ArrayList<RJSRoutePath>();
        res.add(convertRouteToRJS(infra, routes.get(0), startOffset, null));
        for (int i = 1; i < routes.size() - 1; i++)
            res.add(convertRouteToRJS(infra, routes.get(i), null, null));
        res.add(convertRouteToRJS(infra, routes.get(routes.size() - 1), null, endOffset));
        return res;
    }

    /** Converts a single route to RJSRoutePath */
    private static RJSRoutePath convertRouteToRJS(
            RawSignalingInfra infra,
            int route,
            Long startOffset,
            Long endOffset
    ) {
        if (startOffset == null)
            startOffset = 0L;
        if (endOffset == null)
            endOffset = getRouteLength(infra, route);
        return new RJSRoutePath(
                infra.getRouteName(route),
                makeRJSTrackRanges(infra, route, startOffset, endOffset),
                "BAL3"
        );
    }

    /** Make the list of RJSDirectionalTrackRange on a route */
    private static List<RJSDirectionalTrackRange> makeRJSTrackRanges(
            RawSignalingInfra infra,
            int route,
            long routeStartOffset,
            long routeEndOffset
    ) {
        var res = new ArrayList<RJSDirectionalTrackRange>();
        long chunkStartPathOffset = 0;
        for (var dirChunkId: toIntList(infra.getChunksOnRoute(route))) {
            var chunkLength = infra.getTrackChunkLength(toValue(dirChunkId));
            var trackId = infra.getTrackFromChunk(toValue(dirChunkId));
            var chunkTrackOffset = infra.getTrackChunkOffset(toValue(dirChunkId));

            var dirTrackChunkOffset = toDirection(dirChunkId).equals(Direction.INCREASING)
                    ? chunkTrackOffset
                    : infra.getTrackSectionLength(trackId) - chunkTrackOffset - chunkLength;
            var dirStartOfRouteRange = routeStartOffset + dirTrackChunkOffset - chunkStartPathOffset;
            var dirEndOfRouteRange = routeEndOffset + dirTrackChunkOffset - chunkStartPathOffset;
            var dirRangeStartOnTrack = Math.max(dirTrackChunkOffset, dirStartOfRouteRange);
            var dirRangeEndOnTrack = Math.min(dirTrackChunkOffset + chunkLength, dirEndOfRouteRange);

            if (dirRangeStartOnTrack < dirRangeEndOnTrack) {
                var trackName = infra.getTrackSectionName(trackId);
                var direction = toDirection(dirChunkId) == Direction.INCREASING ? START_TO_STOP : STOP_TO_START;
                var trackLength = infra.getTrackSectionLength(trackId);
                var rangeStartOnTrack = toMeters(direction == START_TO_STOP
                        ? dirRangeStartOnTrack
                        : trackLength - dirRangeEndOnTrack);
                var rangeEndOnTrack = toMeters(direction == START_TO_STOP
                        ? dirRangeEndOnTrack
                        : trackLength - dirRangeStartOnTrack);
                res.add(new RJSDirectionalTrackRange(trackName, rangeStartOnTrack, rangeEndOnTrack, direction));
            }
            chunkStartPathOffset += chunkLength;
        }

        // Merge the adjacent ranges
        for (int i = 1; i < res.size(); i++) {
            if (res.get(i).trackSectionID.equals(res.get(i - 1).trackSectionID)) {
                assert res.get(i - 1).direction == res.get(i).direction;
                if (res.get(i - 1).direction == START_TO_STOP) {
                    assert Math.abs(res.get(i - 1).end - res.get(i).begin) < 1e-5;
                    res.get(i - 1).end = res.get(i).end;
                } else {
                    assert Math.abs(res.get(i - 1).begin - res.get(i).end) < 1e-5;
                    res.get(i - 1).begin = res.get(i).begin;
                }
                res.remove(i--);
            }
        }
        return res;
    }

    /** Returns the route length */
    private static long getRouteLength(RawSignalingInfra infra, int route) {
        return toIntList(infra.getRoutePath(route)).stream()
                .mapToLong(infra::getZonePathLength)
                .sum();
    }

    /** Returns the offset of the range start on the given route */
    private static long findStartOffset(
            BlockInfra blockInfra,
            RawSignalingInfra rawInfra,
            int firstChunk,
            int routeStaticIdx,
            Pathfinding.EdgeRange<Integer> range
    ) {
        return getRouteChunkOffset(rawInfra, routeStaticIdx, firstChunk) 
                - getBlockChunkOffset(blockInfra, rawInfra, firstChunk, range) + (long) range.start();
    }

    /** Returns the offset of the range end on the given route */
    private static long findEndOffset(
            BlockInfra blockInfra,
            RawSignalingInfra rawInfra,
            int lastChunk,
            int routeStaticIdx,
            Pathfinding.EdgeRange<Integer> range
    ) {
        return getRouteChunkOffset(rawInfra, routeStaticIdx, lastChunk)
                - getBlockChunkOffset(blockInfra, rawInfra, lastChunk, range) + (long) range.end();
    }

    private static long getBlockChunkOffset(BlockInfra blockInfra, RawSignalingInfra rawInfra, int chunk,
                                              Pathfinding.EdgeRange<Integer> range) {
        long offset = 0;
        for (var dirChunkId : toIntList(blockInfra.getTrackChunksFromBlock(range.edge()))) {
            if (dirChunkId == chunk) {
                break;
            }
            offset += rawInfra.getTrackChunkLength(toValue(dirChunkId));
        }
        return offset;
    }

    private static long getRouteChunkOffset(RawSignalingInfra rawInfra, int routeStaticIdx, int chunk) {
        long offset = 0;
        for (var dirChunkId : toIntList(rawInfra.getChunksOnRoute(routeStaticIdx))) {
            if (dirChunkId == chunk)
                break;
            offset += rawInfra.getTrackChunkLength(toValue(dirChunkId));
        }
        return offset;
    }

    /** Converts a list of blocks into a list of routes, ignoring ranges */
    private static List<Integer> blocksToRoutes(
            ArrayList<Integer> pathChunks,
            BlockInfra blockInfra,
            RawSignalingInfra infra,
            List<Integer> blocks
    ) {
        for (var blockId : blocks)
            for (var zonePathId : toIntList(blockInfra.getBlockPath(blockId)))
                pathChunks.addAll(toIntList(infra.getZonePathChunks(zonePathId)));
        var chunkStartIndex = 0;
        var res = new ArrayList<Integer>();
        while (true) {
            var route = findRoute(infra, pathChunks, chunkStartIndex, chunkStartIndex != 0);
            res.add(route);
            var chunkSetOnRoute = new HashSet<>(toIntList(infra.getChunksOnRoute(route)));
            while (chunkStartIndex < pathChunks.size() && chunkSetOnRoute.contains(pathChunks.get(chunkStartIndex)))
                chunkStartIndex++; // Increase the index in the chunk path, for as long as it is covered by the route
            if (chunkStartIndex >= pathChunks.size())
                return res;
        }
    }

    /** Finds a valid route that follows the given path */
    private static int findRoute(
            RawSignalingInfra infra,
            List<Integer> chunks,
            int startIndex,
            boolean routeMustIncludeStart
    ) {
        for (var routeId : toIntList(infra.getRoutesOnTrackChunk(chunks.get(startIndex))))
            if (routeMatchPath(infra, chunks, startIndex, routeMustIncludeStart, routeId))
                return routeId;
        throw new RuntimeException("Couldn't find a route matching the given chunk list");
    }

    /** Returns false if the route differs from the path */
    private static boolean routeMatchPath(
            RawSignalingInfra infra,
            List<Integer> chunks,
            int chunkIndex,
            boolean routeMustIncludeStart,
            int routeId
    ) {
        var firstChunk = chunks.get(chunkIndex);
        var routeChunks = infra.getChunksOnRoute(routeId);
        var routeChunkIndex = 0;
        if (routeMustIncludeStart) {
            if (routeChunks.get(0) != firstChunk)
                return false;
        } else {
            while (routeChunks.get(routeChunkIndex) != firstChunk)
                routeChunkIndex++;
        }
        while (true) {
            if (routeChunkIndex == routeChunks.getSize())
                return true; // end of route
            if (chunkIndex == chunks.size())
                return true; // end of path
            if (routeChunks.get(routeChunkIndex) != chunks.get(chunkIndex))
                return false; // route and path differ
            routeChunkIndex++;
            chunkIndex++;
        }
    }
}
