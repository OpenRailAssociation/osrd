package fr.sncf.osrd.train;

import static fr.sncf.osrd.simulation.Simulation.timeStep;

import java.util.*;
import fr.sncf.osrd.simulation.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.train.phases.NavigatePhase;
import fr.sncf.osrd.train.phases.NavigatePhaseState;
import fr.sncf.osrd.utils.DeepComparable;

public final class TrainState implements Cloneable, DeepComparable<TrainState> {
    static final Logger logger = LoggerFactory.getLogger(TrainState.class);

    // the time for which this state is relevant
    public double time;

    // the current speed of the train
    public double speed;

    // what status the train is in: reached destination, rolling, emergency, ...
    public TrainStatus status;

    public final transient TrainSchedule trainSchedule;
    public final int currentPhaseIndex;
    public final NavigatePhaseState currentPhaseState;

    // this field MUST be kept private, as it is not the position of the train at the current simulation time,
    // but rather the position of the train at the last event. it's fine and expected, but SpeedControllers need
    // the simulated location
    public final TrainPositionTracker location;

    public final ArrayDeque<Interaction> actionPointsUnderTrain;

    public TrainPath path;

    /** Index of the route the train is currently on in routePath */
    public int routeIndex;

    public int stopIndex;

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean deepEquals(TrainState o) {
        if (time != o.time)
            return false;
        if (speed != o.speed)
            return false;
        if (status != o.status)
            return false;
        if (routeIndex != o.routeIndex)
            return false;
        if (trainSchedule != o.trainSchedule)
            return false;
        if (currentPhaseIndex != o.currentPhaseIndex)
            return false;
        if (stopIndex != o.stopIndex)
            return false;
        if (!currentPhaseState.deepEquals(o.currentPhaseState))
            return false;
        if (!location.deepEquals(o.location))
            return false;
        return actionPointsUnderTrain.equals(o.actionPointsUnderTrain);
    }

    TrainState(
            double time,
            TrainPositionTracker location,
            double speed,
            TrainStatus status,
            TrainSchedule trainSchedule,
            int currentPhaseIndex,
            NavigatePhaseState currentPhaseState,
            ArrayDeque<Interaction> actionPointsUnderTrain,
            TrainPath path,
            int routeIndex,
            int stopIndex
    ) {
        this.time = time;
        this.location = location;
        this.speed = speed;
        this.status = status;
        this.trainSchedule = trainSchedule;
        this.currentPhaseIndex = currentPhaseIndex;
        this.currentPhaseState = currentPhaseState;
        this.actionPointsUnderTrain = actionPointsUnderTrain;
        trainSchedule.trainDecisionMaker.setTrainState(this);
        this.path = path;
        this.routeIndex = routeIndex;
        this.stopIndex = stopIndex;
    }

    /** Create a clone */
    @Override
    public TrainState clone() {
        return new TrainState(
                time,
                location.clone(),
                speed,
                status,
                trainSchedule,
                currentPhaseIndex,
                currentPhaseState.clone(),
                new ArrayDeque<>(actionPointsUnderTrain),
                new TrainPath(path),
                routeIndex,
                stopIndex
        );
    }

    /** Checks if the current phase is the last one */
    public boolean isDuringLastPhase() {
        return currentPhaseIndex == trainSchedule.phases.size() - 1;
    }

    /** Create a new TrainState pointing at the next phase */
    public TrainState nextPhase(Simulation sim, HashMap<Signal, ArrayList<SpeedController>> signalControllers) {
        if (isDuringLastPhase())
            return new TrainState(
                    time,
                    location.clone(),
                    speed,
                    TrainStatus.REACHED_DESTINATION,
                    trainSchedule,
                    currentPhaseIndex,
                    currentPhaseState,
                    new ArrayDeque<>(actionPointsUnderTrain),
                    new TrainPath(path),
                    routeIndex,
                    stopIndex);
        var nextPhase = currentPhaseIndex + 1;
        var nextPhaseState = trainSchedule.phases.get(nextPhase).getState(sim, trainSchedule);
        nextPhaseState.addAspectConstraints(signalControllers);
        return new TrainState(
                time,
                location.clone(),
                speed,
                status,
                trainSchedule,
                nextPhase,
                nextPhaseState,
                new ArrayDeque<>(actionPointsUnderTrain),
                new TrainPath(path),
                routeIndex,
                stopIndex
        );
    }

