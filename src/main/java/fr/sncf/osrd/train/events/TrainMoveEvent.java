package fr.sncf.osrd.train.events;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.simulation.TimelineEventId;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainEvolutionEvent;

/**
 * This event represents a regular train move.
 * Use this event when you want to move a train without interacting with an action point.
 */
public final class TrainMoveEvent extends TrainEvolutionEvent {
    public final Train train;
    public final Train.TrainStateChange trainStateChange;

    /** Create a train move event */
    private TrainMoveEvent(
            TimelineEventId eventId,
            Train train,
            Train.TrainStateChange trainStateChange
    ) {
        super(eventId);
        this.train = train;
        this.trainStateChange = trainStateChange;
    }

    @Override
    protected void onOccurrence(Simulation sim) throws SimulationError {
        // Apply StateChange
        var stateChange = trainStateChange;
        stateChange.apply(sim, train);
        sim.publishChange(stateChange);

        // Notify train that an event occurred
        train.onEventOccurred(sim);
    }

    @Override
    protected void onCancellation(Simulation sim) {}

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(TimelineEvent other) {
        if (other.getClass() != TrainMoveEvent.class)
            return false;
        var o = (TrainMoveEvent) other;
        return o.train.getID().equals(train.getID())
                && o.trainStateChange.deepEquals(trainStateChange);
    }

    /** Plan a move to an action point */
    public static TrainMoveEvent plan(
            Simulation sim,
            double actionTime,
            Train train,
            Train.TrainStateChange trainStateChange
    ) {
        var change = new TrainPlannedMove(sim, actionTime, train.getID(), trainStateChange);
        var event = change.apply(sim, train);
        sim.publishChange(change);
        return event;
    }

    @Override
    public Double interpolatePosition(double time) {
        return trainStateChange.interpolatePosition(time);
    }

    public static class TrainPlannedMove extends Simulation.TimelineEventCreated {
        public final String trainId;
        public final Train.TrainStateChange stateChange;

        private TrainPlannedMove(
                Simulation sim,
                double actionTime,
                String trainId,
                Train.TrainStateChange stateChange
        ) {
            super(sim, actionTime);
            this.trainId = trainId;
            this.stateChange = stateChange;
        }

        private TrainMoveEvent apply(Simulation sim, Train train) {
            var event = new TrainMoveEvent(eventId, train, stateChange);
            super.scheduleEvent(sim, event);
            return event;
        }

        @Override
        public void replay(Simulation sim) {
            apply(sim, sim.trains.get(trainId));
        }

        @Override
        public String toString() {
            return String.format("TrainPlannedMove { eventId=%s, trainId=%s }", eventId, trainId);
        }
    }
}