package fr.sncf.osrd.utils

import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint

/** An endpoint on an oriented segment */
enum class Endpoint {
    /** The point at the start of the oriented segment */
    START,
    /** The point at the end of the oriented segment */
    END;

    val opposite: Endpoint
        get() =
            when (this) {
                START -> END
                END -> START
            }

    val directionAway: Direction
        get() =
            when (this) {
                START -> Direction.INCREASING
                END -> Direction.DECREASING
            }

    val directionFrom: Direction
        get() = directionAway.opposite

    companion object {
        fun fromEdgeEndpoint(edgeEndpoint: EdgeEndpoint): Endpoint {
            if (edgeEndpoint == EdgeEndpoint.BEGIN) return START else return END
        }
    }
}
