package fr.sncf.osrd.api.pathfinding.request

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection

class PathfindingWaypoint
/** Creates a pathfinding waypoint  */(
    @Json(name = "track_section") var trackSection: String,
    var offset: Double,
    var direction: EdgeDirection
)
