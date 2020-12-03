package fr.sncf.osrd.timetable;

import com.badlogic.ashley.core.Entity;
import com.badlogic.ashley.core.EntitySystem;
import fr.sncf.osrd.Simulation;
import fr.sncf.osrd.SystemOrdering;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.util.CryoList;

import java.time.LocalTime;

public class Scheduler extends EntitySystem {
    private final Schedule schedule;
    private int scheduleIndex = 0;

    private final Simulation simulation;

    /**
     * Create a system which will spawn new train at the right time
     *
     * @param schedule the source schedule
     */
    public Scheduler(Schedule schedule, Simulation simulation) {
        super(SystemOrdering.TIMETABLE.priority);
        assert schedule.isFrozen();
        this.schedule = schedule;
        this.simulation = simulation;
    }

    public LocalTime getStartTime() {
        return schedule.timetables.first().getDepartureTime();
    }

    public boolean willScheduleTrains() {
        return schedule.timetables.size() != scheduleIndex;
    }

    private boolean shouldCreateTrain() {
        LocalTime nextTrainTime = schedule.timetables.get(scheduleIndex).getDepartureTime();
        return simulation.time.equals(nextTrainTime) || simulation.time.isAfter(nextTrainTime);
    }

    @Override
    public void update(float deltaTime) {
        while (scheduleIndex < schedule.timetables.size() && shouldCreateTrain()) {
            Timetable timetable = schedule.timetables.first();
            Entity train = Train.createTrain(timetable.name,
                    simulation.config.infra,
                    timetable.rollingStock,
                    new TrainPath(simulation.config.infra, timetable),
                    timetable.initialSpeed);
            getEngine().addEntity(train);
            ++scheduleIndex;
        }
    }
}