    /** Finds the action to reach the speed limit given at nextPosition at the next update */
    private Action findActionToReachTargetSpeedAtPosition(
            TrainPhysicsIntegrator integrator,
            boolean isLate,
            double nextPosition) {
        // get the list of active speed controllers
        var activeSpeedControllers = trainSchedule.trainDecisionMaker.getActiveSpeedControllers(isLate);

        // get the speed directive
        nextPosition = Double.min(nextPosition, trainSchedule.plannedPath.length);
        var speedDirective = new SpeedDirective(Double.POSITIVE_INFINITY);
        for (var controller : activeSpeedControllers)
            if (controller.isActive(nextPosition, stopIndex))
                speedDirective.mergeWith(controller.getDirective(nextPosition));

        // get the action the driver
        return trainSchedule.trainDecisionMaker.getNextAction(speedDirective, integrator);
    }

    /** Iteratively look for the next action to follow closely the indicated speeds.
     * At the next update, we want the train to be at the speed limit given at the position it will be */
    private Action iterateFindNextAction(TrainPhysicsIntegrator integrator,
                                         boolean isLate,
                                         double timeStep,
                                         double distanceStep) {
        var currentSpeed = this.speed;
        Action action = Action.coast();

        // We only need several iteration when going at low speed
        final var nIteration = speed > 2. ? 1 : 3;

        for (int i = 0; i < nIteration; i++) {
            var nextPosition = location.getPathPosition() + currentSpeed * timeStep;
            action = findActionToReachTargetSpeedAtPosition(integrator, isLate, nextPosition);
            var step = integrator.stepFromAction(action, distanceStep, 1);
            currentSpeed = step.finalSpeed;
        }
        return action;
    }


    private void step(
            Train.TrainStateChange locationChange,
            @SuppressWarnings("SameParameterValue") double timeStep,
            double distanceStep
    ) {
        if (timeStep <= 0 || distanceStep <= 0)
            return;

        var step = TrainPhysicsIntegrator.nextStep(
                location,
                speed,
                trainSchedule.rollingStock,
                timeStep,
                distanceStep + location.getPathPosition(),
                1,
                (integrator) -> {
                    var prevLocation = integrator.currentLocation.getPathPosition();
                    var isLate = trainSchedule.speedInstructions.secondsLate(prevLocation, time) > 0;
                    var activeSpeedControllers = trainSchedule.trainDecisionMaker.getActiveSpeedControllers(isLate);
                    locationChange.speedControllersUpdates.dedupAdd(prevLocation, activeSpeedControllers);
                    var action = iterateFindNextAction(integrator, isLate, timeStep, distanceStep);
                    return action;
                });

        // update location
        location.updatePosition(trainSchedule.rollingStock.length, step.positionDelta);
        this.time += step.timeDelta;
        var newLocation = location.getPathPosition();

        logger.trace("speed changed from {} to {}", speed, step.finalSpeed);
        locationChange.positionUpdates.addSpeedUpdate(newLocation, time, step.finalSpeed);
        speed = step.finalSpeed;
    }

    /**  Create a location change from the current state to the given position.
     * If the train stops during the simulation then the function returns its new state where it stopped. */
    public Train.TrainStateChange evolveStateUntilPosition(
            Simulation sim,
            double goalPathPosition
    ) throws SimulationError {

        var locationChange = new Train.TrainStateChange(sim, trainSchedule.trainID, this);

        for (int i = 0; location.getPathPosition() < goalPathPosition; i++) {
            if (i >= 10000 / timeStep)
                throw new SimulationError("train physics numerical integration doesn't seem to stop");
            var distanceStep = goalPathPosition - location.getPathPosition();
            step(locationChange, timeStep, distanceStep);
            // Stop the evolution if the train has stopped
            if (speed < 0.0000001)
                break;
        }

        return locationChange;
    }

