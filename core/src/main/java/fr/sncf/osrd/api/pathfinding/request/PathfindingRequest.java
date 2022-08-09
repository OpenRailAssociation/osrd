package fr.sncf.osrd.api.pathfinding.request;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import java.util.List;

public class PathfindingRequest {
    public static final JsonAdapter<PathfindingRequest> adapter = new Moshi
            .Builder()
            .add(RJSRollingResistance.adapter)
            .build()
            .adapter(PathfindingRequest.class);

    /** Create a new pathfinding request */
    public PathfindingRequest(PathfindingWaypoint[][] waypoints, String infra,
                              String expectedVersion, List<RJSRollingStock> rollingStocks) {
        this.waypoints = waypoints;
        this.infra = infra;
        this.expectedVersion = expectedVersion;
        this.rollingStocks = rollingStocks;
    }

    public PathfindingRequest() {
    }

    /** A list of locations the path must to through. A location is a group of points.
     *  The path only has to go through a single point per location.
     */
    public PathfindingWaypoint[][] waypoints;

    /** The infrastructure identifier */
    public String infra;

    /** expectedVersion The expected infrastructure version */
    @Json(name = "expected_version")
    public String expectedVersion;

    /** List of rolling stocks that must be able to use this path */
    @Json(name = "rolling_stocks")
    public List<RJSRollingStock> rollingStocks;
}
