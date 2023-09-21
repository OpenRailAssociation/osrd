package fr.sncf.osrd.api.stdcm;

import fr.sncf.osrd.api.ExceptionHandler;
import fr.sncf.osrd.api.InfraManager;
import fr.sncf.osrd.api.pathfinding.LegacyPathfindingResultConverter;
import fr.sncf.osrd.api.pathfinding.PathfindingRoutesEndpoint;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim_infra.LegacyMRSP;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.RJSStandaloneTrainScheduleParser;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.standalone_sim.ScheduleMetadataExtractor;
import fr.sncf.osrd.standalone_sim.result.ResultEnvelopePoint;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.stdcm.LegacySTDCMStep;
import fr.sncf.osrd.stdcm.graph.LegacySTDCMPathfinding;
import fr.sncf.osrd.stdcm.preprocessing.implementation.LegacyUnavailableSpaceBuilder;
import fr.sncf.osrd.stdcm.preprocessing.implementation.RouteAvailabilityLegacyAdapter;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TrainStop;
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
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;


public class LegacySTDCMEndpoint implements Take {
    static final Logger logger = LoggerFactory.getLogger(LegacySTDCMEndpoint.class);

    private final InfraManager infraManager;

    public LegacySTDCMEndpoint(InfraManager infraManager) {
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
    public Response act(Request req) throws OSRDError {
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
                throw new OSRDError(ErrorType.InvalidSTDCMUnspecifiedStartAndEndTime);
            if (Double.isNaN(startTime))
                throw new OSRDError(ErrorType.InvalidSTDCMUnspecifiedStartTime);
            // TODO : change with get infra when the front is ready
            final var fullInfra = infraManager.getInfra(request.infra, request.expectedVersion, recorder);
            final var infra = fullInfra.java();
            final var rollingStock = RJSRollingStockParser.parse(request.rollingStock);
            final var comfort = RJSRollingStockParser.parseComfort(request.comfort);
            final var steps = parseSteps(infra, request.steps);
            final String tag = request.speedLimitComposition;
            var occupancies = request.routeOccupancies;
            AllowanceValue standardAllowance = null;
            if (request.standardAllowance != null)
                standardAllowance = RJSStandaloneTrainScheduleParser.parseAllowanceValue(
                        request.standardAllowance
                );

            assert Double.isFinite(startTime);

            // Build the unavailable space
            // temporary workaround, to remove with new signaling
            occupancies = addWarningOccupancies(infra, occupancies);
            var unavailableSpace = LegacyUnavailableSpaceBuilder.computeUnavailableSpace(
                    infra,
                    occupancies,
                    rollingStock,
                    request.gridMarginAfterSTDCM,
                    request.gridMarginBeforeSTDCM
            );

            // Run the STDCM pathfinding
            var res = LegacySTDCMPathfinding.findPath(
                    infra,
                    rollingStock,
                    comfort,
                    startTime,
                    endTime,
                    steps,
                    new RouteAvailabilityLegacyAdapter(unavailableSpace),
                    request.timeStep,
                    request.maximumDepartureDelay,
                    request.maximumRunTime,
                    tag,
                    standardAllowance
            );
            if (res == null) {
                var error = new OSRDError(ErrorType.PathfindingGenericError);
                return ExceptionHandler.toResponse(error);
            }

            // Build the response
            var simResult = new StandaloneSimResult();
            simResult.speedLimits.add(ResultEnvelopePoint.from(
                    LegacyMRSP.from(res.trainPath(), rollingStock, false, tag)
            ));
            simResult.baseSimulations.add(ScheduleMetadataExtractor.run(
                    res.envelope(),
                    res.trainPath(),
                    makeTrainSchedule(res.envelope().getEndPos(), rollingStock, comfort, res.stopResults()),
                    fullInfra
            ));
            simResult.ecoSimulations.add(null);
            var pathfindingRes = LegacyPathfindingResultConverter.convert(res.routes(), infra, recorder);
            var response = new STDCMResponse(simResult, pathfindingRes, res.departureTime());
            return new RsJson(new RsWithBody(STDCMResponse.adapter.toJson(response)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
        }
    }

    private List<LegacySTDCMStep> parseSteps(
            SignalingInfra infra,
            List<STDCMRequest.STDCMStep> steps
    ) {
        return steps.stream()
                .map(step -> new LegacySTDCMStep(findRoutes(infra, step.waypoints), step.stopDuration, step.stop))
                .toList();
    }

    /** The inputs only contains occupied blocks, we need to add the warning in the previous one (assuming BAL).
     * To be removed with new signaling. */
    private static Collection<STDCMRequest.RouteOccupancy> addWarningOccupancies(
            SignalingInfra infra,
            Collection<STDCMRequest.RouteOccupancy> occupancies
    ) {
        var result = new HashSet<>(occupancies);
        var routeGraph = infra.getSignalingRouteGraph();
        for (var occupancy : occupancies) {
            var route = infra.findSignalingRoute(occupancy.id, "BAL3");
            assert route != null;
            var startRouteNode = routeGraph.incidentNodes(route).nodeU();
            var predecessorRoutes = routeGraph.inEdges(startRouteNode);
            for (var predecessor : predecessorRoutes)
                result.add(new STDCMRequest.RouteOccupancy(
                        predecessor.getInfraRoute().getID(),
                        occupancy.startOccupancyTime,
                        occupancy.endOccupancyTime
                ));
        }
        return result;
    }

    /** Generate a train schedule matching the envelope and rolling stock, with one stop at the end */
    private static StandaloneTrainSchedule makeTrainSchedule(
            double endPos,
            RollingStock rollingStock,
            RollingStock.Comfort comfort,
            List<TrainStop> trainStops
    ) {
        trainStops.add(new TrainStop(endPos, 0.1));
        return new StandaloneTrainSchedule(rollingStock, 0., new ArrayList<>(), trainStops,
                List.of(), null, comfort, null, null);
    }
}

