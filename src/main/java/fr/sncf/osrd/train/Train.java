package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.utils.*;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.StaticSpeedLimitController;
import fr.sncf.osrd.timetable.TrainSchedule;
import fr.sncf.osrd.util.TopoLocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.LinkedList;

public class Train extends Entity {
    static final Logger logger = LoggerFactory.getLogger(Train.class);

    // how far the driver of the train can see
    public final double driverSightDistance;

    public final String name;
    public final RollingStock rollingStock;

    private TrainState lastState;

    // the candidate next state, which corresponds to the state of the train when
    // it goes through the next point of interest, such as a signal getting in sight range
    private TrainState nextState = null;

    // the timeline event for the train's arrival at the next point of interest
    private TimelineEvent<LocationChange> nextMoveEvent = null;

    Train(
            double driverSightDistance,
            String name,
            Simulation sim,
            RollingStock rollingStock,
            TrainPath trainPath,
            double initialSpeed,
            LinkedList<SpeedController> controllers
    ) {
        super(String.format("train/%s", name));
        this.name = name;
        this.driverSightDistance = driverSightDistance;
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
     * @param sim the simulation
     * @param trainCreatedChange the change modeling the train's creation
     * @return A new train entity
     */
    public static Train createTrain(
            Simulation sim,
            TrainCreatedChange trainCreatedChange
    ) throws SimulationError {
        var train = trainCreatedChange.apply(sim);
        sim.publishChange(trainCreatedChange);
        train.planNextMove(sim);
        return train;
    }

    // region ENTITY_REACTOR

    void planNextMove(Simulation sim) throws SimulationError {
        if (lastState.status == TrainStatus.REACHED_DESTINATION) {
            logger.info("train {} reached destination, aborting planning", name);
            return;
        }

        logger.info("planning the next move for train {}", name);
        var moveEvent = lastState.simulateUntilEvent(sim);
        var change = new TrainPlannedMoveChange(sim, this, moveEvent);
        change.apply(sim, this, moveEvent);
        sim.publishChange(change);
    }

    void trainMoveReact(
            Simulation sim,
            LocationChange locationChange,
            TimelineEvent.State newState
    ) throws SimulationError {
        if (newState == TimelineEvent.State.CANCELLED) {
            planNextMove(sim);
        } else if (newState == TimelineEvent.State.HAPPENED) {
            locationChange.apply(sim, this);
            sim.publishChange(locationChange);
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
        if (event.value.getClass() == LocationChange.class)
            trainMoveReact(sim, (LocationChange) event.value, state);
    }

    // endregion

    // region VIEWER_INTERPOLATION

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

    // endregion

    // region CHANGES

    public static final class TrainCreatedChange extends SimChange<Train> {
        public final TrainSchedule timetable;
        public final TrainPath trainPath;

        /**
         * A change corresponding to a train's creation.
         * @param sim the simulation
         * @param timetable the train's timetable
         * @param trainPath the path the train shall follow
         */
        public TrainCreatedChange(Simulation sim, TrainSchedule timetable, TrainPath trainPath) {
            super(sim);
            this.timetable = timetable;
            this.trainPath = trainPath;
        }

        @Override
        public Train apply(Simulation sim) {
            var trainName = timetable.name;

            var controllers = new LinkedList<SpeedController>();

            controllers.add(new StaticSpeedLimitController());

            var train = new Train(
                    400,
                    trainName,
                    sim,
                    timetable.rollingStock,
                    trainPath,
                    timetable.initialSpeed,
                    controllers
            );
            sim.registerEntity(train);
            sim.world.trains.add(train);
            return train;
        }

        @Override
        public String toString() {
            return String.format("TrainCreatedChange { name=%s }", timetable.name);
        }
    }

    public static class LocationChange extends EntityChange<Train, Void> {
        public final TrainState newState;
        public final ArrayList<TrainPhysicsIntegrator.PositionUpdate> positionUpdates;

        /**
         * Creates a change corresponding to the movement of a train
         *
         * @param newState        the state of the train after the change
         * @param positionUpdates the speed / position curve
         */
        public LocationChange(
                Simulation sim,
                Train train,
                TrainState newState,
                ArrayList<TrainPhysicsIntegrator.PositionUpdate> positionUpdates
        ) {
            super(sim,  train);
            this.newState = newState;
            this.positionUpdates = positionUpdates;
        }

        @Override
        public final Void apply(Simulation sim, Train train) {
            train.lastState = this.newState;
            train.nextState = null;
            train.nextMoveEvent = null;
            return null;
        }

        @Override
        public String toString() {
            return String.format(
                    "Train.LocationChange { speed=%.2f, pathPosition=%.2f }",
                    newState.speed,
                    newState.location.getHeadPathPosition()
            );
        }
    }

    public static final class TrainPlannedMoveChange extends EntityEventChange<Train, LocationChange, Void> {
        public TrainPlannedMoveChange(Simulation sim, Train entity, TimelineEvent<LocationChange> timelineEvent) {
            super(sim, entity, timelineEvent);
        }

        @Override
        public Void apply(Simulation sim, Train train, TimelineEvent<LocationChange> event) {
            train.nextMoveEvent = event;
            return null;
        }

        @Override
        public String toString() {
            return String.format("TrainPlannedMoveChange { nextMoveEvent=%s }", timelineEventId.toString());
        }
    }

    // endregion
}
