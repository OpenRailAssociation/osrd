package fr.sncf.osrd.simulation;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.utils.CryoList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public abstract class Scheduler {
    static final Logger logger = LoggerFactory.getLogger(Scheduler.class);

    /** The value embed in the train creation event */
    public static final class TrainCreatedEvent extends TimelineEvent {
        public final TrainSchedule schedule;
        public final List<SpeedController> controllers;

        TrainCreatedEvent(
                TimelineEventId eventId,
                TrainSchedule schedule,
                List<SpeedController> controllers
        ) {
            super(eventId);
            this.schedule = schedule;
            this.controllers = controllers;
        }

        @Override
        protected void onOccurrence(Simulation sim) throws SimulationError {
            var trainName = schedule.trainID;
            logger.info("starting train {}", trainName);

            Train.create(sim, schedule, controllers);
        }

        @Override
        protected void onCancellation(Simulation sim) throws SimulationError {
            throw new SimulationError("cancelling train creation isn't supported");
        }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(TimelineEvent other) {
            if (other.getClass() != TrainCreatedEvent.class)
                return false;
            var o = (TrainCreatedEvent) other;
            return o.schedule == schedule && controllers.equals(o.controllers);
        }
    }

    public static class TrainPlannedChange extends SimChange<Void> {
        public final TrainSchedule schedule;
        public final List<SpeedController> controllers;

        /** Plan */
        public TrainPlannedChange(Simulation sim, TrainSchedule schedule, List<SpeedController> controllers) {
            super(sim);
            this.schedule = schedule;
            this.controllers = controllers;
        }

        @Override
        public Void apply(Simulation sim) {
            var event = new TrainCreatedEvent(sim.nextEventId(schedule.departureTime), schedule, controllers);
            sim.scheduleEvent(event);
            return null;
        }
    }

    /** Plans to start a train from a given schedule */
    public static void planTrain(Simulation sim, TrainSchedule schedule) {
        // the path is computed at the beginning of the simulation, as it is (for now) part of the event
        var trainPath = schedule.fullPath;
        var rollingStock = schedule.rollingStock;

        var controllers = new CryoList<SpeedController>();

        // add a limit for the maximum speed the hardware is rated for
        controllers.add(new MaxSpeedController(
                rollingStock.maxSpeed,
                Double.NEGATIVE_INFINITY,
                Double.POSITIVE_INFINITY
        ));

        var offset = 0;
        for (var trackSectionRange : trainPath) {
            var edge = trackSectionRange.edge;
            for (var speedRange : TrackSection.getSpeedSections(edge, trackSectionRange.direction)) {
                var speedSection = speedRange.value;

                // signalized speed sections are handled dynamically
                if (speedSection.isSignalized)
                    continue;

                // ignore the speed limit if it doesn't apply to our train
                if (!speedSection.isValidFor(rollingStock))
                    continue;

                // compute where this limit is active from and to
                var begin = offset + speedRange.begin;
                var end = offset + speedRange.end;

                // we need to add two speed controllers:
                // the first is in charge of slowing down the train as it approaches the restricted zone
                var targetSpeed = speedSection.speedLimit;
                var initialSpeed = rollingStock.maxSpeed;

                // compute the speed controller corresponding to the approach to the restricted speed section
                if (targetSpeed < initialSpeed) {
                    var requiredBrakingDistance = (
                            (initialSpeed * initialSpeed - targetSpeed * targetSpeed)
                                    / 2 * rollingStock.timetableGamma
                    );

                    var brakingStart = begin - requiredBrakingDistance;
                    controllers.add(new LimitAnnounceSpeedController(
                            targetSpeed,
                            brakingStart,
                            begin,
                            rollingStock.timetableGamma
                    ));
                }

                controllers.add(new MaxSpeedController(speedSection.speedLimit, begin, end));
            }
            offset += trackSectionRange.edge.length;
        }

        logger.trace("created initial speed controllers:");
        for (var controller : controllers)
            logger.trace("{}", controller);

        var trainPlanned = new TrainPlannedChange(sim, schedule, controllers);
        trainPlanned.apply(sim);
        sim.publishChange(trainPlanned);
    }
}
