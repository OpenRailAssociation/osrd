package fr.sncf.osrd.utils

import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection

/** A direction along an axis */
enum class Direction {
    /** The direction along which the position measure increases */
    INCREASING,
    /** The direction along which the position measure decreases */
    DECREASING;

    val opposite: Direction
        get() =
            when (this) {
                INCREASING -> DECREASING
                DECREASING -> INCREASING
            }

    val toEndpoint: Endpoint
        get() =
            when (this) {
                INCREASING -> Endpoint.END
                DECREASING -> Endpoint.START
            }

    /** Returns 1 for INCREASING, -1 for DECREASING */
    val sign
        get() =
            when (this) {
                INCREASING -> 1
                DECREASING -> -1
            }
}

fun EdgeDirection.toDirection(): Direction {
    return when (this) {
        EdgeDirection.START_TO_STOP -> Direction.INCREASING
        EdgeDirection.STOP_TO_START -> Direction.DECREASING
    }
}
