package fr.sncf.osrd.api.stdcm;

import fr.sncf.osrd.api.ExceptionHandler;
import fr.sncf.osrd.api.InfraManager;
import fr.sncf.osrd.api.pathfinding.PathfindingResultConverter;
import fr.sncf.osrd.api.pathfinding.PathfindingRoutesEndpoint;
import fr.sncf.osrd.api.pathfinding.RemainingDistanceEstimator;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.pathfinding.response.NoPathFoundError;
import fr.sncf.osrd.api.stdcm.graph.STDCMPathfinding;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.standalone_sim.ScheduleMetadataExtractor;
import fr.sncf.osrd.standalone_sim.StandaloneSim;
import fr.sncf.osrd.standalone_sim.result.ResultEnvelopePoint;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.graph.GraphAdapter;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.util.*;


public class STDCMEndpoint implements Take {
    static final Logger logger = LoggerFactory.getLogger(STDCMEndpoint.class);

    private final InfraManager infraManager;

    public STDCMEndpoint(InfraManager infraManager) {
        this.infraManager = infraManager;
    }

    private static Set<EdgeLocation<SignalingRoute>> findRoutes(
            SignalingInfra infra,
            Collection<PathfindingWaypoint> waypoints
    ) {
        var res = new HashSet<EdgeLocation<SignalingRoute>>();
        for (var waypoint : waypoints)
            res.addAll(PathfindingRoutesEndpoint.findRoutes(infra, waypoint));
        return res;
    }

    @Override
    public Response act(Request req) throws InvalidRollingStock, InvalidSchedule {
        var recorder = new DiagnosticRecorderImpl(false);
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = STDCMRequest.adapter.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            // parse input data
            var startTime = request.startTime;
            var endTime = request.endTime;
            if (Double.isNaN(startTime) && Double.isNaN(endTime))
                throw new RuntimeException(
                        "Invalid STDCM request: both end time and start time are unspecified, at least one must be set"
                );
            if (Double.isNaN(startTime))
                throw new RuntimeException("STDCM requests with unspecified start time are not supported yet");
            var infra = infraManager.load(request.infra, request.expectedVersion, recorder);
            var rollingStock = RJSRollingStockParser.parse(request.rollingStock);
            var comfort = RJSRollingStockParser.parseComfort(request.comfort);
            var occupancies = request.routeOccupancies;
            var startLocations = findRoutes(infra, request.startPoints);
            var endLocations = findRoutes(infra, request.endPoints);
            String tag = request.speedLimitComposition;

            assert Double.isFinite(startTime);

            // Build the unavailable space
            var unavailableSpace = UnavailableSpaceBuilder.computeUnavailableSpace(
                    infra,
                    occupancies,
                    rollingStock,
                    request.gridMarginAfterSTDCM,
                    request.gridMarginBeforeSTDCM
            );
            double minRunTime = getMinRunTime(
                    infra, rollingStock, comfort, startLocations, endLocations, request.timeStep);

            // Run the STDCM pathfinding
            var res = STDCMPathfinding.findPath(
                    infra,
                    rollingStock,
                    comfort,
                    startTime,
                    endTime,
                    startLocations,
                    endLocations,
                    unavailableSpace,
                    request.timeStep,
                    request.maximumDepartureDelay,
                    request.maximumRelativeRunTime * minRunTime,
                    tag
            );
            if (res == null) {
                var error = new NoPathFoundError("No path could be found");
                return ExceptionHandler.toResponse(error);
            }

            // Build the response
            var simResult = new StandaloneSimResult();
            simResult.speedLimits.add(ResultEnvelopePoint.from(
                    MRSP.from(res.trainPath(), rollingStock, false, tag)
            ));
            simResult.baseSimulations.add(ScheduleMetadataExtractor.run(
                    res.envelope(),
                    res.trainPath(),
                    makeTrainSchedule(res.envelope(), rollingStock, comfort),
                    infra
            ));
            simResult.ecoSimulations.add(null);
            var pathfindingRes = PathfindingResultConverter.convert(res.routes(), infra, recorder);
            var response = new STDCMResponse(simResult, pathfindingRes, res.departureTime());
            return new RsJson(new RsWithBody(STDCMResponse.adapter.toJson(response)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
        }
    }

    /** Find the minimum run time to go from start to end, assuming the timetable is empty.
     * Returns 0 if we can't find a valid path. */
    private double getMinRunTime(
            SignalingInfra infra,
            RollingStock rollingStock,
            RollingStock.Comfort comfort,
            Set<EdgeLocation<SignalingRoute>> startLocations,
            Set<EdgeLocation<SignalingRoute>> endLocations,
            double timeStep
    ) {
        var remainingDistanceEstimator = new RemainingDistanceEstimator(endLocations);
        var rawPath = new Pathfinding<>(new GraphAdapter<>(infra.getSignalingRouteGraph()))
                .setEdgeToLength(route -> route.getInfraRoute().getLength())
                .setRemainingDistanceEstimator(remainingDistanceEstimator)
                .runPathfinding(List.of(startLocations, endLocations));
        if (rawPath == null)
            return 0;
        var routes = rawPath.ranges().stream()
                .map(Pathfinding.EdgeRange::edge)
                .toList();

        var firstRange = rawPath.ranges().get(0);
        var startLocation = TrackRangeView.getLocationFromList(
                firstRange.edge().getInfraRoute().getTrackRanges(), firstRange.start());
        var lastRange = rawPath.ranges().get(rawPath.ranges().size() - 1);
        var lastLocation = TrackRangeView.getLocationFromList(
                lastRange.edge().getInfraRoute().getTrackRanges(), lastRange.end());

        var path = TrainPathBuilder.from(routes, startLocation, lastLocation);
        var standaloneResult = StandaloneSim.run(
                infra,
                path,
                List.of(new StandaloneTrainSchedule(
                        rollingStock,
                        0,
                        List.of(new TrainStop(path.length(), 0.1)),
                        List.of(),
                        null,
                        comfort
                )),
                timeStep
        );
        var headPositions = standaloneResult.baseSimulations.get(0).headPositions;
        return headPositions.get(headPositions.size() - 1).time;
    }

    /** Generate a train schedule matching the envelope and rolling stock, with one stop at the end */
    private static StandaloneTrainSchedule makeTrainSchedule(
            Envelope envelope,
            RollingStock rollingStock,
            RollingStock.Comfort comfort
    ) {
        List<TrainStop> trainStops = new ArrayList<>();
        trainStops.add(new TrainStop(envelope.getEndPos(), 0.1));
        return new StandaloneTrainSchedule(rollingStock, 0., trainStops, List.of(), null, comfort);
    }
}

