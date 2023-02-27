package fr.sncf.osrd.stdcm.preprocessing.interfaces;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.train.TrainStop;
import java.util.List;

/** Abstract interface used to request the availability of path sections */
public interface RouteAvailabilityInterface {

    /** Request availability information about a section of the path.
     * <br/>
     * Can return either an instance of either type:
     * <ul>
     * <li>AvailableUntil: the section is available until the given time (which may be +inf) </li>
     * <li>UnavailableUntil: the section isn't available until the given time </li>
     * <li>NotEnoughLookahead: the train path needs to extend further, it depends on a directional choice </li>
     * </ul>
     *
     * @param path Path taken by the train
     * @param startOffset Start of the section to check for availability
     * @param endOffset End of the section to check for availability
     * @param envelope Envelope describing the position of the train at any moment.
     *                 Must be exactly `(endOffset - startOffset) long.
     * @param startTime Time at which the train is at `startOffset`.
     * @param stops Planned stops
     * @return An Availability instance.
     */
    Availability getAvailability(
            TrainPath path,
            double startOffset,
            double endOffset,
            Envelope envelope,
            double startTime,
            List<TrainStop> stops
    );

    /** Represents the availability of the requested section */
    abstract sealed class Availability
        permits AvailableFor, UnavailableFor, NotEnoughLookahead
    {}

    /** The requested section is available until the given time, in seconds. */
    final class AvailableFor extends Availability {
        public final double duration;

        /** Constructor */
        public AvailableFor(double duration) {
            this.duration = duration;
        }
    }

    /** The requested section isn't available, but will be starting from the given time */
    final class UnavailableFor extends Availability {
        public final double duration;

        /** Constructor */
        public UnavailableFor(double duration) {
            this.duration = duration;
        }
    }

    /** The availability of the requested section can't be determined,
     * the path needs to extend further. The availability depends
     * on the next routes taken by the train. */
    final class NotEnoughLookahead extends Availability {}
}
