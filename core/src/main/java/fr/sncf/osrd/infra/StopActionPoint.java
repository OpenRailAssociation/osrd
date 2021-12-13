package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.InteractionTypeSet;
import fr.sncf.osrd.train.Train;

public class StopActionPoint implements ActionPoint {
    public final int stopIndex;
    private final double duration;

    public StopActionPoint(int stopIndex, double duration) {
        this.stopIndex = stopIndex;
        this.duration = duration;
    }

    @Override
    public InteractionTypeSet getInteractionsType() {
        return new InteractionTypeSet(new InteractionType[]{InteractionType.HEAD});
    }

    @Override
    public double getSightDistance() {
        return 0;
    }

    @Override
    public String toString() {
        return String.format("StopActionPoint { index=%d }", stopIndex);
    }

    @Override
    public void interact(Simulation sim, Train train, InteractionType interactionType) throws SimulationError {
        var time = sim.getTime();
        if (duration > 0)
            time += duration;
        train.stopUntil(sim, time, stopIndex);
    }

    public static class RestartTrainEvent extends TimelineEvent {
        private final Train train;

        /** Plan a restart event */
        public static RestartTrainEvent plan(Simulation sim, double time, Train train, int stopIndex) {
            var change = new RestartTrainPlanned(sim, time, train, stopIndex);
            var event = change.apply(sim);
            sim.publishChange(change);
            return event;
        }

        /** Create a restart event */
        public RestartTrainEvent(TimelineEventId eventId, Train train) {
            super(eventId);
            this.train = train;
        }

        @Override
        protected void onOccurrence(Simulation sim) throws SimulationError {
            train.restart(sim);
        }

        @Override
        protected void onCancellation(Simulation sim) throws SimulationError {}

        @Override
        public boolean deepEquals(TimelineEvent other) {
            if (!(other instanceof RestartTrainEvent))
                return false;
            return train.getID().equals(((RestartTrainEvent) other).train.getID());
        }

        public static class RestartTrainPlanned extends Simulation.TimelineEventCreated {

            public final Train train;
            public final int stopIndex;

            protected RestartTrainPlanned(Simulation sim, double scheduledTime, Train train, int stopIndex) {
                super(sim, scheduledTime);
                this.train = train;
                this.stopIndex = stopIndex;
            }

            private RestartTrainEvent apply(Simulation sim) {
                var event = new RestartTrainEvent(eventId, train);
                super.scheduleEvent(sim, event);
                return event;
            }

            @Override
            public void replay(Simulation sim) {
                apply(sim);
            }

            @Override
            public String toString() {
                return String.format("RestartTrainPlanned { train=%s, stop_index=%s }", train.getID(), stopIndex);
            }
        }
    }
}
