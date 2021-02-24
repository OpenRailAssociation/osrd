package fr.sncf.osrd.simulation;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.speedcontroller.LimitAnnounceSpeedController;
import fr.sncf.osrd.speedcontroller.MaxSpeedController;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.timetable.Schedule;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.simulation.TimelineEvent.State;
import fr.sncf.osrd.utils.CryoList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class SchedulerSystem extends Entity {
    static final Logger logger = LoggerFactory.getLogger(SchedulerSystem.class);

    private SchedulerSystem() {
        // the train must react to its own train creation events
        super(EntityType.SCHEDULER, "");
        this.addSubscriber(this);
    }

    @Override
    @SuppressFBWarnings(value = "BC_UNCONFIRMED_CAST")
    protected void onTimelineEventUpdate(
            Simulation sim,
            TimelineEvent<?> event,
            State state
    ) throws SimulationError {
        // we don't support train creation events for now
        if (state != State.HAPPENED) {
            logger.info("train creation cancelled");
            return;
        }

        if (event.value.getClass() != Train.TrainCreatedChange.class)
            return;
        var newTrainChange = (Train.TrainCreatedChange) event.value;

        logger.info("starting train {}", newTrainChange.timetable.name);
        Train.createTrain(sim, newTrainChange);
    }

    /**
     * Create a system which will spawn new train at the right time
     *
     * @param schedule the source schedule
     */
    public static SchedulerSystem fromSchedule(
            Simulation sim,
            Schedule schedule
    ) throws SimulationError {
        assert schedule.isFrozen();
        var scheduler = new SchedulerSystem();
        for (var timetable : schedule.timetables) {
            // the path is computed at the beginning of the simulation, as it is (for now) part of the event
            var trainPath = new TrainPath(sim.world.infra, timetable);
            var rollingStock = timetable.rollingStock;

            var controllers = new CryoList<SpeedController>();

            // add a limit for the maximum speed the hardware is rated for
            controllers.add(new MaxSpeedController(
                    rollingStock.maxSpeed,
                    Double.NEGATIVE_INFINITY,
                    Double.POSITIVE_INFINITY
            ));

            for (var pathSection : trainPath.sections) {
                var edge = pathSection.edge;
                for (var speedRange : TrackSection.getSpeedSections(edge, pathSection.direction)) {
                    var speedSection = speedRange.value;

                    // signalized speed sections are handled dynamically
                    if (speedSection.isSignalized)
                        continue;

                    // ignore the speed limit if it doesn't apply to our train
                    if (!speedSection.isValidFor(rollingStock))
                        continue;

                    // compute where this limit is active from and to
                    var offset = pathSection.pathStartOffset;
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
            }

            logger.trace("created initial speed controllers:");
            for (var controller : controllers)
                logger.trace("{}", controller);

            var startTime = timetable.getDepartureTime();
            sim.createEvent(scheduler, startTime, new Train.TrainCreatedChange(sim, timetable, trainPath, controllers));
        }
        return scheduler;
    }
}
