package fr.sncf.osrd.api.pathfinding.request;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock;
import java.util.List;

/**
 * @param infra The infrastructure identifier
 * @param expectedVersion The expected infrastructure version
 * @param waypoints A list of locations the path must to through. A location is a group of points.
 *     The path only has to go through a single point per location.
 * @param rollingStocks List of rolling stocks that must be able to use this path
 */
public record PathfindingRequest(
        PathfindingWaypoint[][] waypoints,
        String infra,
        @Json(name = "expected_version")
        String expectedVersion,
        @Json(name = "rolling_stocks")
        List<RJSRollingStock> rollingStocks
) {
    public static final JsonAdapter<PathfindingRequest> adapter = new Moshi
            .Builder()
            .add(RJSRollingResistance.adapter)
            .build()
            .adapter(PathfindingRequest.class);
}
