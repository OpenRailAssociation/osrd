package fr.sncf.osrd.train.decisions;

import fr.sncf.osrd.DebugViewer;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.simulation.TimelineEventId;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.events.TrainMoveEvent;

import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;

public class KeyboardInput extends TrainDecisionMaker implements KeyListener {

    private boolean accelerating = false;
    private boolean braking = false;
    private boolean quit = false;
    private final double dt;

    public KeyboardInput(double dt) {
        this.dt = dt;
        if (DebugViewer.instance == null)
            throw new RuntimeException("Can't use KeyboardInput without a DebugViewer");
        DebugViewer.instance.addKeyListener(this);
    }

    @Override
    protected Action makeDecision(SpeedDirective directive, TrainPhysicsIntegrator integrator) {
        if (accelerating && !braking)
            return Action.accelerate(trainState.trainSchedule.rollingStock.getMaxEffort(trainState.speed));
        if (!accelerating && braking)
            return Action.brake(integrator.getMaxBrakingForce(trainState.trainSchedule.rollingStock));
        return Action.coast();
    }

    @Override
    public TimelineEvent simulatePhase(Train train, Simulation sim) {
        double nextTime = sim.getTime() + dt;
        var simulationResult = trainState.evolveStateUntilTime(sim, nextTime);
        if (!quit)
            CheckInputEvent.plan(sim, nextTime, this, train);
        return TrainMoveEvent.plan(sim, nextTime, train, simulationResult);
    }

    @Override
    public void keyTyped(KeyEvent e) {}

    @Override
    public void keyPressed(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.VK_UP)
            accelerating = true;
        else if (e.getKeyCode() == KeyEvent.VK_DOWN)
            braking = true;
        else if (e.getKeyCode() == KeyEvent.VK_ESCAPE)
            quit = true;
    }

    @Override
    public void keyReleased(KeyEvent e) {
        if (e.getKeyCode() == KeyEvent.VK_UP)
            accelerating = false;
        else if (e.getKeyCode() == KeyEvent.VK_DOWN)
            braking = false;
    }

    public static class CheckInputEvent extends TimelineEvent {

        private final KeyboardInput keyboardInput;
        private final Train train;

        public static CheckInputEvent plan(Simulation sim, double time, KeyboardInput keyboardInput, Train train) {
            var change = new CheckInputEventPlanned(sim, time, keyboardInput, train);
            var event = change.apply(sim);
            sim.publishChange(change);
            return event;
        }

        public CheckInputEvent(TimelineEventId eventId, KeyboardInput keyboardInput, Train train) {
            super(eventId);
            this.keyboardInput = keyboardInput;
            this.train = train;
        }

        @Override
        protected void onOccurrence(Simulation sim) throws SimulationError {
            keyboardInput.simulatePhase(train, sim);
        }

        @Override
        protected void onCancellation(Simulation sim) throws SimulationError {}

        @Override
        public boolean deepEquals(TimelineEvent other) {
            if (!(other instanceof CheckInputEvent))
                return false;
            return keyboardInput == ((CheckInputEvent) other).keyboardInput;
        }

        public static class CheckInputEventPlanned extends Simulation.TimelineEventCreated {

            private final KeyboardInput keyboardInput;
            private final Train train;

            protected CheckInputEventPlanned(Simulation sim, double scheduledTime, KeyboardInput keyboardInput, Train train) {
                super(sim, scheduledTime);
                this.keyboardInput = keyboardInput;
                this.train = train;
            }

            private CheckInputEvent apply(Simulation sim) {
                var event = new CheckInputEvent(eventId, keyboardInput, train);
                super.scheduleEvent(sim, event);
                return event;
            }

            @Override
            public void replay(Simulation sim) {
                apply(sim);
            }

            @Override
            public String toString() {
                return String.format("CheckInputEventPlanned { keyboardInput=%s }", keyboardInput);
            }
        }
    };
}
