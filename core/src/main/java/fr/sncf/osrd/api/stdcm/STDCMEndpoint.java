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
import fr.sncf.osrd.api.stdcm.new_pipeline.STDCMPathfinding;
import fr.sncf.osrd.api.stdcm.new_pipeline.UnavailableSpaceBuilder;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
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
            var occupancies = request.routeOccupancies;
            var startLocations = findRoutes(infra, request.startPoints);
            var endLocations = findRoutes(infra, request.endPoints);

            assert Double.isFinite(startTime);

            // Build the unavailable space
            var unavailableSpace = UnavailableSpaceBuilder.computeUnavailableSpace(
                    infra,
                    occupancies,
                    rollingStock
            );
            // Run the STDCM pathfinding
            var res = STDCMPathfinding.findPath(
                    infra,
                    rollingStock,
                    startTime,
                    endTime,
                    startLocations,
                    endLocations,
                    unavailableSpace,
                    request.timeStep
            );
            if (res == null) {
                var error = new NoPathFoundError("No path could be found");
                return ExceptionHandler.toResponse(error);
            }

            // Build the response
            var simResult = new StandaloneSimResult();
            simResult.speedLimits.add(ResultEnvelopePoint.from(
                    MRSP.from(res.trainPath(), rollingStock, false, Set.of())
            ));
            simResult.baseSimulations.add(ScheduleMetadataExtractor.run(
                    res.envelope(),
                    res.trainPath(),
                    makeTrainSchedule(res.physicsPath(), rollingStock),
                    infra
            ));
            simResult.ecoSimulations.add(null);
            var pathfindingRes = PathfindingResultConverter.convert(res.routes(), infra, recorder);
            var response = new STDCMResponse(simResult, pathfindingRes);
            return new RsJson(new RsWithBody(STDCMResponse.adapter.toJson(response)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
        }
    }

    /** Generate a train schedule matching the envelope path and rolling stock, with one stop at the end */
    private static StandaloneTrainSchedule makeTrainSchedule(PhysicsPath physicsPath, RollingStock rollingStock) {
        List<TrainStop> trainStops = new ArrayList<>();
        trainStops.add(new TrainStop(physicsPath.getLength(), 0.1));
        return new StandaloneTrainSchedule(rollingStock, 0., trainStops, List.of(), List.of());
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

