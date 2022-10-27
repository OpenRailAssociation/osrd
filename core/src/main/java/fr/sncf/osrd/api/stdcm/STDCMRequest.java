package fr.sncf.osrd.api.stdcm;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.railjson.schema.common.ID;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowance;
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceValue;
import java.util.Collection;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public final class STDCMRequest {

    public static final JsonAdapter<STDCMRequest> adapter = new Moshi
            .Builder()
            .add(ID.Adapter.FACTORY)
            .add(RJSRollingResistance.adapter)
            .add(RJSAllowance.adapter)
            .add(RJSAllowanceValue.adapter)
            .build()
            .adapter(STDCMRequest.class);
    /**
     * Infra id
     */
    public String infra;

    /**
     * Infra version
     */
    @Json(name = "expected_version")
    public String expectedVersion;

    /**
     * Rolling stock used for this request
     */
    @Json(name = "rolling_stock")
    public RJSRollingStock rollingStock;

    /**
     * Route occupancies in the given timetable
     */
    @Json(name = "route_occupancies")
    public Collection<RouteOccupancy> routeOccupancies;

    /**
     * List of possible start points for the train
     */
    @Json(name = "start_points")
    public Collection<PathfindingWaypoint> startPoints;

    /**
     * List of possible start points for the train
     */
    @Json(name = "end_points")
    public Collection<PathfindingWaypoint> endPoints;

    /**
     * Train start time
     */
    @Json(name = "start_time")
    public double startTime;

    /**
     * Train end time
     */
    @Json(name = "end_time")
    public double endTime;

    /**
     * Time step used in simulations
     */
    @Json(name = "time_step")
    public double timeStep = 2.;

    /**
     * By how long we can delay the departure of the train in seconds (defaults to 2h)
     */
    @Json(name = "maximum_departure_delay")
    public double maximumDepartureDelay = 3600 * 2;

    /**
     * How much longer can the train take to reach its destination,
     * compared to the time it would take with an empty timetable.
     * e.g. with a value of 2 and a fastest run time of 1h, we ignore results after 2h.
     * Defaults to 2.
     */
    @Json(name = "maximum_relative_run_time")
    public double maximumRelativeRunTime = 2;

    /**
     * Create a default STDCMRequest
     */
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

    /**
     * Creates a STDCMRequest
     */
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
        this.routeOccupancies = routeOccupancies;
        this.startPoints = startPoints;
        this.endPoints = endPoints;
        this.startTime = startTime;
        this.endTime = endTime;
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
