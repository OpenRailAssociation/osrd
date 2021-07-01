package fr.sncf.osrd.train.events;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.simulation.TimelineEventId;
import fr.sncf.osrd.train.Train;

public final class TrainRestarts extends TimelineEvent {
    public final Train train;
    public final Train.TrainStateChange stateChange;

    /** Creates a state train state change timeline event */
    private TrainRestarts(TimelineEventId eventId, Train train, Train.TrainStateChange stateChange) {
        super(eventId);
        this.train = train;
        this.stateChange = stateChange;
    }

    @Override
    protected void onOccurrence(Simulation sim) throws SimulationError {
        stateChange.apply(sim, train);
        sim.publishChange(stateChange);
        train.onEventOccurred(sim);
        train.scheduleStateChange(sim);
    }

    @Override
    protected void onCancellation(Simulation sim) throws SimulationError {
        throw new SimulationError("cancellation of TrainChangedState not supported yet");
    }

    /** Plan a move to an action point */
    public static TrainRestarts plan(
            Simulation sim,
            double actionTime,
            Train train,
            Train.TrainStateChange stateChange
    ) {
        var change = new TrainPlannedRestart(sim, actionTime, train.getName(), stateChange);
        var event = change.apply(sim, train);
        sim.publishChange(change);
        return event;
    }

    public static class TrainPlannedRestart extends Simulation.TimelineEventCreated {
        public final String trainId;
        public final Train.TrainStateChange stateChange;

        TrainPlannedRestart(
                Simulation sim,
                double actionTime,
                String trainId,
                Train.TrainStateChange stateChange
        ) {
            super(sim, actionTime);
            this.trainId = trainId;
            this.stateChange = stateChange;
        }

        private TrainRestarts apply(Simulation sim, Train train) {
            var event = new TrainRestarts(eventId, train, stateChange);
            super.scheduleEvent(sim, event);
            return event;
        }

        @Override
        public void replay(Simulation sim) {
            apply(sim, sim.trains.get(trainId));
        }

        @Override
        public String toString() {
            return String.format("TrainPlannedRestart { eventId=%s, trainId=%s }", eventId, trainId);
        }
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(TimelineEvent other) {
        if (other.getClass() != TrainRestarts.class)
            return false;
        var o = (TrainRestarts) other;
        return train.getName().equals(o.train.getName())
                && o.stateChange.deepEquals(stateChange);
    }
}