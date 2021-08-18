package fr.sncf.osrd.train.phases;

import java.util.ArrayList;
import java.util.List;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.Interaction;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.train.TrainSchedule;
import fr.sncf.osrd.train.TrainState;
import fr.sncf.osrd.train.TrainStop;
import fr.sncf.osrd.train.events.TrainMoveEvent;
import fr.sncf.osrd.utils.TrackSectionLocation;

public final class SignalNavigatePhase extends NavigatePhase {

    private SignalNavigatePhase(
            TrackSectionLocation startLocation,
            TrackSectionLocation endLocation,
            ArrayList<Interaction> interactionsPath,
            TrainPath expectedPath) {
        super(startLocation, endLocation, interactionsPath, expectedPath);
    }

    /** Create a new navigation phase from an already determined path */
    public static SignalNavigatePhase from(
            double driverSightDistance,
            TrackSectionLocation startLocation,
            TrackSectionLocation endLocation,
            TrainPath expectedPath,
            List<TrainStop> stops
    ) {
        if (stops == null)
            stops = new ArrayList<>();

        var actionPointPath = trackSectionToActionPointPath(driverSightDistance,
                expectedPath,
                startLocation,
                endLocation,
                expectedPath.trackSectionPath);
        addStopInteractions(actionPointPath, startLocation, endLocation, expectedPath, stops);
        return new SignalNavigatePhase(startLocation, endLocation, actionPointPath, expectedPath);
    }

    @Override
    public NavigatePhaseState getState(Simulation sim, TrainSchedule schedule) {
        return new State(this, sim, schedule);
    }

    public static final class State extends NavigatePhaseState {
        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(NavigatePhaseState other) {
            if (other.getClass() != State.class)
                return false;
            var o = (State) other;
            return o.phase == phase && o.interactionsPathIndex == interactionsPathIndex;
        }

        @Override
        public NavigatePhaseState clone() {
            return new SignalNavigatePhase.State(this);
        }

        State(SignalNavigatePhase phase, Simulation sim, TrainSchedule schedule) {
            super(phase, sim, schedule);
        }

        State(SignalNavigatePhase.State state) {
            super(state);
        }

        @Override
        public TimelineEvent simulate(Train train, TrainState trainState) throws SimulationError {
            // Check if we reached our goal
            if (hasPhaseEnded()) {
                return nextPhase(train, trainState);
            }

            // 1) find the next interaction event
            var nextInteraction = peekInteraction(trainState);

            // 2) If the action point can interact with the tail of the train add it to the interaction list
            addInteractionUnderTrain(trainState, nextInteraction);

            // 3) simulate up to nextEventTrackPosition
            var simulationResult = trainState.evolveStateUntilPosition(sim, nextInteraction.position);

            // 4) create an event with simulation data up to this point

            // The train reached the action point
            var event = reachedActionPoint(train, trainState, nextInteraction, simulationResult);
            if (event != null)
                return event;
            
            // The train didn't reached the action point (stopped because of signalisation)
            return TrainMoveEvent.plan(sim, trainState.time, train, simulationResult);
        }

        @Override
        public ArrayList<SpeedController> getSpeedControllers() {
            var controllers = new ArrayList<SpeedController>();
            for (var signalControllers : signalControllers.values())
                controllers.addAll(signalControllers);
            return controllers;
        }
    }
}