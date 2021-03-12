package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.Simulation.TimelineEventCreated;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.timetable.TrainSchedule;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class TrainState {
    static final Logger logger = LoggerFactory.getLogger(TrainState.class);

    // the time for which this state is relevant
    public double time;

    // the current speed of the train
    public double speed;

    // what state the train is in: reached destination, rolling, emergency, ...
    public TrainStatus status;

    // the train this is the state of
    public final transient TrainSchedule trainSchedule;

    // this field MUST be kept private, as it is not the position of the train at the current simulation time,
    // but rather the position of the train at the last event. it's fine and expected, but SpeedControllers need
    // the simulated location
    public final TrainPositionTracker location;

    public final transient List<SpeedController> speedControllers;

    @Override
    @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (obj.getClass() != TrainState.class)
            return false;

        var otherState = (TrainState) obj;
        if (this.time != otherState.time)
            return false;
        if (this.speed != otherState.speed)
            return false;
        if (this.status != otherState.status)
            return false;
        if (!this.trainSchedule.trainID.equals(otherState.trainSchedule.trainID))
            return false;
        if (!this.location.equals(otherState.location))
            return false;
        return this.speedControllers.equals(otherState.speedControllers);
    }

    @Override
    public int hashCode() {
        return Objects.hash(time, speed, status, trainSchedule.trainID, location, speedControllers);
    }

    TrainState(
            double time,
            TrainPositionTracker location,
            double speed,
            TrainStatus status,
            List<SpeedController> speedControllers,
            TrainSchedule trainSchedule
    ) {
        this.time = time;
        this.location = location;
        this.speed = speed;
        this.status = status;
        this.speedControllers = speedControllers;
        this.trainSchedule = trainSchedule;
    }

    protected TrainState clone() {
        return new TrainState(
                time,
                location.clone(),
                speed,
                status,
                new ArrayList<>(speedControllers),
                trainSchedule);
    }

    private void step(
            Train.TrainLocationChange locationChange,
            @SuppressWarnings("SameParameterValue") double timeStep
    ) {

        // TODO: find out the actual max braking / acceleration force

        var rollingStock = trainSchedule.rollingStock;
        var integrator = TrainPhysicsIntegrator.make(
                timeStep,
                rollingStock,
                speed,
                location.maxTrainGrade());

        var prevLocation = location.getHeadPathPosition();

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
        location.updatePosition(update.positionDelta);
        this.time += update.timeDelta;
        var newLocation = location.getHeadPathPosition();

        logger.trace("speed changed from {} to {}", speed, update.speed);
        locationChange.positionUpdates.addSpeedUpdate(newLocation, time, update.speed);
        speed = update.speed;
    }

    private Train.TrainLocationChange computeSpeedCurve(
            Simulation sim,
            double goalTrackPosition
    ) throws SimulationError {
        var nextState = this.clone();

        var locationChange = new Train.TrainLocationChange(sim, trainSchedule.trainID, nextState);

        for (int i = 0; nextState.location.getHeadPathPosition() < goalTrackPosition; i++) {
            if (i >= 10000)
                throw new SimulationError("train physics numerical integration doesn't seem to stop");

            if (nextState.location.hasReachedGoal()) {
                nextState.status = TrainStatus.REACHED_DESTINATION;
                break;
            }

            nextState.step(locationChange, 1.0);
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
        return activeControllers.toArray(new SpeedController[activeControllers.size()]);
    }

    private Action driverDecision(SpeedDirective directive, TrainPhysicsIntegrator integrator) {
        var rollingStock = trainSchedule.rollingStock;
        return integrator.actionToTargetSpeed(directive.allowedSpeed, rollingStock);
    }

    @SuppressWarnings("UnnecessaryLocalVariable")
    TimelineEventCreated<Train, Train.TrainLocationChange> simulateUntilEvent(Train train, Simulation sim)
            throws SimulationError {
        // 1) find the next event position

        // look for objects in the range [train_position, +inf)
        // TODO: optimize, we don't need to iterate on all the path
        var nextTrackObjectVisibilityChange = location
                .streamPointAttrForward(Double.POSITIVE_INFINITY, TrackSection::getVisibleTrackObjects)
                .map(pointValue -> {
                    // the position of track object relative to path of the train
                    // (the distance to the train's starting point)
                    var pathObjectPosition = pointValue.position;
                    var driverSightDistance = trainSchedule.driverSightDistance;
                    var sightDistance = Math.min(driverSightDistance, pointValue.value.getSightDistance());
                    // return the path position at which the object becomes visible
                    return pathObjectPosition - sightDistance;
                })
                .min(Double::compareTo)
                // TODO: that's pretty meh
                .orElse(Double.POSITIVE_INFINITY);

        // for now, we only handle visible track objects
        var nextEventTrackPosition = nextTrackObjectVisibilityChange;

        // 2) simulate up to nextEventTrackPosition
        var simulationResult = computeSpeedCurve(sim, nextEventTrackPosition);

        // 3) create an event with simulation data up to this point
        var eventTime = simulationResult.newState.time;
        assert eventTime > sim.getTime();
        return sim.prepareEvent(train, eventTime, simulationResult);
    }

    @SuppressFBWarnings({"UPM_UNCALLED_PRIVATE_METHOD"})
    private double getMaxAcceleration() {
        if (status == TrainStatus.STARTING_UP)
            return trainSchedule.rollingStock.startUpAcceleration;
        return trainSchedule.rollingStock.comfortAcceleration;
    }

    /**
     * A function called by signals when a new limit is announced
     * @param distanceToAnnounce distance to the place the announce starts
     * @param distanceToExecution distance to the place the limit must be enforced
     * @param speedLimit the limit
     */
    public void onLimitAnnounce(double distanceToAnnounce, double distanceToExecution, double speedLimit) {
        var currentPos = location.getHeadPathPosition();
        speedControllers.add(new LimitAnnounceSpeedController(
                speedLimit,
                currentPos + distanceToAnnounce,
                currentPos + distanceToExecution,
                trainSchedule.rollingStock.timetableGamma
        ));
    }
}
