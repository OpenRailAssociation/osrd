package fr.sncf.osrd.cbtc;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.simulation.TimelineEventId;
import fr.sncf.osrd.train.Train;

/**
 * This event triggers the update of the position of a train.
 */
public class CBTCEvent extends TimelineEvent {

    private final Train train;

    /**
     * Create a new CBTC event for the given train at the given time.
     * @param eventId the TimelineEventId of the Event
     * @param train the train for wich we want to update position
     */
    public CBTCEvent(TimelineEventId eventId, Train train) {
        super(eventId);
        this.train = train;
    }

    /**
     * Plan a new CBTC event at the given time for the given train.
     * @param sim the current simulation
     * @param scheduledTime the time at which the event is scheduled.
     * @param train the train for wich we want to update position
     * @return A new CBTC event.
     */
    public static CBTCEvent plan(Simulation sim, double scheduledTime, Train train) {
        var change = new CBTCEventPlanned(sim, scheduledTime, train);
        var event = change.apply(sim);
        sim.publishChange(change);
        return event;
    }

    @Override
    protected void onOccurrence(Simulation sim) throws SimulationError {
        train.scheduleStateChange(sim);
    }

    @Override
    protected void onCancellation(Simulation sim) throws SimulationError {
    }

    @Override
    public boolean deepEquals(TimelineEvent other) {
        if (!(other instanceof CBTCEvent))
            return false;
        boolean sameTrain = (train == ((CBTCEvent) other).train);
        boolean sameScheduledTime = (eventId.scheduledTime == other.eventId.scheduledTime);
        return sameTrain && sameScheduledTime;
    }

    /**
     * CBTC event planner.
     */
    public static class CBTCEventPlanned extends Simulation.TimelineEventCreated {

        private final Train train;

        protected CBTCEventPlanned(Simulation sim, double scheduledTime, Train train) {
            super(sim, scheduledTime);
            this.train = train;
        }

        /**
         * Create a new CBTC event and schedule it in the simulation.
         * @param sim the current simulation
         * @return The created event.
         */
        private CBTCEvent apply(Simulation sim) {
            CBTCEvent event = new CBTCEvent(eventId, train);
            super.scheduleEvent(sim, event);
            return event;
        }

        @Override
        public void replay(Simulation sim) {
            apply(sim);
        }

        @Override
        public String toString() {
            return String.format(
                    "CBTCEventPlanned { trainId=%s - scheduledTime=%f}",
                    train.getID(),
                    eventId.scheduledTime
                );
        }
    }
}