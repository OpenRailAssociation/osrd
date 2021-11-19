package fr.sncf.osrd.train;

import static fr.sncf.osrd.infra.signaling.AspectConstraint.ConstraintPosition.Element.CURRENT_SIGNAL;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.signaling.AspectConstraint;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra.trackgraph.Detector;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.train.events.TrainCreatedEvent;
import fr.sncf.osrd.utils.DeepComparable;
import fr.sncf.osrd.utils.DeepEqualsUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Set;

public class Train {
    static final Logger logger = LoggerFactory.getLogger(Train.class);

    public String getID() {
        return schedule.trainID;
    }

    private TrainState lastState;
    public final TrainSchedule schedule;
    public TrainEvolutionEvent lastScheduledEvent = null;

    private Train(TrainSchedule schedule, TrainState initialState) {
        this.schedule = schedule;
        this.lastState = initialState;
    }

    /** Returns the delay of the train, in seconds, compared to its scheduled trip */
    public double getDelay(double time) {
        double position = lastScheduledEvent.interpolatePosition(lastState, time);
        return schedule.speedInstructions.secondsLate(position, time);
    }

    /** Create a train */
    public static Train create(
            Simulation sim,
            TrainSchedule schedule
    ) throws SimulationError {
        schedule.speedInstructions.generate(sim, schedule);
        var phaseState = schedule.phases.get(0).getState(sim, schedule);
        var location = getInitialLocation(schedule);
        var initialState = new TrainState(
                sim.getTime(),
                location,
                schedule.initialSpeed,
                TrainStatus.STARTING_UP,
                schedule,
                0,
                phaseState,
                new ArrayDeque<>(),
                new TrainPath(schedule.plannedPath),
                0,
                0
        );

        var trainCreatedChange = new TrainCreatedChange(sim, schedule, initialState);
        var train = trainCreatedChange.apply(sim);
        ActivateRoute.trainCreation(sim, initialState);
        sim.publishChange(trainCreatedChange);
        train.scheduleStateChange(sim);
        return train;
    }

    /** Generates the initial location object of a train given its schedule */
    public static TrainPositionTracker getInitialLocation(TrainSchedule schedule) {
        var trackSectionPath = schedule.plannedPath.trackSectionPath;
        return new TrainPositionTracker(trackSectionPath);
    }

    /** Returns the last TrainState */
    public TrainState getLastState() {
        return lastState;
    }

    // region ENTITY_REACTOR

    /** Simulate the current state to schedule the next one */
    public void scheduleStateChange(Simulation sim) throws SimulationError {
        if (lastScheduledEvent != null && lastScheduledEvent.getState() == TimelineEvent.State.SCHEDULED)
            return;
        if (lastState.status == TrainStatus.REACHED_DESTINATION) {
            logger.info("train {} reached destination, aborting planning", getID());
            return;
        }

        logger.info("planning the next move for train {}", getID());
        var clonedState = lastState.clone();
        clonedState.time = sim.getTime();
        lastScheduledEvent = clonedState.simulatePhase(this, sim);
    }

    /** Frees all the tvd sections currently reserved by the train */
    private void freeAllReservedTVDSections(Simulation sim) throws SimulationError {

        for (var interaction : lastState.actionPointsUnderTrain) {
            if (interaction.interactionType.equals(InteractionType.TAIL)) {
                interaction.interact(sim, this);
            }
        }

        var path = lastState.path;
        for (var currentTvdSectionPath : path.routePath.get(lastState.routeIndex).tvdSectionsPaths) {
            var index = currentTvdSectionPath.tvdSection.index;
            var tvdSection = sim.infraState.getTvdSectionState(index);

            if (tvdSection.isOccupied())
                tvdSection.unoccupy(sim);
        }
    }

    private void onTrainReachedDestination(Simulation sim) throws SimulationError {
        if (schedule.trainSuccession != null) {
            var nextSchedule = schedule.trainSuccession.nextTrain;
            nextSchedule.departureTime = sim.getTime() + schedule.trainSuccession.delay;
            TrainCreatedEvent.plan(sim, nextSchedule);
        }

        var change = new TrainState.TrainDisappearChange(sim, lastState);
        change.apply(sim, lastState);
        sim.publishChange(change);

        // Free the tvdSections the train is on
        freeAllReservedTVDSections(sim);
    }