    /**  Create a location change from the current state to current simulation time */
    public Train.TrainStateChange evolveStateUntilNow(Simulation sim) {
        return evolveStateUntilTime(sim, sim.getTime());
    }

    /**  Create a location change from the current state to the given time */
    public Train.TrainStateChange evolveStateUntilTime(Simulation sim, double targetTime) {
        var locationChange = new Train.TrainStateChange(sim, trainSchedule.trainID, this);

        while (this.time + timeStep < targetTime)
            step(locationChange, timeStep, Double.POSITIVE_INFINITY);
        step(locationChange, targetTime - this.time, Double.POSITIVE_INFINITY);

        return locationChange;
    }

    /**  Create a location change from the current state to the minimum of given time and pathPosition */
    public Train.TrainStateChange evolveStateUntilTimeOrPosition(
            Simulation sim,
            double targetTime,
            double goalPathPosition
    ) {
        var locationChange = new Train.TrainStateChange(sim, trainSchedule.trainID, this);

        while (location.getPathPosition() < goalPathPosition && this.time + 1.0 < targetTime) {
            var distanceStep = goalPathPosition - location.getPathPosition();
            step(locationChange, timeStep, distanceStep);
        }

        // If the position goal has not been reached, 
        // there may be one step of less than one second left to complete
        if (location.getPathPosition() < goalPathPosition) {
            var distanceStep = goalPathPosition - location.getPathPosition();
            step(locationChange, targetTime - this.time, distanceStep);
        }

        return locationChange;
    }

    public TrainEvolutionEvent simulatePhase(Train train, Simulation sim) throws SimulationError {
        return trainSchedule.trainDecisionMaker.simulatePhase(train, sim);
    }

    /** Add or update aspects constraint of a signal */
    public void setAspectConstraints(SignalState signalState) {
        currentPhaseState.setAspectConstraints(signalState, this);
    }

    /** Occupy and free tvd sections given a detector the train is interacting with. */
    public void updateTVDSections(
            Simulation sim,
            Detector detector,
            InteractionType interactionType
    ) throws SimulationError {
        // Update route index
        var currentRoute = path.routePath.get(routeIndex);
        var tvdSectionPathIndex = currentRoute.tvdSectionsPaths.size() - 1;
        var lastTvdSectionPath = currentRoute.tvdSectionsPaths.get(tvdSectionPathIndex);
        if (lastTvdSectionPath.endWaypoint == detector)
            routeIndex++;

        // Occupy the next tvdSection
        if (interactionType == InteractionType.HEAD) {
            var forwardTVDSectionPath = path.findForwardTVDSection(detector);
            var nextTVDSection = sim.infraState.getTvdSectionState(forwardTVDSectionPath.index);
            nextTVDSection.occupy(sim);
        } else { // Unoccupy the last tvdSection
            var backwardTVDSectionPath = path.findBackwardTVDSection(detector);
            var backwardTVDSection = sim.infraState.getTvdSectionState(backwardTVDSectionPath.index);
            backwardTVDSection.unoccupy(sim);
        }
    }

    /**
     * Return the next phase
     */
    public NavigatePhase getNextPhase() {
        if (isDuringLastPhase()) {
            return null;
        }
        return trainSchedule.phases.get(currentPhaseIndex + 1);
    }

    public static final class TrainDisappearChange extends EntityChange<TrainState, Void> {
        public final String trainID;

        TrainDisappearChange(Simulation sim, TrainState entity) {
            super(sim);
            trainID = entity.trainSchedule.trainID;
        }

        @Override
        public Void apply(Simulation sim, TrainState entity) {
            entity.status = TrainStatus.REACHED_DESTINATION;
            return null;
        }

        @Override
        public TrainState getEntity(Simulation sim) {
            return sim.trains.get(trainID).getLastState();
        }

        @Override
        public String toString() {
            return String.format(
                    "TrainDisappearChange { the train %s disappears }", trainID);
        }
    }
}
