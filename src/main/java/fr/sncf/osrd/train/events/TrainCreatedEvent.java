package fr.sncf.osrd.train.events;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.train.Train;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class TrainCreatedEvent extends TimelineEvent {
    static final Logger logger = LoggerFactory.getLogger(TrainCreatedEvent.class);

    public final TrainSchedule schedule;

    private TrainCreatedEvent(TimelineEventId eventId, TrainSchedule schedule) {
        super(eventId);
        this.schedule = schedule;
    }

    @Override
    public String toString() {
        return String.format("TrainCreatedEvent { %s }", schedule.trainID);
    }

    @Override
    protected void onOccurrence(Simulation sim) throws SimulationError {
        var trainName = schedule.trainID;
        logger.info("starting train {}", trainName);

        Train.create(sim, schedule);
    }

    @Override
    protected void onCancellation(Simulation sim) throws SimulationError {
        throw new SimulationError("cancelling train creation isn't supported");
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(TimelineEvent other) {
        if (other.getClass() != TrainCreatedEvent.class)
            return false;
        var o = (TrainCreatedEvent) other;

        // This comparison will not work as expected (not a deep comparison)
        // If we need it someday we have to make train schedules deep comparable as well, which takes a lot of changes.
        return o.schedule == schedule;
    }

    /** Plan a TrainCreatedEvent creating a change that schedule it and return the created train */
    public static TrainCreatedEvent plan(Simulation sim, TrainSchedule schedule) {
        var change = new TrainCreationPlanned(sim, schedule);
        var event = change.apply(sim);
        sim.publishChange(change);
        return event;
    }

    public static class TrainCreationPlanned extends Simulation.TimelineEventCreated {
        public final TrainSchedule schedule;

        /** Plans the creation of some train */
        private TrainCreationPlanned(Simulation sim, TrainSchedule schedule) {
            super(sim, schedule.departureTime);
            this.schedule = schedule;
        }

        private TrainCreatedEvent apply(Simulation sim) {
            var event = new TrainCreatedEvent(eventId, schedule);
            super.scheduleEvent(sim, event);
            return event;
        }

        @Override
        public void replay(Simulation sim) {
            apply(sim);
        }

        @Override
        public String toString() {
            return String.format("TrainCreationPlanned { %s }", schedule.trainID);
        }
    }
}
