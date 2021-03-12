package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.signaling.TrainInteractable;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.timetable.TrainSchedule;
import fr.sncf.osrd.timetable.TrainSchedule.TrainID;
import fr.sncf.osrd.utils.CryoList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

public class Train extends AbstractEntity<Train, TrainID> {
    static final Logger logger = LoggerFactory.getLogger(Train.class);

    public String getName() {
        return id.trainName;
    }

    private TrainState lastState;

    private Train(
            Simulation sim,
            TrainSchedule schedule,
            List<SpeedController> controllers,
            ArrayDeque<TrackSectionRange> trackSectionRanges
    ) {
        super(schedule.trainID);
        var location = new TrainPositionTracker(sim.infra, sim.infraState, trackSectionRanges);
        var stageState = schedule.stages.get(0).getState();
        this.lastState = new TrainState(
                sim.getTime(),
                location,
                schedule.initialSpeed,
                TrainStatus.STARTING_UP,
                controllers,
                schedule,
                0,
                stageState
        );
        // the train must react to its own move events
        this.subscribers.add(this);
    }

    // region ENTITY_REACTOR

    /** Create a train */
    public static Train create(
            Simulation sim,
            TrainSchedule schedule,
            CryoList<SpeedController> controllers
    ) throws SimulationError {
        var trackSectionPositions = TrainPositionTracker.computeInitialPosition(
                sim.infra,
                schedule.startTrackSection,
                schedule.startDirection,
                schedule.startOffset,
                schedule.rollingStock.length
        );
        var trainCreatedChange = new Train.TrainCreatedChange(sim, schedule, controllers, trackSectionPositions);
        var train = trainCreatedChange.apply(sim);
        sim.publishChange(trainCreatedChange);
        train.scheduleStateChange(sim);
        return train;
    }

    private void scheduleStateChange(Simulation sim) throws SimulationError {
        if (lastState.status == TrainStatus.REACHED_DESTINATION) {
            logger.info("train {} reached destination, aborting planning", id);
            return;
        }

        logger.info("planning the next move for train {}", id);
        lastState.scheduleStateChange(this, sim);
    }

    @Override
    public void onEventOccurred(Simulation sim, TimelineEvent<?> event) throws SimulationError {
        if (event.value.getClass() == TrainStateChange.class) {
            var stateChange = (TrainStateChange) event.value;
            stateChange.apply(sim, this);
            sim.publishChange(stateChange);
            scheduleStateChange(sim);
            return;
        }
        if (event.value.getClass() == TrainReachesInteraction.class) {
            var eventInteract =  (TrainReachesInteraction) event.value;

            // Apply StateChange
            var stateChange = eventInteract.trainStateChange;
            stateChange.apply(sim, this);
            sim.publishChange(stateChange);

            // Interact
            eventInteract.interactionObject.interact(sim, this);

            // Schedule next state
            scheduleStateChange(sim);
        }
    }

    @Override
    public void onEventCancelled(Simulation sim, TimelineEvent<?> event) throws SimulationError {
        if (event.value.getClass() == TrainStateChange.class)
            scheduleStateChange(sim);
    }

    // endregion

    // region CHANGES

    public static final class TrainCreatedChange extends SimChange<Train> {
        public final TrainSchedule schedule;
        public final CryoList<SpeedController> initialControllers;
        public final ArrayDeque<TrackSectionRange> trackSectionRanges;

        /** A change corresponding to a train's creation. */
        public TrainCreatedChange(
                Simulation sim,
                TrainSchedule schedule,
                CryoList<SpeedController> initialControllers,
                ArrayDeque<TrackSectionRange> trackSectionRanges
        ) {
            super(sim);
            this.schedule = schedule;
            this.initialControllers = initialControllers;
            this.trackSectionRanges = trackSectionRanges;
        }

        @Override
        public Train apply(Simulation sim) {
            var controllers = new ArrayList<>(initialControllers);
            var train = new Train(sim, schedule, controllers, trackSectionRanges);
            sim.trains.put(train.getName(), train);
            return train;
        }

        @Override
        public String toString() {
            return String.format("TrainCreatedChange { name=%s }", schedule.trainID);
        }
    }

    public static class TrainStateChange extends EntityChange<Train, TrainID, Void> {
        public final TrainState newState;
        public final SpeedUpdates positionUpdates = new SpeedUpdates();
        public final PathUpdates<SpeedController[]> speedControllersUpdates = new PathUpdates<>();
        public final PathUpdates<SpeedDirective> speedDirectivesUpdates = new PathUpdates<>();

        /** Creates a change corresponding to the movement of a train */
        public TrainStateChange(Simulation sim, TrainID trainID, TrainState newState) {
            super(sim, trainID);
            this.newState = newState;
        }

        @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
        public static final class PathValue<T> {
            public final double pathPosition;
            public final T value;

            public PathValue(double pathPosition, T value) {
                this.pathPosition = pathPosition;
                this.value = value;
            }
        }

        public static final class SpeedUpdate {
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

            public double interpolatePosition(double nextTime) {
                double delta = time - nextTime;
                return pathPosition + delta * speed;
            }
        }

        public static final class PathUpdates<T> extends CryoList<PathValue<T>> {
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

        public static final class SpeedUpdates extends CryoList<SpeedUpdate> {
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

        /**
         * Finds the last speed update at a given time
         * @param time the reference time
         * @return the last speed update at a given time
         */
        public SpeedUpdate findLastSpeedUpdate(double time) {
            SpeedUpdate lastUpdate = null;

            for (var update : positionUpdates) {
                if (update.time > time)
                    break;
                lastUpdate = update;
            }
            assert lastUpdate != null;
            return lastUpdate;
        }

        @Override
        public final Void apply(Simulation sim, Train train) {
            train.lastState = this.newState;
            return null;
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

    // region EVENT VALUES
    public static final class TrainReachesInteraction implements TimelineEventValue {
        public final TrainInteractable interactionObject;
        public final TrainStateChange trainStateChange;

        public TrainReachesInteraction(TrainInteractable interactionObject, TrainStateChange trainStateChange) {
            this.interactionObject = interactionObject;
            this.trainStateChange = trainStateChange;
        }
    }
    // endregion
}
