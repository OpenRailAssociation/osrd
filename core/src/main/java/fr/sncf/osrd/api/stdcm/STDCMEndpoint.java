package fr.sncf.osrd.api.stdcm;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.ExceptionHandler;
import fr.sncf.osrd.api.InfraManager;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult;
import fr.sncf.osrd.api.stdcm.Launcher.Launcher;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser;
import fr.sncf.osrd.railjson.parser.RJSStandaloneTrainScheduleParser;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidRollingStock;
import fr.sncf.osrd.railjson.parser.exceptions.InvalidSchedule;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceValue;
import fr.sncf.osrd.railjson.schema.schedule.RJSStandaloneTrainSchedule;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import fr.sncf.osrd.reporting.warnings.WarningRecorderImpl;
import fr.sncf.osrd.standalone_sim.StandaloneSim;
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
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

    @Override
    public Response act(Request req) throws
            InvalidRollingStock,
            InvalidSchedule {
        var warningRecorder = new WarningRecorderImpl(false);
        try {
            // Parse request input
            var body = new RqPrint(req).printBody();
            var request = adapterRequest.fromJson(body);
            if (request == null)
                return new RsWithStatus(new RsText("missing request body"), 400);

            // load infra
            var infra = infraManager.load(request.infra, request.expectedVersion, warningRecorder);

            // Parse rolling stock
            var rollingStock = RJSRollingStockParser.parse(request.rollingStock);

            //starting time
            var startTime= request.startTime;

            //ending time
            var endTime= request.endTime;

            //starting location
            var startPoint = request.startPoints;

            //end location
            var endPoint= request.endPoints;

            //route occupancy
            var occupancy=request.RouteOccupancies;

            // Compute STDCM
            var DCM_path = Launcher.main(infra, rollingStock, startTime, endTime, startPoint, endPoint, occupancy);

            var result = new STDCMResponse(null, null);

            return new RsJson(new RsWithBody(STDCMResponse.adapter.toJson(result)));
        } catch (Throwable ex) {
            return ExceptionHandler.handle(ex);
        }
    }

    public static final class STDCMResponse {
        public static final JsonAdapter<STDCMResponse> adapter = new Moshi
                .Builder()
                .build()
                .adapter(STDCMResponse.class);

        public StandaloneSimResult simulation;

        public PathfindingResult path;

        public STDCMResponse(StandaloneSimResult simulation, PathfindingResult path) {
            this.simulation = simulation;
            this.path = path;
        }
    }

    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public static final class STDCMRequest {
        /** Infra id */
        public String infra;

        /** Infra version */
        @Json(name = "expected_version")
        public String expectedVersion;

        /** Rolling stock used for this request */
        @Json(name = "rolling_stock")
        public RJSRollingStock rollingStock;

        /** Route occupancies in the given timetable */
        @Json(name = "route_occupancies")
        public Collection<RouteOccupancy> RouteOccupancies;

        /** List of possible start points for the train */
        @Json(name = "start_points")
        public Collection<PathfindingWaypoint> startPoints;

        /** List of possible start points for the train */
        @Json(name = "end_points")
        public Collection<PathfindingWaypoint> endPoints;

        /** Train start time */
        @Json(name = "start_time")
        public double startTime;

        /** Train end time */
        @Json(name = "end_time")
        public double endTime;

        /** Create a default STDCMRequest */
        public STDCMRequest() {
            this(
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    Double.NaN,
                    Double.NaN
            );
        }

        /** Creates a STDCMRequest */
        public STDCMRequest(
                String infra,
                String expectedVersion,
                RJSRollingStock rollingStock,
                Collection<RouteOccupancy> routeOccupancies,
                Collection<PathfindingWaypoint> startPoints,
                Collection<PathfindingWaypoint> endPoints,
                double startTime,
                double endTime
        ) {
            this.infra = infra;
            this.expectedVersion = expectedVersion;
            this.rollingStock = rollingStock;
            RouteOccupancies = routeOccupancies;
            this.startPoints = startPoints;
            this.endPoints = endPoints;
            this.startTime = startTime;
            this.endTime = endTime;
        }
    }

    public static class RouteOccupancy {
        /** ID of the occupied route */
        String id;

        /** Time at which the route starts being occupied */
        @Json(name = "start_occupancy_time")
        double startOccupancyTime;

        /** Time at which the route ends being occupied */
        @Json(name = "end_occupancy_time")
        double endOccupancyTime;

        public RouteOccupancy(String id, double startOccupancyTime, double endOccupancyTime) {
            this.id = id;
            this.startOccupancyTime = startOccupancyTime;
            this.endOccupancyTime = endOccupancyTime;
        }
    }
}

