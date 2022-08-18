package fr.sncf.osrd.api.stdcm;

import com.squareup.moshi.Json;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import java.util.Collection;

@SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
public final class STDCMRequest {
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
    public Collection<STDCMEndpoint.RouteOccupancy> routeOccupancies;

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
            Collection<STDCMEndpoint.RouteOccupancy> routeOccupancies,
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
}
