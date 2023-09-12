package fr.sncf.osrd.api.pathfinding;

import static fr.sncf.osrd.api.pathfinding.RemainingDistanceEstimator.minDistanceBetweenSteps;
import static fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.START_TO_STOP;
import static fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection.STOP_TO_START;
import static fr.sncf.osrd.sim_infra.api.TrackInfraKt.getTrackSectionFromNameOrThrow;
import static fr.sncf.osrd.sim_infra.utils.InfraUtilsKt.getNextTrackSections;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntSet;
import static fr.sncf.osrd.utils.indexing.DirStaticIdxKt.toDirection;
import static fr.sncf.osrd.utils.indexing.DirStaticIdxKt.toValue;
import static fr.sncf.osrd.utils.units.Distance.fromMeters;
import static fr.sncf.osrd.utils.units.Distance.toMeters;

import fr.sncf.osrd.api.ExceptionHandler;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.api.InfraManager;
import fr.sncf.osrd.api.pathfinding.constraints.ElectrificationConstraints;
import fr.sncf.osrd.api.pathfinding.constraints.LoadingGaugeConstraints;
import fr.sncf.osrd.api.pathfinding.request.PathfindingRequest;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSDirectionalTrackRange;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.GraphAdapter;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.functional_interfaces.AStarHeuristic;
import fr.sncf.osrd.utils.graph.functional_interfaces.EdgeToRanges;
import fr.sncf.osrd.utils.indexing.DirStaticIdxKt;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public class PathfindingBlocksEndpoint implements Take {
    private final InfraManager infraManager;
    private static final HashMap<Class<?>, ErrorType> constraintErrors = new HashMap<>();

    static {
        constraintErrors.put(LoadingGaugeConstraints.class, ErrorType.PathfindingGaugeError);
        constraintErrors.put(ElectrificationConstraints.class, ErrorType.PathfindingElectrificationError);
    }

    /**
     * constructor
     */
    public PathfindingBlocksEndpoint(InfraManager infraManager) {
        this.infraManager = infraManager;
    }

    @Override
    public Response act(Request req) {
        var recorder = new DiagnosticRecorderImpl(false);
        try {
            var body = new RqPrint(req).printBody();
            var request = PathfindingRequest.adapter.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            var reqWaypoints = request.waypoints;

            // Load infra
            var infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder);

            // Load rolling stocks
            var rollingStocks = List.<RollingStock>of();
            if (request.rollingStocks != null)
                rollingStocks = request.rollingStocks.stream()
                        .map(RJSRollingStockParser::parse)
                        .toList();

            var path = runPathfinding(infra, reqWaypoints, rollingStocks);

            PathfindingResult res = PathfindingResultConverter.convert(infra.blockInfra(), infra.rawInfra(),
                    path, recorder);

            validatePathfindingResult(res, reqWaypoints, infra.rawInfra());

            return new RsJson(new RsWithBody(PathfindingResult.adapterResult.toJson(res)));
        } catch (Throwable ex) {
            // TODO: include warnings in the response
            return ExceptionHandler.handle(ex);
        }
    }

    /**
     * Runs the pathfinding with the infra and rolling stocks already parsed
     */
    public static Pathfinding.Result<Integer> runPathfinding(
            FullInfra infra,
            PathfindingWaypoint[][] reqWaypoints,
            Collection<RollingStock> rollingStocks
    ) throws OSRDError {
        // Parse the waypoints
        var waypoints = new ArrayList<Collection<Pathfinding.EdgeLocation<Integer>>>();
        for (var step : reqWaypoints) {
            var allStarts = new HashSet<Pathfinding.EdgeLocation<Integer>>();
            for (var waypoint : step)
                allStarts.addAll(findWaypointBlocks(infra, waypoint));
            waypoints.add(allStarts);
        }

        // Initializes the constraints
        var loadingGaugeConstraints = new LoadingGaugeConstraints(infra.blockInfra(), infra.rawInfra(), rollingStocks);
        var electrificationConstraints = new ElectrificationConstraints(infra.blockInfra(), infra.rawInfra(),
                rollingStocks);
        final List<EdgeToRanges<Integer>> constraints = List.of(loadingGaugeConstraints, electrificationConstraints);
        var remainingDistanceEstimators = makeHeuristics(infra, waypoints);

        // Compute the paths from the entry waypoint to the exit waypoint
        return computePaths(infra, waypoints, constraints, remainingDistanceEstimators);
    }

    /** Initialize the heuristics */
    public static ArrayList<AStarHeuristic<Integer>> makeHeuristics(
            FullInfra infra,
            List<Collection<Pathfinding.EdgeLocation<Integer>>> waypoints
    ) {
        // Compute the minimum distance between steps
        double[] stepMinDistance = new double[waypoints.size() - 1];
        for (int i = 0; i < waypoints.size() - 2; i++) {
            stepMinDistance[i] = minDistanceBetweenSteps(infra.blockInfra(), infra.rawInfra(), waypoints.get(i + 1),
                    waypoints.get(i + 2));
        }

        // Reversed cumulative sum
        for (int i = stepMinDistance.length - 2; i >= 0; i--) {
            stepMinDistance[i] += stepMinDistance[i + 1];
        }

        // Setup estimators foreach intermediate steps
        var remainingDistanceEstimators = new ArrayList<AStarHeuristic<Integer>>();
        for (int i = 0; i < waypoints.size() - 1; i++) {
            remainingDistanceEstimators.add(new RemainingDistanceEstimator(
                    infra.blockInfra(),
                    infra.rawInfra().getSimInfra(),
                    waypoints.get(i + 1),
                    stepMinDistance[i]
            ));
        }
        return remainingDistanceEstimators;
    }

    private static Pathfinding.Result<Integer> computePaths(
            FullInfra infra,
            ArrayList<Collection<Pathfinding.EdgeLocation<Integer>>> waypoints,
            List<EdgeToRanges<Integer>> constraints,
            List<AStarHeuristic<Integer>> remainingDistanceEstimators
    ) throws OSRDError {
        var pathFound = new Pathfinding<>(new GraphAdapter(infra.blockInfra(), infra.rawInfra()))
                .setEdgeToLength(block -> infra.blockInfra().getBlockLength(block))
                .setRemainingDistanceEstimator(remainingDistanceEstimators)
                .addBlockedRangeOnEdges(constraints)
                .runPathfinding(waypoints);

        if (pathFound != null) {
            return pathFound;
        }

        // Handling errors
        // Check if pathfinding failed due to constraints
        var possiblePathWithoutErrorNoConstraints =
                new Pathfinding<>(new GraphAdapter(infra.blockInfra(), infra.rawInfra()))
                        .setEdgeToLength(block -> infra.blockInfra().getBlockLength(block))
                        .setRemainingDistanceEstimator(remainingDistanceEstimators)
                        .runPathfinding(waypoints);
        if (possiblePathWithoutErrorNoConstraints != null) {
            for (EdgeToRanges<Integer> currentConstraint : constraints) {
                var possiblePathWithoutError = new Pathfinding<>(new GraphAdapter(infra.blockInfra(), infra.rawInfra()))
                        .setEdgeToLength(block -> infra.blockInfra().getBlockLength(block))
                        .addBlockedRangeOnEdges(currentConstraint)
                        .setRemainingDistanceEstimator(remainingDistanceEstimators)
                        .runPathfinding(waypoints);
                if (possiblePathWithoutError == null) {
                    throw new OSRDError(constraintErrors.get(currentConstraint.getClass()));
                }
            }
        }
        // It didn’t fail due to a constraint, no path exists
        throw new OSRDError(ErrorType.PathfindingGenericError);
    }

    /**
     * Returns all the EdgeLocations of a waypoint list.
     * @param infra full infra.
     * @param waypoints corresponding waypoints.
     * @return corresponding edge locations.
     */
    public static Set<Pathfinding.EdgeLocation<Integer>> findWaypointBlocks(FullInfra infra,
                                                                            Collection<PathfindingWaypoint> waypoints) {
        return waypoints.stream()
                .flatMap(waypoint -> findWaypointBlocks(infra, waypoint).stream())
                .collect(Collectors.toSet());
    }

    /**
     * Returns all the EdgeLocations of a waypoint.
     * @param infra full infra.
     * @param waypoint corresponding waypoint.
     * @return corresponding edge location, containing a block id and its offset from the waypoint.
     */
    public static Set<Pathfinding.EdgeLocation<Integer>> findWaypointBlocks(
            FullInfra infra,
            PathfindingWaypoint waypoint
    ) {
        var res = new HashSet<Pathfinding.EdgeLocation<Integer>>();
        var trackSectionId = getTrackSectionFromNameOrThrow(waypoint.trackSection, infra.rawInfra());
        var trackChunkOnWaypoint = getTrackSectionChunkOnWaypoint(trackSectionId, waypoint.offset, infra.rawInfra());
        var waypointDirection = Direction.fromEdgeDir(waypoint.direction).toKtDirection();
        var blocksOnWaypoint =
                toIntSet(infra.blockInfra().getBlocksFromTrackChunk(trackChunkOnWaypoint, waypointDirection));
        blocksOnWaypoint.forEach(block -> {
            var offset = getBlockOffset(block, trackChunkOnWaypoint, trackSectionId, waypoint.offset,
                    waypoint.direction, infra);
            res.add(new Pathfinding.EdgeLocation<>(block, offset));
        });
        return res;
    }

    private static Integer getTrackSectionChunkOnWaypoint(int trackSectionId, double waypointOffset,
                                                          RawSignalingInfra rawInfra) {
        var waypointOffsetMilli = fromMeters(waypointOffset);
        var trackSectionChunks = toIntList(rawInfra.getTrackSectionChunks(trackSectionId));
        return trackSectionChunks.stream()
                .filter(chunk -> {
                    var startChunk = rawInfra.getTrackChunkOffset(chunk);
                    var endChunk = startChunk + rawInfra.getTrackChunkLength(chunk);
                    return waypointOffsetMilli >= startChunk && waypointOffsetMilli <= endChunk;
                })
                .findFirst()
                .orElseThrow(() -> new RuntimeException(
                        String.format("The waypoint is not located on the track section %s", trackSectionId)));

    }

    private static double getBlockOffset(int blockId, int trackChunkId, int trackSectionId, double waypointOffsetMeters,
                                         EdgeDirection direction, FullInfra infra) {
        var waypointOffset = fromMeters(waypointOffsetMeters);
        var trackSectionLength = infra.rawInfra().getTrackSectionLength(trackSectionId);
        var trackChunkOffset = infra.rawInfra().getTrackChunkOffset(trackChunkId);
        var trackChunkLength = infra.rawInfra().getTrackChunkLength(trackChunkId);
        var dirTrackChunkOffset = direction.equals(START_TO_STOP)
                ? trackChunkOffset
                : trackSectionLength - trackChunkOffset - trackChunkLength;
        var dirWaypointOffset = direction.equals(START_TO_STOP)
                ? waypointOffset
                : trackSectionLength - waypointOffset;
        var startBlockToStartChunk = 0L;
        var blockTrackChunks = toIntList(infra.blockInfra().getTrackChunksFromBlock(blockId));
        for (Integer blockTrackChunkDirId: blockTrackChunks) {
            var blockTrackChunkId = toValue(blockTrackChunkDirId);
            if (blockTrackChunkId == trackChunkId) {
                return Math.abs(startBlockToStartChunk + dirWaypointOffset - dirTrackChunkOffset);
            }
            startBlockToStartChunk += infra.rawInfra().getTrackChunkLength(blockTrackChunkId);
        }
        throw new AssertionError(
                String.format("getBlockOffset: Track chunk %s not in block %s", trackChunkId, blockId));
    }

    /** Returns the list of dir track id on the route. Can contain duplicates. */
    private List<Integer> getRouteDirTracks(RawSignalingInfra rawInfra, int routeId) {
        var res = new ArrayList<Integer>();
        for (var dirChunk : toIntList(rawInfra.getChunksOnRoute(routeId))) {
            var currentTrack = DirStaticIdxKt.from(
                    rawInfra.getTrackFromChunk(toValue(dirChunk)),
                    toDirection(dirChunk)
            );
            res.add(currentTrack);
        }
        return res;
    }

    private void validatePathfindingResult(PathfindingResult res, PathfindingWaypoint[][] reqWaypoints,
                                           RawSignalingInfra rawInfra) {
        var routeTracks = res.routePaths.stream()
                .flatMap(rjsRoutePath ->
                        getRouteDirTracks(rawInfra, rawInfra.getRouteFromName(rjsRoutePath.route)).stream())
                .distinct()
                .toList();
        assertPathRoutesAreAdjacent(routeTracks, rawInfra);

        var tracksOnPath = res.routePaths.stream()
                .flatMap(route -> route.trackSections.stream())
                .toList();
        assertPathTracksAreComplete(tracksOnPath, rawInfra);
        assertRequiredWaypointsOnPathTracks(reqWaypoints, tracksOnPath);
    }

    private void assertPathRoutesAreAdjacent(List<Integer> routeTracks, RawSignalingInfra rawInfra) {
        for (int i = 0; i < routeTracks.size() - 1; i++) {
            var nextTrackSections = toIntList(getNextTrackSections(rawInfra, routeTracks.get(i)));
            assert nextTrackSections.contains(routeTracks.get(i + 1))
                    : "The path goes over consecutive tracks that are not adjacent";
        }
    }

    private void assertPathTracksAreComplete(List<RJSDirectionalTrackRange> tracksOnPath, RawSignalingInfra rawInfra) {
        int i = 0;
        while (i < tracksOnPath.size()) {
            var track = tracksOnPath.get(i);
            var trackName = track.trackSectionID;
            var fullTrack = new ArrayList<>(tracksOnPath.stream()
                    .filter(trackOnPath -> Objects.equals(trackOnPath.trackSectionID, track.trackSectionID))
                    .toList());
            var fullTrackLength =
                    toMeters(rawInfra.getTrackSectionLength(getTrackSectionFromNameOrThrow(trackName, rawInfra)));

            var beginEndpoint = fullTrack.get(0).begin;
            var endEndpoint = fullTrack.get(fullTrack.size() - 1).end;
            var trackBegin = 0.;
            var trackEnd = fullTrackLength;
            if (track.direction.equals(STOP_TO_START)) {
                beginEndpoint = fullTrack.get(0).end;
                endEndpoint = fullTrack.get(fullTrack.size() - 1).begin;
                trackBegin = fullTrackLength;
                trackEnd = 0.;
                Collections.reverse(fullTrack);
            }

            // The first track starts at the first waypoint offset, hence it does not need to start at a track endpoint
            assert i == 0 || beginEndpoint == trackBegin
                    : String.format("The path goes through the track %s without starting at its endpoint", trackName);

            i += fullTrack.size();
            // The last track ends at the last waypoint offset, hence it does not need to end at a track endpoint
            assert i == tracksOnPath.size() || Math.abs(endEndpoint - trackEnd) < 1e-3
                    : String.format("The path goes through the track %s without ending at its endpoint", trackName);

            // The track should be whole
            for (int j = 0; j < fullTrack.size() - 1; j++) {
                assert Math.abs(fullTrack.get(j).end - fullTrack.get(j + 1).begin) < 1e-3
                        : String.format("The path goes through a partially incomplete track %s", trackName);
            }
        }
    }

    private void assertRequiredWaypointsOnPathTracks(PathfindingWaypoint[][] reqWaypoints,
                                                     List<RJSDirectionalTrackRange> tracksOnPath) {
        // Checks that at least one waypoint of each step is on the path
        assert Arrays.stream(reqWaypoints).allMatch(step -> Arrays.stream(step)
                .anyMatch(waypoint -> tracksOnPath.stream()
                        .anyMatch(trackOnPath -> isWaypointOnTrack(waypoint, trackOnPath))))
                : "The path does not contain one of the wanted steps";
    }

    private boolean isWaypointOnTrack(PathfindingWaypoint waypoint, RJSDirectionalTrackRange track) {
        return Objects.equals(track.trackSectionID, waypoint.trackSection)
                && Objects.equals(track.direction, waypoint.direction)
                && (track.begin <= waypoint.offset || Math.abs(track.begin - waypoint.offset) < 1e-3)
                && (track.end >= waypoint.offset || Math.abs(track.end - waypoint.offset) < 1e-3);
    }
}
