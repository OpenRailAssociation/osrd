package fr.sncf.osrd.api.pathfinding.request

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingResistance
import fr.sncf.osrd.railjson.schema.rollingstock.RJSRollingStock

class PathfindingRequest
/** Create a new pathfinding request */
(
    /**
     * A list of locations the path must to through. A location is a group of points. The path only
     * has to go through a single point per location.
     */
    var waypoints: Array<Array<PathfindingWaypoint>>,
    /** The infrastructure identifier */
    var infra: String,
    /** expectedVersion The expected infrastructure version */
    @Json(name = "expected_version") var expectedVersion: String,
    /** List of rolling stocks that must be able to use this path */
    @Json(name = "rolling_stocks") var rollingStocks: List<RJSRollingStock>
) {

    companion object {
        val adapter: JsonAdapter<PathfindingRequest> =
            Moshi.Builder()
                .add(KotlinJsonAdapterFactory())
                .add(RJSRollingResistance.adapter)
                .build()
                .adapter(PathfindingRequest::class.java)
    }
}
