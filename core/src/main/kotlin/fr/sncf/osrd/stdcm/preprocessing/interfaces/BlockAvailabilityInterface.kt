package fr.sncf.osrd.stdcm.preprocessing.interfaces

import fr.sncf.osrd.conflicts.TravelledPath
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.utils.units.Offset

/** Abstract interface used to request the availability of path sections */
interface BlockAvailabilityInterface {
    /**
     * Request availability information about a section of the path.
     *
     * Can return either an instance of either type:
     * * Available: the section is available
     * * Unavailable: the section isn't available
     * * NotEnoughLookahead: the train path needs to extend further, it depends on a directional
     *   choice
     *
     * More details are given in the instances.
     *
     * We are only interested in what happens during the time when the head of the train is in the
     * given section. It's expressed as a path segment because it's the more convenient way to input
     * it, but it should actually be seen as a time segment. Conflicts can be reported during that
     * time in other places, but anything that happens when the train's head isn't in the given path
     * segment is not reported.
     *
     * Note: every position refers to the position of the head of the train. The implementation of
     * BlockAvailabilityInterface must account for train length, sight distance, and similar
     * factors.
     *
     * @param infraExplorer describes the path and envelope of the train
     * @param startOffset Start of the section to check for availability, as an offset from the
     *   start of the path
     * @param endOffset End of the section to check for availability, as an offset from the start of
     *   the path
     * @param startTime Time at which the train is at `startOffset`.
     * @return An Availability instance.
     */
    fun getAvailability(
        infraExplorer: InfraExplorerWithEnvelope,
        startOffset: Offset<Path>,
        endOffset: Offset<Path>,
        startTime: Double
    ): Availability

    /** Represents the availability of the requested section */
    sealed class Availability

    /**
     * The requested section is available.
     *
     * For example: a train enter the section at t=10, sees a signal 42s after entering the section,
     * and the signal is green until t=100. The result would be:
     * * maximumDelay = 100 - 42 - 10 = 48
     * * timeOfNextConflict = 100
     */
    data class Available(
        /** The train can use the section now and up to `maximumDelay` later without conflict */
        val maximumDelay: Double,
        /** Earliest time any resource used by the train is reused by another one */
        val timeOfNextConflict: Double
    ) : Availability()

    /** The requested section isn't available yet */
    data class Unavailable(
        /** Minimum delay to add to the departure time to avoid any conflict */
        val duration: Double,
        /**
         * Exact offset of the first conflict encountered. It's always an offset that delimits an
         * unavailable section.
         *
         * It's either the offset where we start using a resource before it's available, or the
         * offset where the train would have released a resource it has kept for too long.
         */
        val firstConflictOffset: Offset<TravelledPath>
    ) : Availability()

    /**
     * This is thrown when the availability of the requested section can't be determined, the path
     * needs to extend further. The availability depends on the block taken by the train after the
     * end of the given path.
     */
    class NotEnoughLookaheadError : RuntimeException()
}
