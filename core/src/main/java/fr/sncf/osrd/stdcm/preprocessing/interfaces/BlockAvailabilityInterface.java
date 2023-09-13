package fr.sncf.osrd.stdcm.preprocessing.interfaces;

import com.google.common.base.Objects;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate;
import java.util.List;

/** Abstract interface used to request the availability of path sections */
@SuppressFBWarnings(
        value = "URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD",
        justification = "The classes aren't used yet. This should be removed by the end of the migration."
)
public interface BlockAvailabilityInterface {

    /** Request availability information about a section of the path.
     * <br/>
     * Can return either an instance of either type:
     * <ul>
     * <li>Available: the section is available </li>
     * <li>Unavailable: the section isn't available </li>
     * <li>NotEnoughLookahead: the train path needs to extend further, it depends on a directional choice </li>
     * </ul>
     * More details are given in the instances.
     * <br/>
     * Note: every position refers to the position of the head of the train.
     * The implementation of RouteAvailabilityInterface must account for train length, sight distance,
     * and similar factors.
     *
     * @param routes List of route IDs taken by the train
     * @param startOffset Start of the section to check for availability, as an offset from the start of the path
     * @param endOffset End of the section to check for availability, as an offset from the start of the path
     * @param envelope Envelope describing the position of the train at any moment.
     *                 Must be exactly `(endOffset - startOffset) long.
     * @param startTime Time at which the train is at `startOffset`.
     * @return An Availability instance.
     */
    Availability getAvailability(
            List<Integer> routes,
            double startOffset,
            double endOffset,
            EnvelopeTimeInterpolate envelope,
            double startTime
    );

    /** Represents the availability of the requested section */
    abstract sealed class Availability
            permits Available, Unavailable, NotEnoughLookahead
    {}

    /** The requested section is available.
     * <br/>
     * For example: a train enter the section at t=10, sees a signal 42s after entering the section,
     * and the signal is green until t=100. The result would be:
     * <ul>
     * <li>maximumDelay = 100 - 42 - 10 = 48
     * <li>timeOfNextConflict = 100
     * </ul>
     */
    final class Available extends Availability {
        /** The train can use the section now and up to `maximumDelay` later without conflict */
        public final double maximumDelay;

        /** Earliest time any resource used by the train is reused by another one */
        public final double timeOfNextConflict;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Available available = (Available) o;
            return Double.compare(available.maximumDelay, maximumDelay) == 0
                    && Double.compare(available.timeOfNextConflict, timeOfNextConflict) == 0;
        }

        @Override
        public int hashCode() {
            return Objects.hashCode(maximumDelay, timeOfNextConflict);
        }

        public Available(double maximumDelay, double timeOfNextConflict) {
            this.maximumDelay = maximumDelay;
            this.timeOfNextConflict = timeOfNextConflict;
        }
    }

    /** The requested section isn't available yet */
    final class Unavailable extends Availability {
        /** Minimum delay to add to the departure time to avoid any conflict */
        public final double duration;

        /** Exact offset of the first conflict encountered. It's always the offset that marks either the border of an
         * unavailable section.
         * <br/>
         * It's either the offset where we start using a ressource before it's available,
         * or the offset where the train would have released a ressource it has kept for too long. */
        public final double firstConflictOffset;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Unavailable that = (Unavailable) o;
            return Double.compare(that.duration, duration) == 0
                    && Double.compare(that.firstConflictOffset, firstConflictOffset) == 0;
        }

        @Override
        public int hashCode() {
            return Objects.hashCode(duration, firstConflictOffset);
        }

        public Unavailable(double duration, double firstConflictOffset) {
            this.duration = duration;
            this.firstConflictOffset = firstConflictOffset;
        }
    }

    /** The availability of the requested section can't be determined,
     * the path needs to extend further. The availability depends
     * on the route taken by the train after the end of the given path. */
    final class NotEnoughLookahead extends Availability {}
}
