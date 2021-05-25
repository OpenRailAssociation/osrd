package fr.sncf.osrd.train.events;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.speedcontroller.SpeedControllerSet;
import fr.sncf.osrd.train.Train;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class TrainCreatedEvent extends TimelineEvent {
    static final Logger logger = LoggerFactory.getLogger(TrainCreatedEvent.class);

    public final TrainSchedule schedule;
    public final SpeedControllerSet controllers;

    private TrainCreatedEvent(TimelineEventId eventId, TrainSchedule schedule, SpeedControllerSet controllers) {
        super(eventId);
        this.schedule = schedule;
        this.controllers = controllers;
    }

    @Override
    protected void onOccurrence(Simulation sim) throws SimulationError {
        var trainName = schedule.trainID;
        logger.info("starting train {}", trainName);

        Train.create(sim, schedule, controllers);
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
        return o.schedule == schedule && controllers.equals(o.controllers);
    }

    /** Plan a TrainCreatedEvent creating a change that schedule it and return the created train */
    public static TrainCreatedEvent plan(Simulation sim, TrainSchedule schedule, SpeedControllerSet controllers) {
        var change = new TrainCreationPlanned(sim, schedule, controllers);
        var event = change.apply(sim);
        sim.publishChange(change);
        return event;
    }

    public static class TrainCreationPlanned extends Simulation.TimelineEventCreated {
        public final TrainSchedule schedule;
        public final SpeedControllerSet controllers;

        /** Plans the creation of some train */
        private TrainCreationPlanned(Simulation sim, TrainSchedule schedule, SpeedControllerSet controllers) {
            super(sim, schedule.departureTime);
            this.schedule = schedule;
            this.controllers = controllers;
        }

        private TrainCreatedEvent apply(Simulation sim) {
            var event = new TrainCreatedEvent(eventId, schedule, controllers);
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

    /** Plans to start a train from a given schedule */
    public static void plan(Simulation sim, TrainSchedule schedule) {

        // TODO read everything from config files
        var controllers = new SpeedControllerSet(sim, schedule);

        logger.trace(String.format("created initial speed controllers: %s", controllers));

        TrainCreatedEvent.plan(sim, schedule, controllers);
    }
}
