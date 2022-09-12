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
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra_state.api.TrainPath;
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
import fr.sncf.osrd.standalone_sim.result.ResultEnvelopePoint;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.train.RollingStock;
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
            var startLocation = getStartLocation(startLocations, stdcmPath);
            var endLocation = getEndLocation(endLocations, stdcmPath);
            var trainPath = makeTrainPath(startLocation, endLocation, stdcmPath);

            var envelopePath = EnvelopeTrainPath.from(trainPath);
            var trainSchedule = makeTrainSchedule(envelopePath, rollingStock);
            var timeStep = 2.;

            // Compute the most restricted speed profile
            var mrsp = MRSP.from(trainPath, trainSchedule.rollingStock, true, trainSchedule.tags);
            final var speedLimits = MRSP.from(trainPath, trainSchedule.rollingStock, false, trainSchedule.tags);

            // Modify this trip so it complies with STDCM block occupation restrictions
            var stdcmEnvelope = STDCMSimulation.makeSTDCMEnvelope(
                    rollingStock,
                    envelopePath,
                    stdcmPath,
                    trainPath,
                    startTime,
                    timeStep,
                    mrsp,
                    trainSchedule
            );

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

    /** Generate a train schedule matching the envelope path and rolling stock, with one stop at the end */
    private static StandaloneTrainSchedule makeTrainSchedule(EnvelopePath envelopePath, RollingStock rollingStock) {
        List<TrainStop> trainStops = new ArrayList<>();
        trainStops.add(new TrainStop(envelopePath.length, 0.1));
        return new StandaloneTrainSchedule(rollingStock, 0., trainStops, List.of(), List.of());
    }

    /** Build the train path */
    private static TrainPath makeTrainPath(
            EdgeLocation<SignalingRoute> startLocation,
            EdgeLocation<SignalingRoute> endLocation,
            List<BlockUse> stdcmPath
    ) {
        var signalingRoutePath = stdcmPath.stream().map(blockUse -> blockUse.block.route).toList();
        return TrainPathBuilder.from(
                signalingRoutePath,
                routeToTrackLocation(startLocation),
                routeToTrackLocation(endLocation)
        );
    }

    /** Find which start location was used for the final path */
    private static EdgeLocation<SignalingRoute> getStartLocation(
            List<EdgeLocation<SignalingRoute>> startLocations,
            List<BlockUse> stdcmPath
    ) {
        var startLocMap = new HashMap<SignalingRoute, EdgeLocation<SignalingRoute>>();
        for (var loc : startLocations)
            startLocMap.put(loc.edge(), loc);
        return startLocMap.get(stdcmPath.get(0).block.route);
    }

    /** Find which end location was used for the final path */
    private static EdgeLocation<SignalingRoute> getEndLocation(
            List<EdgeLocation<SignalingRoute>> endLocations,
            List<BlockUse> stdcmPath
    ) {
        var endLocMap = new HashMap<SignalingRoute, EdgeLocation<SignalingRoute>>();
        for (var loc : endLocations)
            endLocMap.put(loc.edge(), loc);
        return endLocMap.get(stdcmPath.get(stdcmPath.size() - 1).block.route);
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

