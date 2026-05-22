package fr.sncf.osrd.railjson.schema.infra

import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint
import java.util.*

/** An identifier for a side of a specific track section */
data class RJSTrackEndpoint(val track: String, val endpoint: EdgeEndpoint)
