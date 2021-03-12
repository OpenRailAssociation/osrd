package fr.sncf.osrd.simulation;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.timetable.TrainSchedule;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.utils.CryoList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class SchedulerSystem extends AbstractEntity<SchedulerSystem, EntityID<SchedulerSystem>> {
    public static final EntityID<SchedulerSystem> ID = sim -> sim.scheduler;

    static final Logger logger = LoggerFactory.getLogger(SchedulerSystem.class);

    /** Create the scheduler system, without starting it */
    public SchedulerSystem() {
        // the train must react to its own train creation events
        super(ID);
        this.subscribers.add(this);
    }

    /** The value embed in the train creation event */
    public static final class TrainCreation implements TimelineEventValue {
        public final TrainSchedule schedule;
        public final CryoList<SpeedController> controllers;

        TrainCreation(
                TrainSchedule schedule,
                CryoList<SpeedController> controllers
        ) {
            this.schedule = schedule;
            this.controllers = controllers;
        }
    }

    @Override
    @SuppressFBWarnings(value = "BC_UNCONFIRMED_CAST")
    public void onEventOccurred(
            Simulation sim,
            TimelineEvent<?> event
    ) throws SimulationError {
        if (event.value.getClass() != TrainCreation.class)
            return;

        var trainCreation = (TrainCreation) event.value;
        var trainName = trainCreation.schedule.trainID;
        logger.info("starting train {}", trainName);

        Train.create(sim, trainCreation.schedule, trainCreation.controllers);
    }

    @Override
    public void onEventCancelled(Simulation sim, TimelineEvent<?> event) {
    }

    /** Plans to start a train from a given schedule */
    public void planTrain(Simulation sim, TrainSchedule schedule) {
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

        sim.scheduleEvent(this, schedule.departureTime, new TrainCreation(schedule, controllers));
    }
}
