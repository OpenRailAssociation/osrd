package fr.sncf.osrd.railjson.schema.infra

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.common.Identified
import fr.sncf.osrd.railjson.schema.common.RJSWaypointRef
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint

/**
 * Routes are described as a list of TVD Sections, Switches in specific positions, and an entry
 * point
 */
data class RJSRoute(
    override val id: String,
    @Json(name = "entry_point") val entryPoint: RJSWaypointRef<out RJSRouteWaypoint>,
    @Json(name = "entry_point_direction") val entryPointDirection: EdgeDirection,
    @Json(name = "exit_point") val exitPoint: RJSWaypointRef<out RJSRouteWaypoint>,
    @Json(name = "release_detectors") val releaseDetectors: List<String>,
    @Json(name = "switches_directions") val switchesDirections: Map<String, String>,
) : Identified {
    constructor(
        id: String,
        entryPoint: RJSWaypointRef<out RJSRouteWaypoint>,
        entryPointDirection: EdgeDirection,
        exitPoint: RJSWaypointRef<out RJSRouteWaypoint>,
        switchesDirections: Map<String, String>,
    ) : this(
        id = id,
        entryPoint = entryPoint,
        entryPointDirection = entryPointDirection,
        exitPoint = exitPoint,
        releaseDetectors = listOf(),
        switchesDirections = switchesDirections,
    )
}
