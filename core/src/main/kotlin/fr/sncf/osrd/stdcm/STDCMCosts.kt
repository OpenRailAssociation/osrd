package fr.sncf.osrd.stdcm

/**
 * Defines all the weights and costs used when comparing two different solutions. These values
 * define what we consider to be the "best possible solution" returned to the user.
 */
class STDCMCosts {
    companion object {
        // Cost for one second of travel time, where the train has a non-zero speed.
        const val TRAVEL_TIME_COST_PER_SECOND = 1.0

        // Cost when the result is at the limit of the tolerance window,
        // e.g. when the train can leave at 10:00 +- 00:15 and leaves at 10:15.
        // The cost is linear within the tolerance window, and 0 at the exact requested time.
        const val PLANNED_TIMING_DATA_RELATIVE_DIFF_COST = 60.0

        // Cost for one second of stop time that has been added to a planned stop.
        const val STOP_TIME_COST_PER_SECOND = 0.1

        // TODO: cost for overtake stop duration

        // TODO: cost for travel distance (?)

        fun computeCost(
            travelTime: Double,
            relativeTimingDiff: Double,
            stopTime: Double,
        ): Double {
            return travelTime * TRAVEL_TIME_COST_PER_SECOND +
                relativeTimingDiff * PLANNED_TIMING_DATA_RELATIVE_DIFF_COST +
                stopTime * STOP_TIME_COST_PER_SECOND
        }
    }
}
