package fr.sncf.osrd.railjson.schema.common

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSRouteWaypoint
import java.util.*

@ExcludeFromGeneratedCodeCoverage
data class RJSWaypointRef<T : RJSRouteWaypoint>(var id: ID<T>, var type: RJSWaypointType) {
    enum class RJSWaypointType {
        @Json(name = "BufferStop") BUFFER_STOP,
        @Json(name = "Detector") DETECTOR,
    }

    constructor(id: String, type: RJSWaypointType) : this(ID<T>(id), type)
}
