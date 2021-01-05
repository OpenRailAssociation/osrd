package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.utils.*;
import fr.sncf.osrd.simulation.TrainLocationChange;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.util.TopoLocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.LinkedList;

public class Train extends Entity {
    static final Logger logger = LoggerFactory.getLogger(Train.class);

    // how far the driver of the train can see
    public final double driverSightDistance;

    public final String name;
    public final RollingStock rollingStock;

    private TrainState lastState;

    // the candidate next state
    private TrainState nextState = null;
    private TimelineEvent<TrainLocationChange> nextMoveEvent = null;

    private Train(
            double driverSightDistance,
            String name,
            Simulation sim,
            RollingStock rollingStock,
            TrainPath trainPath,
            double initialSpeed,
            LinkedList<SpeedController> controllers
    ) {
        this.driverSightDistance = driverSightDistance;
        this.name = name;
        this.rollingStock = rollingStock;
        var location = new TrainPositionTracker(sim.world.infra, trainPath, rollingStock.length);
        this.lastState = new TrainState(
                sim.getTime(),
                location,
                initialSpeed,
                TrainStatus.STARTING_UP,
                controllers,
                this
        );
        // the train must react to its own move events
        this.addSubscriber(this);
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
            Simulation sim,
            String name,
            RollingStock rollingStock,
            TrainPath trainPath,
            double initialSpeed,
            double sightDistance
    ) throws SimulationError {
        var controllers = new LinkedList<SpeedController>();
        controllers.add((trainState, _location, timeDelta) ->
                Action.accelerate(trainState.train.rollingStock.mass / 2, false));

        var train = new Train(sightDistance, name, sim, rollingStock, trainPath, initialSpeed, controllers);
        train.planNextMove(sim);
        return train;
    }

    void planNextMove(Simulation sim) throws SimulationError {
        nextMoveEvent = lastState.simulateUntilEvent(sim);
    }

    void trainMoveReact(
            Simulation sim,
            TrainLocationChange change,
            TimelineEvent.State newState) throws SimulationError {
        if (newState == TimelineEvent.State.CANCELLED) {
            planNextMove(sim);
        } else if (newState == TimelineEvent.State.HAPPENED) {
            assert change.newState == nextState;
            this.lastState = this.nextState;
            this.nextState = null;
            this.nextMoveEvent = null;
            planNextMove(sim);
        } else
            throw new SimulationError("invalid state change");
    }

    @Override
    @SuppressFBWarnings(value = "BC_UNCONFIRMED_CAST")
    protected void timelineEventUpdate(
            Simulation sim,
            TimelineEvent<?> event,
            TimelineEvent.State state
    ) throws SimulationError {
        if (event.value.getClass() == TrainLocationChange.class)
            trainMoveReact(sim, (TrainLocationChange)event.value, state);
    }


    public static class InterpolatedTrainSpeedAndLocation {
        public final double speed;
        public final TopoLocation location;

        public InterpolatedTrainSpeedAndLocation(double speed, TopoLocation location) {
            this.speed = speed;
            this.location = location;
        }
    }

    /**
     * Returns the position and speed of the train's head, interpolated for the given time.
     * This is meant to be used for data visualization.
     * @param time the simulation time to compute the position for
     * @return the position of the head at the given time
     */
    @SuppressFBWarnings(value = "BC_UNCONFIRMED_CAST")
    public InterpolatedTrainSpeedAndLocation getInterpolatedHeadLocationAndSpeed(double time) {
        // this method is used by the viewer to display the position of the train during the simulation
        // we should compute the expected position of the train at the requested time (which can't be after the next
        // train move event
        var curTime = lastState.time;
        var res = lastState.location.clone();
        double interpolatedSpeed = lastState.speed;
        for (var update : nextMoveEvent.value.positionUpdates) {
            if (curTime >= time)
                break;

            res.updatePosition(update.positionDelta);
            curTime += update.timeDelta;
            interpolatedSpeed = update.speed;
        }
        return new InterpolatedTrainSpeedAndLocation(interpolatedSpeed, res.getHeadTopoLocation());
    }
}