    /** Restarts the train after a stop */
    public void restart(Simulation sim) throws SimulationError {
        var clonedState = lastState.clone();
        clonedState.time = sim.getTime();
        clonedState.stopIndex++;
        if (clonedState.stopIndex >= schedule.stops.size()) {
            onTrainReachedDestination(sim);
            return;
        }
        logger.info("restarting train {}", getID());
        lastScheduledEvent = clonedState.simulatePhase(this, sim);
    }

    /** Reserve routes when the train is in navigate phase */
    public void onEventOccurred(Simulation sim) throws SimulationError {
        // TODO find a smarter way to do it and remove this method
        ActivateRoute.reserveRoutes(sim, this);
    }

    // endregion

    // region INTERACTIONS
    /** Make the train interact with a detector */
    public void interact(Simulation sim, Detector detector, InteractionType interactionType) throws SimulationError {
        lastState.updateTVDSections(sim, detector, interactionType);
    }

    /** Make the train interact with a signal */
    public void interact(Simulation sim, Signal signal, InteractionType interactionType) throws SimulationError {
        var signalState = sim.infraState.getSignalState(signal.index);

        switch (interactionType) {
            case SEEN:
                signalState.subscribeTrain(this);
                lastState.setAspectConstraints(signalState);
                break;
            case HEAD:
                onTrainReachSignal(signalState);
                break;
            default:
                throw new RuntimeException("Unexpected signal interaction type");
        }
    }

    private void onTrainReachSignal(SignalState signalState) throws SimulationError {
        for (var aspect : signalState.aspects) {
            for (var constraint : aspect.constraints) {
                if (constraint.getClass() != AspectConstraint.SpeedLimit.class)
                    continue;
                var speedLimit = (AspectConstraint.SpeedLimit) constraint;
                if (!(speedLimit.appliesAt.element.equals(CURRENT_SIGNAL) && speedLimit.appliesAt.offset <= 0))
                    continue;
                if (speedLimit.until.element.equals(CURRENT_SIGNAL) && speedLimit.until.offset < 0)
                    continue;
                if (speedLimit.speed <= 0)
                    throw new SimulationError(String.format("Train %s has reached a blocking signal %s",
                            schedule.trainID, signalState.signal.id));
            }
        }

        signalState.unsubscribeTrain();
    }

    /** Notify the train that a signal has change aspects and it have to re-evaluate its planned state */
    public void reactNewAspects(Simulation sim, SignalState signalState) throws SimulationError {
        if (lastScheduledEvent != null && lastScheduledEvent.getState() == TimelineEvent.State.SCHEDULED) {
            // Cancel last scheduled event
            sim.cancel(lastScheduledEvent);
            // Recompute the state until current simulation time
            var newState = lastState.clone();
            var stateChange = newState.evolveStateUntilNow(sim);
            stateChange.apply(sim, this);
            sim.publishChange(stateChange);
        }
        // Change/Add aspect constraints
        lastState.setAspectConstraints(signalState);
        // Schedule the next train state
        scheduleStateChange(sim);
    }
    // endregion

    // region CHANGES

    public static final class TrainCreatedChange extends SimChange<Train> {
        public final TrainSchedule schedule;
        public final TrainState initialState;

        /** A change corresponding to a train's creation. */
        public TrainCreatedChange(
                Simulation sim,
                TrainSchedule schedule,
                TrainState initialState
        ) {
            super(sim);
            this.schedule = schedule;
            this.initialState = initialState;
        }

        @Override
        public Train apply(Simulation sim) {
            var train = new Train(schedule, initialState.clone());
            sim.trains.put(train.getID(), train);
            return train;
        }

        @Override
        public String toString() {
            return String.format("TrainCreatedChange { name=%s }", schedule.trainID);
        }
    }

    public static class TrainStateChange extends EntityChange<Train, Void> implements DeepComparable<TrainStateChange> {
        public final String trainID;
        public final TrainState newState;
        public final SpeedUpdates positionUpdates = new SpeedUpdates();
        public final PathUpdates<Set<SpeedController>> speedControllersUpdates = new PathUpdates<>();
        public final PathUpdates<SpeedDirective> speedDirectivesUpdates = new PathUpdates<>();

