package fr.sncf.osrd.api.stdcm;

import fr.sncf.osrd.api.ExceptionHandler;
import fr.sncf.osrd.api.FullInfra;
import fr.sncf.osrd.api.InfraManager;
import fr.sncf.osrd.api.pathfinding.PathfindingBlocksEndpoint;
import fr.sncf.osrd.api.pathfinding.PathfindingResultConverter;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.RJSStandaloneTrainScheduleParser;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.standalone_sim.ScheduleMetadataExtractor;
import fr.sncf.osrd.standalone_sim.result.ResultEnvelopePoint;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.stdcm.STDCMStep;
import fr.sncf.osrd.stdcm.graph.STDCMPathfinding;
import fr.sncf.osrd.stdcm.preprocessing.implementation.BlockAvailabilityLegacyAdapter;
import fr.sncf.osrd.stdcm.preprocessing.implementation.UnavailableSpaceBuilder;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.graph.Pathfinding;
import org.takes.Request;
import org.takes.Response;
import org.takes.Take;
import org.takes.rq.RqPrint;
import org.takes.rs.RsJson;
import org.takes.rs.RsText;
import org.takes.rs.RsWithBody;
import org.takes.rs.RsWithStatus;
import java.util.ArrayList;
import java.util.List;

public class STDCMEndpoint implements Take {

    private final InfraManager infraManager;

    public STDCMEndpoint(InfraManager infraManager) {
        this.infraManager = infraManager;
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
            final var infra = infraManager.getInfra(request.infra, request.expectedVersion, recorder);
            final var rollingStock = RJSRollingStockParser.parse(request.rollingStock);
            final var comfort = RJSRollingStockParser.parseComfort(request.comfort);
            final var steps = parseSteps(infra, request.steps);
            final String tag = request.speedLimitComposition;
            AllowanceValue standardAllowance = null;
            if (request.standardAllowance != null)
                standardAllowance = RJSStandaloneTrainScheduleParser.parseAllowanceValue(
                        request.standardAllowance
                );

            assert Double.isFinite(startTime);

            // Build the unavailable space
            // temporary workaround, to remove with new signaling
            var unavailableSpace = UnavailableSpaceBuilder.computeUnavailableSpace(
                    infra.rawInfra(),
                    infra.blockInfra(),
                    request.spacingRequirements,
                    rollingStock,
                    request.gridMarginAfterSTDCM,
                    request.gridMarginBeforeSTDCM
            );

            // Run the STDCM pathfinding
            var res = STDCMPathfinding.findPath(
                    infra,
                    rollingStock,
                    comfort,
                    startTime,
                    endTime,
                    steps,
                    new BlockAvailabilityLegacyAdapter(infra.blockInfra(), unavailableSpace),
                    request.timeStep,
                    request.maximumDepartureDelay,
                    request.maximumRunTime,
                    tag,
                    standardAllowance,
                    Pathfinding.TIMEOUT
            );
            if (res == null) {
                var error = new OSRDError(ErrorType.PathfindingGenericError);
                return ExceptionHandler.toResponse(error);
            }

            // Build the response
            var simResult = new StandaloneSimResult();
            simResult.speedLimits.add(ResultEnvelopePoint.from(
                    MRSP.computeMRSP(res.trainPath(), rollingStock, false, tag)
            ));
            simResult.baseSimulations.add(ScheduleMetadataExtractor.run(
                    res.envelope(),
                    res.trainPath(),
                    res.chunkPath(),
                    makeTrainSchedule(res.envelope().getEndPos(), rollingStock, comfort, res.stopResults()),
                    infra
            ));
            simResult.ecoSimulations.add(null);
            var pathfindingRes = PathfindingResultConverter.convert(infra.blockInfra(), infra.rawInfra(),
                    res.blocks(), recorder);
            var response = new STDCMResponse(simResult, pathfindingRes, res.departureTime());
            return new RsJson(new RsWithBody(STDCMResponse.adapter.toJson(response)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
        }
    }

    private static List<STDCMStep> parseSteps(FullInfra infra, List<STDCMRequest.STDCMStep> steps) {
        return steps.stream()
                .map(step -> new STDCMStep(PathfindingBlocksEndpoint.findWaypointBlocks(infra, step.waypoints),
                        step.stopDuration, step.stop))
                .toList();
    }

    /** Generate a train schedule matching the envelope and rolling stock, with one stop at the end */
    public static StandaloneTrainSchedule makeTrainSchedule(
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
