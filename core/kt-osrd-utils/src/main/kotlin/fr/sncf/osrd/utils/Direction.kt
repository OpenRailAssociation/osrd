package fr.sncf.osrd.utils

/** A direction along an axis */
enum class Direction {
    /** The direction along which the position measure increases */
    INCREASING,
    /** The direction along which the position measure decreases */
    DECREASING;

    val opposite: Direction get() = when (this) {
        INCREASING -> DECREASING
        DECREASING -> INCREASING
    }

    val toEndpoint: Endpoint get() = when(this) {
        INCREASING -> Endpoint.END
        DECREASING -> Endpoint.START
    }
}
