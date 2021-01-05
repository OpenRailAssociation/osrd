package fr.sncf.osrd.simulation;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.simulation.utils.*;
import fr.sncf.osrd.timetable.Schedule;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.simulation.utils.TimelineEvent.State;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SchedulerSystem extends Entity {
    static final Logger logger = LoggerFactory.getLogger(SchedulerSystem.class);

    private SchedulerSystem() {
        // the train must react to its own train creation events
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
        assert state == State.HAPPENED;

        var world = sim.world;
        var infra = world.infra;

        if (event.value.getClass() != NewTrainChange.class)
            return;
        var value = (NewTrainChange)event.value;

        var timetable = value.timetable;
        var trainName = timetable.name;
        logger.info("starting train {}", trainName);
        var train = Train.createTrain(
                sim,
                trainName,
                timetable.rollingStock,
                new TrainPath(infra, timetable),
                timetable.initialSpeed,
                400);
        world.trains.add(train);
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
            var startTime = timetable.getDepartureTime();
            scheduler.event(sim, startTime, new NewTrainChange(timetable));
        }
        return scheduler;
    }
}
