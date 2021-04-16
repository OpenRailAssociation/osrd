package fr.sncf.osrd.train.events;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.TrainSchedule;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

public class TrainCreatedEvent extends TimelineEvent {
    static final Logger logger = LoggerFactory.getLogger(TrainCreatedEvent.class);

    public final TrainSchedule schedule;
    public final List<SpeedController> controllers;

    private TrainCreatedEvent(TimelineEventId eventId, TrainSchedule schedule, List<SpeedController> controllers) {
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

    /** Plan a TrainCreatedEvent creating a change that schedule it and return the created train */
    public static TrainCreatedEvent plan(Simulation sim, TrainSchedule schedule, List<SpeedController> controllers) {
        var change = new TrainCreationPlanned(sim, schedule, controllers);
        var event = change.apply(sim);
        sim.publishChange(change);
        return event;
    }

    public static class TrainCreationPlanned extends Simulation.TimelineEventCreated {
        public final TrainSchedule schedule;
        public final List<SpeedController> controllers;

        /** Plans the creation of some train */
        private TrainCreationPlanned(Simulation sim, TrainSchedule schedule, List<SpeedController> controllers) {
            super(sim, schedule.departureTime);
            this.schedule = schedule;
            this.controllers = controllers;
        }

        private TrainCreatedEvent apply(Simulation sim) {
            var event = new TrainCreatedEvent(eventId, schedule, controllers);
            super.scheduleEvent(sim, event);
            return event;
        }

        @Override
        public void replay(Simulation sim) {
            apply(sim);
        }

        @Override
        public String toString() {
            return String.format("TrainCreationPlanned { %s }", schedule.trainID);
        }
    }

    /** Plans to start a train from a given schedule */
    public static void plan(Simulation sim, TrainSchedule schedule) {
        // the path is computed at the beginning of the simulation, as it is (for now) part of the event
        var trainPath = schedule.fullPath;
        var rollingStock = schedule.rollingStock;

        var controllers = new ArrayList<SpeedController>();

        // add a limit for the maximum speed the hardware is rated for
        controllers.add(new MaxSpeedController(
                rollingStock.maxSpeed,
                Double.NEGATIVE_INFINITY,
                Double.POSITIVE_INFINITY
        ));

        var offset = 0;
        for (var trackSectionRange : trainPath) {
            var edge = trackSectionRange.edge;
            var absBegin = Double.min(trackSectionRange.getBeginPosition(), trackSectionRange.getEndPosition());
            var absEnd = Double.max(trackSectionRange.getBeginPosition(), trackSectionRange.getEndPosition());
            for (var speedRange : TrackSection.getSpeedSections(edge, trackSectionRange.direction)) {
                var speedSection = speedRange.value;
                var speedTrackRange = new TrackSectionRange(
                        edge,
                        EdgeDirection.START_TO_STOP,
                        Double.max(speedRange.begin, absBegin),
                        Double.min(speedRange.end, absEnd)
                );
                if (trackSectionRange.direction == EdgeDirection.STOP_TO_START)
                    speedTrackRange = speedTrackRange.opposite();

                // signalized speed sections are handled dynamically
                if (speedSection.isSignalized)
                    continue;

                // ignore the speed limit if it doesn't apply to our train
                if (!speedSection.isValidFor(rollingStock))
                    continue;

                // compute where this limit is active from and to
                var begin = offset + speedTrackRange.getBeginPosition() - trackSectionRange.getBeginPosition();
                var end = begin + speedTrackRange.length();

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
            offset += trackSectionRange.length();
        }

        logger.trace("created initial speed controllers:");
        for (var controller : controllers)
            logger.trace("{}", controller);

        TrainCreatedEvent.plan(sim, schedule, controllers);
    }
}
