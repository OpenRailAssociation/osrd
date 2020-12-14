package fr.sncf.osrd.simulation;

import fr.sncf.osrd.timetable.Schedule;
import fr.sncf.osrd.timetable.Timetable;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.util.simulation.Event;
import fr.sncf.osrd.util.simulation.EventSource;
import fr.sncf.osrd.util.simulation.core.AbstractEvent;
import fr.sncf.osrd.util.simulation.core.AbstractEvent.EventState;
import fr.sncf.osrd.util.simulation.core.Simulation;
import fr.sncf.osrd.util.simulation.core.SimulationError;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.ZoneOffset;

public class SchedulerSystem {
    static final Logger logger = LoggerFactory.getLogger(SchedulerSystem.class);

    private final Schedule schedule;
    public final EventSource<NewTrainEvent, World, BaseEvent> newTrainsSource;

    private SchedulerSystem(Schedule schedule, EventSource<NewTrainEvent, World, BaseEvent> newTrainsSource) {
        assert schedule.isFrozen();
        this.schedule = schedule;
        this.newTrainsSource = newTrainsSource;
        newTrainsSource.subscribe(this::createNewTrain);
    }

    private void createNewTrain(
            Simulation<World, BaseEvent> sim,
            Event<NewTrainEvent, World, BaseEvent> event,
            EventState state
    ) {
        // we don't support train creation events for now
        assert state == EventState.HAPPENED;

        var world = sim.world;
        var infra = world.infra;
        var timetable = event.value.timetable;
        var trainName = timetable.name;
        logger.info("starting train {}", trainName);
        var train = Train.createTrain(trainName,
                infra,
                timetable.rollingStock,
                new TrainPath(infra, timetable),
                timetable.initialSpeed);
        world.trains.add(train);
    }

    /**
     * Create a system which will spawn new train at the right time
     *
     * @param schedule the source schedule
     */
    public static SchedulerSystem fromSchedule(
            Simulation<World, BaseEvent> sim,
            Schedule schedule
    ) throws SimulationError {
        var newTrainsSource = new EventSource<NewTrainEvent, World, BaseEvent>();
        for (var timetable : schedule.timetables) {
            var startTime = timetable.getDepartureTime();
            newTrainsSource.event(sim, startTime, new NewTrainEvent(timetable));
        }
        return new SchedulerSystem(schedule, newTrainsSource);
    }
}
