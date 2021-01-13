package fr.sncf.osrd.simulation;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.utils.*;
import fr.sncf.osrd.timetable.Schedule;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.simulation.utils.TimelineEvent.State;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class SchedulerSystem extends Entity {
    static final Logger logger = LoggerFactory.getLogger(SchedulerSystem.class);

    private SchedulerSystem() {
        // the train must react to its own train creation events
        super("scheduler");
        this.addSubscriber(this);
    }

    @Override
    @SuppressFBWarnings(value = "BC_UNCONFIRMED_CAST")
    protected void timelineEventUpdate(
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
            var startTime = timetable.getDepartureTime();
            scheduler.event(sim, startTime, new Train.TrainCreatedChange(sim, timetable, trainPath));
        }
        return scheduler;
    }
}