        /**
         * Returns the interpolated position of the train at the current time,
         * or null if the requested time isn't in range
         */
        public Double interpolatePosition(TrainState previousState, double time) {
            if (previousState != null) {
                if (time < previousState.time)
                    return null;

                if (positionUpdates.isEmpty() || time < positionUpdates.get(0).time) {
                    double position = previousState.location.getPathPosition();
                    return SpeedUpdate.interpolatePosition(position, previousState.time, previousState.speed, time);
                }
            }

            var lastUpdate = findLastSpeedUpdate(time);
            if (lastUpdate == null)
                return null;
            return lastUpdate.interpolatePosition(time);
        }

        /**
         * Finds the most recent integration step at the given time,
         * or null if the given time is before the change.
         */
        public SpeedUpdate findLastSpeedUpdate(double time) {
            SpeedUpdate lastUpdate = null;
            for (var update : positionUpdates) {
                if (update.time > time)
                    break;
                lastUpdate = update;
            }
            return lastUpdate;
        }

        /** Creates a change corresponding to the movement of a train */
        public TrainStateChange(Simulation sim, String trainID, TrainState newState) {
            super(sim);
            this.trainID = trainID;
            this.newState = newState;
        }

        /** Deep compare two train state change */
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(TrainStateChange o) {
            if (!o.newState.deepEquals(o.newState))
                return false;
            if (!DeepEqualsUtils.deepEquals(positionUpdates, o.positionUpdates))
                return false;
            return speedDirectivesUpdates.equals(o.speedDirectivesUpdates);
        }

        public static final class PathValue<T> {
            public final double pathPosition;
            public final T value;

            public PathValue(double pathPosition, T value) {
                this.pathPosition = pathPosition;
                this.value = value;
            }

            @Override
            public int hashCode() {
                return value.hashCode() * 31 + Double.hashCode(pathPosition);
            }

            @Override
            @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
            public boolean equals(Object obj) {
                if (obj == null || obj.getClass() != PathValue.class)
                    return false;
                var o = (PathValue<?>) obj;
                return o.pathPosition == pathPosition && o.value.equals(value);
            }
        }

        public static final class SpeedUpdate implements DeepComparable<SpeedUpdate> {
            public double pathPosition;
            public double time;
            public double speed;

            /**
             * A speed update
             * @param pathPosition the current position
             * @param time the current time
             * @param speed the current speed
             */
            public SpeedUpdate(double pathPosition, double time, double speed) {
                this.pathPosition = pathPosition;
                this.time = time;
                this.speed = speed;
            }

            public static double interpolatePosition(double pathPosition, double time, double speed, double nextTime) {
                double delta = nextTime - time;
                return pathPosition + delta * speed;
            }

            public double interpolatePosition(double nextTime) {
                return interpolatePosition(pathPosition, time, speed, nextTime);
            }

            @Override
            @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
            public boolean deepEquals(SpeedUpdate other) {
                return pathPosition == other.pathPosition && time == other.time && speed == other.speed;
            }
        }

        public static final class PathUpdates<T> extends ArrayList<PathValue<T>> {
            private static final long serialVersionUID = -398512329955860429L;

            /**
             * Add an update, avoiding duplicates
             * @param pathPosition the position on the path
             * @param value the value at the given position
             */
            public void dedupAdd(double pathPosition, T value) {
                if (isEmpty()) {
                    add(new PathValue<>(pathPosition, value));
                    return;
                }

                var last = get(size() - 1);

                // only add the new value if it differs from the last one
                if (!last.value.equals(value))
                    add(new PathValue<>(pathPosition, value));
            }
        }

        public static final class SpeedUpdates extends ArrayList<SpeedUpdate> {
            private static final long serialVersionUID = 1186037080779235871L;

            /**
             * Adds a speed update, avoiding duplicates
             * @param pathPosition the new position on the path
             * @param time the current time
             * @param speed the current speed
             */
            @SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
            public void addSpeedUpdate(double pathPosition, double time, double speed) {
                if (isEmpty()) {
                    add(new SpeedUpdate(pathPosition, time, speed));
                    return;
                }

                var last = get(size() - 1);
                if (last.speed == speed)
                    return;

                add(new SpeedUpdate(pathPosition, time, speed));
            }
        }

        @Override
        public final Void apply(Simulation sim, Train train) {
            train.lastState = this.newState;
            return null;
        }

        @Override
        public Train getEntity(Simulation sim) {
            return sim.trains.get(trainID);
        }

        @Override
        public String toString() {
            return String.format(
                    "TrainStateChange { speed=%.2f, newState.headPathPosition=%.2f }",
                    newState.speed,
                    newState.location.getPathPosition()
            );
        }
    }
    // endregion
}
