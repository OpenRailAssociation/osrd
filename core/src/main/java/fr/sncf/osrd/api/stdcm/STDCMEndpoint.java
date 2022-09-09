package fr.sncf.osrd.api.stdcm;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.api.ExceptionHandler;
import fr.sncf.osrd.api.InfraManager;
import fr.sncf.osrd.api.pathfinding.PathfindingResultConverter;
import fr.sncf.osrd.api.pathfinding.PathfindingRoutesEndpoint;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.pathfinding.response.NoPathFoundError;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceConvergenceException;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceValue;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.standalone_sim.ScheduleMetadataExtractor;
import fr.sncf.osrd.standalone_sim.StandaloneSim;
import fr.sncf.osrd.standalone_sim.result.ResultEnvelopePoint;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeLocation;
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeRange;
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
import java.util.HashMap;
import java.util.List;


public class STDCMEndpoint implements Take {
    static final Logger logger = LoggerFactory.getLogger(STDCMEndpoint.class);

    private final InfraManager infraManager;

    public static final JsonAdapter<STDCMRequest> adapterRequest = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRollingResistance.adapter)
            .add(RJSAllowance.adapter)
            .add(RJSAllowanceValue.adapter)
            .build()
            .adapter(STDCMRequest.class);

    public STDCMEndpoint(InfraManager infraManager) {
        this.infraManager = infraManager;
    }

    private static List<EdgeLocation<SignalingRoute>> findRoutes(
            SignalingInfra infra,
            Collection<PathfindingWaypoint> waypoints
    ) {
        var res = new ArrayList<EdgeLocation<SignalingRoute>>();
        for (var waypoint : waypoints)
            res.addAll(PathfindingRoutesEndpoint.findRoutes(infra, waypoint));
        return res;
    }

    private static List<EdgeRange<SignalingRoute>> convertResultPath(
            List<BlockUse> blockUses,
            EdgeLocation<SignalingRoute> startLocation,
            EdgeLocation<SignalingRoute> endLocation
    ) {
        var res = new ArrayList<EdgeRange<SignalingRoute>>();
        for (var blockUse : blockUses) {
            var block = blockUse.block;
            var route = block.route;
            var startOffset = 0.;
            if (route == startLocation.edge())
                startOffset = startLocation.offset();
            var endOffset = block.getLength();
            if (route == endLocation.edge())
                endOffset = endLocation.offset();
            res.add(new EdgeRange<>(route, startOffset, endOffset));
        }
        return res;
    }

    private static TrackLocation routeToTrackLocation(EdgeLocation<SignalingRoute> location) {
        var route = location.edge();
        var routeOffset = location.offset();
        var curOffset = 0.;
        for (var trackRange : route.getInfraRoute().getTrackRanges()) {
            var rangeStartOff = curOffset;
            var rangeEndOff = rangeStartOff + trackRange.getLength();
            curOffset = rangeEndOff;
            if (routeOffset < rangeStartOff || routeOffset > rangeEndOff)
                continue;
            var rangeOffset = routeOffset - rangeStartOff;
            return trackRange.offsetLocation(rangeOffset);
        }
        throw new RuntimeException("failed to convert from route to track offset");
    }

    @Override
    public Response act(Request req) throws
            InvalidRollingStock,
            InvalidSchedule {
        var recorder = new DiagnosticRecorderImpl(false);
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            // parse input data
            var infra = infraManager.load(request.infra, request.expectedVersion, recorder);
            var rollingStock = RJSRollingStockParser.parse(request.rollingStock);
            var startTime = request.startTime;
            var endTime = request.endTime;
            var occupancy = request.routeOccupancies;
            var startLocations = findRoutes(infra, request.startPoints);
            var endLocations = findRoutes(infra, request.endPoints);

            assert Double.isFinite(startTime);

            // Run STDCM
            var stdcmPath = STDCM.run(infra, rollingStock, startTime, endTime, startLocations, endLocations, occupancy);
            if (stdcmPath == null) {
                var error = new NoPathFoundError("No STDCM path could be found");
                return ExceptionHandler.toResponse(error);
            }

            // Convert the STDCM path (which sort of works with signaling routes) to a pathfinding result, which works
            // with route ranges. This involves deducing start and end location offsets.
            var startLocMap = new HashMap<SignalingRoute, EdgeLocation<SignalingRoute>>();
            for (var loc : startLocations)
                startLocMap.put(loc.edge(), loc);
            var endLocMap = new HashMap<SignalingRoute, EdgeLocation<SignalingRoute>>();
            for (var loc : endLocations)
                endLocMap.put(loc.edge(), loc);
            var startLocation = startLocMap.get(stdcmPath.get(0).block.route);
            var endLocation = endLocMap.get(stdcmPath.get(stdcmPath.size() - 1).block.route);

            // Run a regular OSRD simulation
            List<TrainStop> trainStops = new ArrayList<>();
            trainStops.add(new TrainStop(endLocation.offset(), 0));
            var trainSchedule = new StandaloneTrainSchedule(rollingStock, 0., trainStops, List.of(), List.of());
            var signalingRoutePath = stdcmPath.stream().map(blockUse -> blockUse.block.route).toList();
            var trainPath = TrainPathBuilder.from(
                    signalingRoutePath,
                    routeToTrackLocation(startLocation),
                    routeToTrackLocation(endLocation)
            );

            var envelopePath = EnvelopeTrainPath.from(trainPath);
            var timeStep = 2.;

            // Compute the most restricted speed profile
            var mrsp = MRSP.from(trainPath, trainSchedule.rollingStock, true, trainSchedule.tags);
            final var speedLimits = MRSP.from(trainPath, trainSchedule.rollingStock, false, trainSchedule.tags);

            // Compute an unrestricted, max effort trip
            var baseEnvelope = StandaloneSim.computeMaxEffortEnvelope(mrsp, timeStep, envelopePath, trainSchedule);

            // Modify this trip so it complies with STDCM block occupation restrictions
            // Step 1: find the position of block starts in the envelope path
            double[] blockBounds = new double[stdcmPath.size() + 1];
            assert trainPath.routePath().size() == stdcmPath.size();
            var routePath = trainPath.routePath();
            for (int i = 0; i < routePath.size(); i++)
                blockBounds[i] = routePath.get(i).pathOffset();
            blockBounds[0] = 0.;
            blockBounds[stdcmPath.size()] = envelopePath.length;

            // Step 2: compile the times at which the train would reach each block start without margins
            double[] blockEntryTimes = new double[stdcmPath.size()];
            for (int i = 0; i < stdcmPath.size(); i++)
                blockEntryTimes[i] = baseEnvelope.interpolateTotalTime(blockBounds[i]);

            // Step 3: add margins so the train reaches its block in the allotted time range
            var allowanceRanges = new ArrayList<AllowanceRange>();
            var totalDelay = 0.;
            var endLastRange = 0.;
            for (int i = 0; i < stdcmPath.size(); i++) {
                var simulatedEntryTime = startTime + blockEntryTimes[i] + totalDelay;
                var allowedEntryTime = stdcmPath.get(i).reservationStartTime;
                logger.info("block {}: sim entry time {}, allowed time {}", i, simulatedEntryTime, allowedEntryTime);
                if (simulatedEntryTime < allowedEntryTime) {
                    var blockDelay = allowedEntryTime - simulatedEntryTime + 1.;
                    totalDelay += blockDelay;
                    var allowanceValue = new AllowanceValue.FixedTime(blockDelay);
                    var newRange = new AllowanceRange(endLastRange, blockBounds[i], allowanceValue);
                    allowanceRanges.add(newRange);
                    endLastRange = blockBounds[i];
                    logger.info("\t\tadding {}s of delay from position {} to {}",
                            blockDelay, newRange.beginPos, newRange.endPos);
                }
            }
            allowanceRanges.add(
                    new AllowanceRange(endLastRange, baseEnvelope.getEndPos(), new AllowanceValue.FixedTime(0))
            );

            var allowance = new MarecoAllowance(
                    new EnvelopeSimContext(rollingStock, envelopePath, timeStep),
                    0,
                    envelopePath.length,
                    0,
                    allowanceRanges
            );
            var stdcmEnvelope = StandaloneSim.applyAllowances(baseEnvelope, List.of(allowance));

            var simResult = new StandaloneSimResult();
            simResult.speedLimits.add(ResultEnvelopePoint.from(speedLimits));
            simResult.baseSimulations.add(ScheduleMetadataExtractor.run(
                    stdcmEnvelope, trainPath, trainSchedule, infra));
            simResult.ecoSimulations.add(null);

            // Build the result
            var osrdPath = new Pathfinding.Result<>(
                    convertResultPath(stdcmPath, startLocation, endLocation),
                    List.of()
            );
            var pathfindingRes = PathfindingResultConverter.convert(osrdPath, infra, new DiagnosticRecorderImpl(false));
            var response = new STDCMResponse(simResult, pathfindingRes);
            return new RsJson(new RsWithBody(STDCMResponse.adapter.toJson(response)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
        }
    }

    public static class RouteOccupancy {
        /**
         * ID of the occupied route
         */
        public String id;

        /**
         * Time at which the route starts being occupied
         */
        @Json(name = "start_occupancy_time")
        public double startOccupancyTime;

        /**
         * Time at which the route ends being occupied
         */
        @Json(name = "end_occupancy_time")
        public double endOccupancyTime;

        /** Creates a new route occupancy */
        public RouteOccupancy(String id, double startOccupancyTime, double endOccupancyTime) {
            this.id = id;
            this.startOccupancyTime = startOccupancyTime;
            this.endOccupancyTime = endOccupancyTime;
        }
    }
}

