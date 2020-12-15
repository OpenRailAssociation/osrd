package fr.sncf.osrd.simulation;

import fr.sncf.osrd.timetable.Schedule;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.util.simulation.Event;
import fr.sncf.osrd.util.simulation.EventSource;
import fr.sncf.osrd.util.simulation.core.AbstractEvent.EventState;
import fr.sncf.osrd.util.simulation.core.Simulation;
import fr.sncf.osrd.util.simulation.core.SimulationError;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SchedulerSystem {
    static final Logger logger = LoggerFactory.getLogger(SchedulerSystem.class);

    public final EventSource<NewTrainChange, World, BaseChange> newTrainsSource;

    private SchedulerSystem(EventSource<NewTrainChange, World, BaseChange> newTrainsSource) {
        this.newTrainsSource = newTrainsSource;
        newTrainsSource.subscribe(this::createNewTrain);
    }

    private void createNewTrain(
            Simulation<World, BaseChange> sim,
            Event<NewTrainChange, World, BaseChange> event,
            EventState state
    ) throws SimulationError {
        // we don't support train creation events for now
        assert state == EventState.HAPPENED;

        var world = sim.world;
        var infra = world.infra;
        var timetable = event.value.timetable;
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
            Simulation<World, BaseChange> sim,
            Schedule schedule
    ) throws SimulationError {
        assert schedule.isFrozen();
        var newTrainsSource = new EventSource<NewTrainChange, World, BaseChange>();
        for (var timetable : schedule.timetables) {
            var startTime = timetable.getDepartureTime();
            newTrainsSource.event(sim, startTime, new NewTrainChange(timetable));
        }
        return new SchedulerSystem(newTrainsSource);
    }
}
