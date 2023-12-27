package fr.sncf.osrd.api.pathfinding.response

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.railjson.schema.common.ID
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.warnings.Warning

class PathfindingResult(@JvmField val length: Double) {
    @JvmField
    @Json(name = "route_paths")
    var routePaths: List<RJSRoutePath> = ArrayList()

    @Json(name = "path_waypoints")
    var pathWaypoints: List<PathWaypointResult> = ArrayList()

    var geographic: RJSLineString? = null

    var schematic: RJSLineString? = null

    var slopes: List<SlopeChartPointResult> = ArrayList()

    var curves: List<CurveChartPointResult> = ArrayList()

    var warnings: List<Warning>? = null

    companion object {
        val adapterResult: JsonAdapter<PathfindingResult> = Moshi.Builder()
            .add(KotlinJsonAdapterFactory())
            .add(ID.Adapter.FACTORY)
            .build()
            .adapter(PathfindingResult::class.java)
            .failOnUnknown()
    }
}

enum class ResponseState {
    SUCCESS, ERROR
}

class PathfindingResponse(val responseState: ResponseState, val errorMessage: String?, val pathfindingResult: PathfindingResult?) {
    companion object {
        val adapterResult: JsonAdapter<PathfindingResponse> = Moshi.Builder()
            .add(KotlinJsonAdapterFactory())
            .add(ID.Adapter.FACTORY)
            .build()
            .adapter(PathfindingResponse::class.java)
            .failOnUnknown()
    }
}