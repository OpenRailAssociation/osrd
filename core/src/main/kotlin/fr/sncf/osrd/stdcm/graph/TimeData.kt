package fr.sncf.osrd.stdcm.graph

/**
 * This class combines all the time-related elements of a node/edge.
 *
 * It contains data about the possible times that can be covered, as well as extra context about
 * stop times, time since departure, when the closest conflicts are, and so on.
 *
 * Some node-specific or edge-specific values and getters are left in their specific classes.
 *
 * Note: stop duration are described as mutable, but this feature isn't implemented yet.
 */
data class TimeData(
    /**
     * Earliest time when we can enter the current location. For edges, this is the entry time. This
     * is *not* the time at which the train *will* reach this location: we can delay departure times
     * or add allowances further on the path.
     */
    val earliestReachableTime: Double,

    /**
     * We can delay departure time from either the train start or stops. This value represents how
     * much more delay we can add to the last departure without causing any conflict.
     */
    val maxDepartureDelayingWithoutConflict: Double,

    /**
     * By how much we have added delay to any departure, both train departure time and lengthening
     * stop duration.
     */
    val totalDepartureDelay: Double,

    /**
     * Time of the next conflict on the given location. Used both to identify edges that go through
     * the same "opening", and to figure out how much delay we can add locally (with margins).
     */
    val timeOfNextConflictAtLocation: Double,

    /**
     * Time the train has spent moving since its departure. Does not include stop times. This value
     * is constant for this given partial path, unlike departure and stop times it can't be changed
     * retroactively further down the path.
     */
    val totalRunningTime: Double,

    /**
     * Time the train has spent stopped since its departure. Includes both used-requested minimum
     * stop duration, and extra stop times added to avoid conflicts.
     */
    val totalStopTime: Double,

    /**
     * Global delay that have been added to avoid conflicts on the given element, by delaying the
     * last departure.
     */
    val delayAddedToLastDeparture: Double = 0.0,
) {
    // Getters for different handy values. They may not all be used,
    // but they're here if we need them. It also shows how the values
    // are related to each other.

    /** This is the time at which we may start the train path, if there's no extra delay */
    val earliestDepartureTime = earliestReachableTime - totalRunningTime - totalStopTime

    /**
     * Time elapsed since the departure time. This may be changed further down the path by
     * lengthening stop durations.
     */
    val timeSinceDeparture = totalRunningTime + totalStopTime
}
