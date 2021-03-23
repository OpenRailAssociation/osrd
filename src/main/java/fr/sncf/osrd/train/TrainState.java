package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.train.phases.PhaseState;
import fr.sncf.osrd.utils.DeepComparable;
import fr.sncf.osrd.utils.PointValue;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

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
    public final PhaseState currentPhaseState;

    // this field MUST be kept private, as it is not the position of the train at the current simulation time,
    // but rather the position of the train at the last event. it's fine and expected, but SpeedControllers need
    // the simulated location
    public final TrainPositionTracker location;

    public final transient List<SpeedController> speedControllers;

    public final ArrayDeque<PointValue<ActionPoint>> actionPointsUnderTrain;

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean deepEquals(TrainState o) {
        if (time != o.time)
            return false;
        if (speed != o.speed)
            return false;
        if (status != o.status)
            return false;
        if (trainSchedule != o.trainSchedule)
            return false;
        if (currentPhaseIndex != o.currentPhaseIndex)
            return false;
        if (!currentPhaseState.deepEquals(o.currentPhaseState))
            return false;
        if (!location.deepEquals(o.location))
            return false;
        if (!speedControllers.equals(o.speedControllers))
            return false;
        return actionPointsUnderTrain.equals(o.actionPointsUnderTrain);
    }

    TrainState(
            double time,
            TrainPositionTracker location,
            double speed,
            TrainStatus status,
            List<SpeedController> speedControllers,
            TrainSchedule trainSchedule,
            int currentPhaseIndex,
            PhaseState currentPhaseState,
            ArrayDeque<PointValue<ActionPoint>> actionPointsUnderTrain
    ) {
        this.time = time;
        this.location = location;
        this.speed = speed;
        this.status = status;
        this.speedControllers = speedControllers;
        this.trainSchedule = trainSchedule;
        this.currentPhaseIndex = currentPhaseIndex;
        this.currentPhaseState = currentPhaseState;
        this.actionPointsUnderTrain = actionPointsUnderTrain;
    }

    /** Create a clone */
    @Override
    public TrainState clone() {
        return new TrainState(
                time,
                location.clone(),
                speed,
                status,
                new ArrayList<>(speedControllers),
                trainSchedule,
                currentPhaseIndex,
                currentPhaseState,
                new ArrayDeque<>(actionPointsUnderTrain)
        );
    }

    /** Create a new TrainState pointing at the next phase */
    public TrainState nextPhase() {
        var nextPhase = currentPhaseIndex + 1;

        if (nextPhase == trainSchedule.phases.size())
            return new TrainState(
                    time,
                    location.clone(),
                    speed,
                    TrainStatus.REACHED_DESTINATION,
                    new ArrayList<>(speedControllers),
                    trainSchedule,
                    currentPhaseIndex,
                    currentPhaseState,
                    new ArrayDeque<>(actionPointsUnderTrain)
                    );

        var nextPhaseState = trainSchedule.phases.get(nextPhase).getState();
        return new TrainState(
                time,
                location.clone(),
                speed,
                status,
                new ArrayList<>(speedControllers),
                trainSchedule,
                nextPhase,
                nextPhaseState,
                new ArrayDeque<>(actionPointsUnderTrain)
        );
    }

    private void step(
            Train.TrainStateChange locationChange,
            @SuppressWarnings("SameParameterValue") double timeStep
    ) {

        // TODO: find out the actual max braking / acceleration force

        var rollingStock = trainSchedule.rollingStock;
        var integrator = TrainPhysicsIntegrator.make(
                timeStep,
                rollingStock,
                speed,
                location.maxTrainGrade());

        var prevLocation = location.getPathPosition();

        // get the list of active speed controllers
        var activeSpeedControllers = getActiveSpeedControllers();
        locationChange.speedControllersUpdates.dedupAdd(prevLocation, activeSpeedControllers);

        // get the current speed directives mandated by the speed controllers
        var speedDirective = SpeedController.getDirective(activeSpeedControllers, prevLocation);
        locationChange.speedDirectivesUpdates.dedupAdd(prevLocation, speedDirective);

        // get the action the driver
        Action action = driverDecision(speedDirective, integrator);

        logger.trace("train took action {}", action);
        assert action != null;
        assert action.type != Action.ActionType.EMERGENCY_BRAKING;

        // compute and limit the traction force
        var traction = action.tractionForce();

        // compute and limit the braking force
        var brakingForce = action.brakingForce();

        // run the physics sim
        var update = integrator.computeUpdate(traction, brakingForce);

        // update location
        location.updatePosition(rollingStock.length, update.positionDelta);
        this.time += update.timeDelta;
        var newLocation = location.getPathPosition();

        logger.trace("speed changed from {} to {}", speed, update.speed);
        locationChange.positionUpdates.addSpeedUpdate(newLocation, time, update.speed);
        speed = update.speed;
    }

    /**  Create a location change from the current state to the given position */
    public Train.TrainStateChange evolveState(
            Simulation sim,
            double goalPathPosition
    ) throws SimulationError {

        var locationChange = new Train.TrainStateChange(sim, trainSchedule.trainID, this);

        for (int i = 0; location.getPathPosition() < goalPathPosition; i++) {
            if (i >= 10000)
                throw new SimulationError("train physics numerical integration doesn't seem to stop");
            step(locationChange, 1.0);
        }

        return locationChange;
    }

    private SpeedController[] getActiveSpeedControllers() {
        var activeControllers = new ArrayList<SpeedController>();
        for (var controller : speedControllers) {
            if (!controller.isActive(this))
                continue;

            activeControllers.add(controller);
        }
        return activeControllers.toArray(new SpeedController[0]);
    }

    private Action driverDecision(SpeedDirective directive, TrainPhysicsIntegrator integrator) {
        var rollingStock = trainSchedule.rollingStock;
        return integrator.actionToTargetSpeed(directive.allowedSpeed, rollingStock);
    }

    void scheduleStateChange(Train train, Simulation sim) throws SimulationError {
        currentPhaseState.simulate(sim, train, this);
    }

    @SuppressFBWarnings({"UPM_UNCALLED_PRIVATE_METHOD"})
    private double getMaxAcceleration() {
        if (status == TrainStatus.STARTING_UP)
            return trainSchedule.rollingStock.startUpAcceleration;
        return trainSchedule.rollingStock.comfortAcceleration;
    }
}
