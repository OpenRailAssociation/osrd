package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.simulation.BaseChange;
import fr.sncf.osrd.simulation.TrainLocationChange;
import fr.sncf.osrd.simulation.World;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.TrainPhysicsSimulator.PositionUpdate;
import fr.sncf.osrd.util.Pair;
import fr.sncf.osrd.util.TopoLocation;
import fr.sncf.osrd.util.simulation.Event;
import fr.sncf.osrd.util.simulation.EventSource;
import fr.sncf.osrd.util.simulation.core.AbstractEvent.EventState;
import fr.sncf.osrd.util.simulation.core.Simulation;
import fr.sncf.osrd.util.simulation.core.SimulationError;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.stream.Collectors;

public class Train {
    static final Logger logger = LoggerFactory.getLogger(Train.class);

    // how far the driver of the train can see
    public final double driverSightDistance;

    public final String name;
    public final RollingStock rollingStock;
    public final LinkedList<SpeedController> controllers = new LinkedList<>();

    // this field MUST be kept private, as it is not the position of the train at the current simulation time,
    // but rather the position of the train at the last event. it's fine and expected, but SpeedControllers need
    // the simulated location
    private TrainPositionTracker location;

    public double speed;
    public TrainState state = TrainState.STARTING_UP;

    public final EventSource<TrainLocationChange, World, BaseChange> trainMoveEvents;


    private Train(
            double driverSightDistance,
            String name,
            Simulation<World, BaseChange> sim,
            RollingStock rollingStock,
            TrainPath trainPath,
            double initialSpeed
    ) {
        this.lastEventTime = sim.getTime();
        this.driverSightDistance = driverSightDistance;
        this.name = name;
        this.rollingStock = rollingStock;
        this.location = new TrainPositionTracker(sim.world.infra, trainPath, rollingStock.length);
        this.speed = initialSpeed;
        this.trainMoveEvents = new EventSource<>();
        trainMoveEvents.subscribe(this::trainMoveReact);
    }

    /**
     * Creates a train entity
     * @param name the train's name
     * @param rollingStock the train inventory item
     * @param trainPath the path the train will follow
     * @param initialSpeed the initial speed the train will travel at
     * @return A new train entity
     */
    public static Train createTrain(
            Simulation<World, BaseChange> sim,
            String name,
            RollingStock rollingStock,
            TrainPath trainPath,
            double initialSpeed,
            double sightDistance
    ) throws SimulationError {
        var train = new Train(sightDistance, name, sim, rollingStock, trainPath, initialSpeed);
        train.controllers.add((_train, _location, timeDelta) -> Action.accelerate(_train.rollingStock.mass / 2, false));
        train.planNextMove(sim);
        return train;
    }

    void trainMoveReact(
            Simulation<World, BaseChange> sim,
            Event<TrainLocationChange, World, BaseChange> change,
            EventState newState) throws SimulationError {
        if (newState == EventState.CANCELLED) {
            planNextMove(sim);
        } else if (newState == EventState.HAPPENED) {
            applyLocationChange(sim, nextMoveEvent.value);
            planNextMove(sim);
        } else
            throw new SimulationError("invalid state change");
    }

    private void applyLocationChange(Simulation<World, BaseChange> sim, TrainLocationChange value) {
        this.speed = value.newSpeed;
        this.location = value.newLocation;
        this.lastEventTime = sim.getTime();
    }

    private double lastEventTime;
    private Event<TrainLocationChange, World, BaseChange> nextMoveEvent = null;

    private void planNextMove(Simulation<World, BaseChange> sim) throws SimulationError {
        // 1) find the next event position

        // look for objects in the range [train_position, +inf)
        // TODO: optimize, we don't need to iterate on all the path
        var nextTrackObjectVisibilityChange = location
                .streamPointAttrForward(Double.POSITIVE_INFINITY, TopoEdge::getVisibleTrackObjects)
                .map(pointValue -> {
                    // the position of track object relative to path of the train
                    // (the distance to the train's starting point)
                    var pathObjectPosition = pointValue.position;
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
        var nextEventLocation = location.clone();
        double eventArrivalTime = sim.getTime();
        double newSpeed = speed;
        var positionUpdates = new ArrayList<PositionUpdate>();
        int i = 0;
        while (nextEventLocation.getHeadPathPosition() < nextEventTrackPosition) {
            // TODO: stop at the end of the path.
            // TODO: find out the actual max braking / acceleration force

            // TODO: don't hardcode this integration step
            var integrationTimeStep = 1.0;
            var simulator = TrainPhysicsSimulator.make(
                    integrationTimeStep,
                    rollingStock,
                    speed,
                    nextEventLocation.maxTrainGrade());

            Action action = getAction(nextEventLocation, simulator);
            logger.debug("train took action {}", action);

            assert action != null;

            var update = simulator.computeUpdate(action.tractionForce(), action.brakingForce());
            // TODO: handle emergency braking

            logger.debug("speed changed from {} to {}", speed, update.speed);
            newSpeed = update.speed;
            eventArrivalTime += integrationTimeStep;
            nextEventLocation.updatePosition(update.positionDelta);
            positionUpdates.add(update);
            i++;
            if (i >= 1000)
                throw new SimulationError("simulation did not end");
        }

        // 3) create an event with simulation data up to this point
        nextMoveEvent = trainMoveEvents.event(
                sim,
                eventArrivalTime,
                new TrainLocationChange(newSpeed, positionUpdates, nextEventLocation));
    }

    private Action getAction(TrainPositionTracker location, TrainPhysicsSimulator trainPhysics) {
        switch (state) {
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


    @SuppressFBWarnings(value = "UPM_UNCALLED_PRIVATE_METHOD")
    private double getMaxAcceleration() {
        if (state == TrainState.STARTING_UP)
            return rollingStock.startUpAcceleration;
        return rollingStock.comfortAcceleration;
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

    /**
     * Returns the position of the train's head, interpolated for the given time.
     * This is meant to be used for data visualization.
     * @param time the simulation time to compute the position for
     * @return the position of the head at the given time
     */
    public TopoLocation getInterpolatedHeadLocation(double time) {
        // this method is used by the viewer to display the position of the train during the simulation
        // we should compute the expected position of the train at the requested time (which can't be after the next
        // train move event
        var curTime = lastEventTime;
        var res = location.clone();
        for (var update : nextMoveEvent.value.positionUpdates) {
            if (curTime >= time)
                break;

            res.updatePosition(update.positionDelta);
            curTime += update.timeDelta;
        }
        return res.getHeadTopoLocation();
    }
}
