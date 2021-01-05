package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.simulation.TrainLocationChange;
import fr.sncf.osrd.simulation.utils.Simulation;
import fr.sncf.osrd.simulation.utils.SimulationError;
import fr.sncf.osrd.simulation.utils.TimelineEvent;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.util.Pair;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.stream.Collectors;

public class TrainState {
    static final Logger logger = LoggerFactory.getLogger(TrainState.class);

    // the time for which this state is relevant
    public double time;

    // this field MUST be kept private, as it is not the position of the train at the current simulation time,
    // but rather the position of the train at the last event. it's fine and expected, but SpeedControllers need
    // the simulated location
    public TrainPositionTracker location;

    public double speed;
    public TrainStatus status;
    public LinkedList<SpeedController> controllers;

    public final Train train;

    TrainState(
            double time,
            TrainPositionTracker location,
            double speed,
            TrainStatus status,
            LinkedList<SpeedController> controllers,
            Train train
    ) {
        this.time = time;
        this.location = location;
        this.speed = speed;
        this.status = status;
        this.controllers = controllers;
        this.train = train;
    }

    protected TrainState clone() {
        return new TrainState(
                time,
                location.clone(),
                speed,
                status,
                new LinkedList<>(controllers),
                train);
    }

    private TrainPhysicsSimulator.PositionUpdate step(double timeStep) {
        // TODO: find out the actual max braking / acceleration force

        var simulator = TrainPhysicsSimulator.make(
                timeStep,
                train.rollingStock,
                speed,
                location.maxTrainGrade());

        Action action = getAction(location, simulator);
        logger.debug("train took action {}", action);

        assert action != null;

        var update = simulator.computeUpdate(action.tractionForce(), action.brakingForce());
        // TODO: handle emergency braking

        logger.debug("speed changed from {} to {}", speed, update.speed);
        speed = update.speed;
        location.updatePosition(update.positionDelta);
        return update;
    }

    private TrainLocationChange computeSpeedCurve(
            double goalTrackPosition
    ) throws SimulationError {
        var nextState = this.clone();
        var positionUpdates = new ArrayList<TrainPhysicsSimulator.PositionUpdate>();

        int i = 0;
        while (nextState.location.getHeadPathPosition() < goalTrackPosition) {
            if (nextState.location.hasReachedGoal())
                break;

            var update = nextState.step(1.0);
            positionUpdates.add(update);
            i++;
            if (i >= 10000)
                throw new SimulationError("simulation did not end");
        }

        return new TrainLocationChange(nextState, positionUpdates);
    }

    private Action getAction(TrainPositionTracker location, TrainPhysicsSimulator trainPhysics) {
        switch (status) {
            case STARTING_UP:
            case STOP:
            case ROLLING:
                return updateRolling(location, trainPhysics);
            case EMERGENCY_BRAKING:
            case REACHED_DESTINATION:
                return null;
            default:
                throw new RuntimeException("Invalid train state");
        }
    }

    private Action updateRolling(TrainPositionTracker position, TrainPhysicsSimulator trainPhysics) {
        var actions = controllers.stream()
                .map(sp -> new Pair<>(sp, sp.getAction(this, position, trainPhysics)))
                .collect(Collectors.toList());

        var action = actions.stream()
                .map(pair -> pair.second)
                .filter(curAction -> curAction.type != Action.ActionType.NO_ACTION)
                .min(Action::compareTo);
        assert action.isPresent();

        var toDelete = actions.stream()
                .filter(pair -> pair.second.deleteController)
                .map(pair -> pair.first)
                .collect(Collectors.toList());
        controllers.removeAll(toDelete);

        return action.get();
    }


    TimelineEvent<TrainLocationChange> simulateUntilEvent(Simulation sim) throws SimulationError {
        // 1) find the next event position

        // look for objects in the range [train_position, +inf)
        // TODO: optimize, we don't need to iterate on all the path
        var nextTrackObjectVisibilityChange = location
                .streamPointAttrForward(Double.POSITIVE_INFINITY, TopoEdge::getVisibleTrackObjects)
                .map(pointValue -> {
                    // the position of track object relative to path of the train
                    // (the distance to the train's starting point)
                    var pathObjectPosition = pointValue.position;
                    var sightDistance = Math.min(train.driverSightDistance, pointValue.value.getSightDistance());
                    // return the path position at which the object becomes visible
                    return pathObjectPosition - sightDistance;
                })
                .min(Double::compareTo)
                // TODO: that's pretty meh
                .orElse(Double.POSITIVE_INFINITY);

        // for now, we only handle visible track objects
        var nextEventTrackPosition = nextTrackObjectVisibilityChange;

        // 2) simulate up to nextEventTrackPosition
        var simulationResult = computeSpeedCurve(nextEventTrackPosition);
        var simulationElapsedTime = simulationResult.positionUpdates.stream()
                .map(update -> update.timeDelta)
                .reduce(Double::sum)
                .orElse(0.0);
        var simulationTime = sim.getTime() + simulationElapsedTime;

        // 3) create an event with simulation data up to this point
        return train.event(sim, simulationTime, simulationResult);
    }

    @SuppressFBWarnings(value = "UPM_UNCALLED_PRIVATE_METHOD")
    private double getMaxAcceleration() {
        if (status == TrainStatus.STARTING_UP)
            return train.rollingStock.startUpAcceleration;
        return train.rollingStock.comfortAcceleration;
    }
}
