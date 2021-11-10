package fr.sncf.osrd.train.decisions;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.simulation.TimelineEventId;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.events.TrainMoveEvent;


public abstract class InteractiveInput extends TrainDecisionMaker {

    protected boolean quit = false;
    private final double dt;

    public InteractiveInput(double dt) {
        this.dt = dt;
    }

    @Override
    public TrainMoveEvent simulatePhase(Train train, Simulation sim) {
        double nextTime = sim.getTime() + dt;
        var simulationResult = trainState.evolveStateUntilTime(sim, nextTime);
        if (!quit)
            CheckInputEvent.plan(sim, nextTime, this, train);
        return TrainMoveEvent.plan(sim, nextTime, train, simulationResult);
    }

    public static class CheckInputEvent extends TimelineEvent {

        private final InteractiveInput input;
        private final Train train;

        /** Plan a check input event */
        public static CheckInputEvent plan(Simulation sim, double time, InteractiveInput input, Train train) {
            var change = new CheckInputEventPlanned(sim, time, input, train);
            var event = change.apply(sim);
            sim.publishChange(change);
            return event;
        }

        /** Create a check input event */
        public CheckInputEvent(TimelineEventId eventId, InteractiveInput input, Train train) {
            super(eventId);
            this.input = input;
            this.train = train;
        }

        @Override
        protected void onOccurrence(Simulation sim) throws SimulationError {
            input.simulatePhase(train, sim);
        }

        @Override
        protected void onCancellation(Simulation sim) throws SimulationError {}

        @Override
        public boolean deepEquals(TimelineEvent other) {
            if (!(other instanceof CheckInputEvent))
                return false;
            return input == ((CheckInputEvent) other).input;
        }

        public static class CheckInputEventPlanned extends Simulation.TimelineEventCreated {

            private final InteractiveInput input;
            private final Train train;

            protected CheckInputEventPlanned(Simulation sim, double scheduledTime,
                                             InteractiveInput input, Train train) {
                super(sim, scheduledTime);
                this.input = input;
                this.train = train;
            }

            private CheckInputEvent apply(Simulation sim) {
                var event = new CheckInputEvent(eventId, input, train);
                super.scheduleEvent(sim, event);
                return event;
            }

            @Override
            public void replay(Simulation sim) {
                apply(sim);
            }

            @Override
            public String toString() {
                return String.format("CheckInputEventPlanned { input=%s }", input);
            }
        }
    }
}
