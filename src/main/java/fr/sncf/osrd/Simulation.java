package fr.sncf.osrd;

import com.badlogic.ashley.core.Engine;
import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.infra.viewer.InfraViewer;
import fr.sncf.osrd.timetable.Scheduler;
import fr.sncf.osrd.train.TrainUpdateSystem;

import java.math.BigDecimal;
import java.time.LocalTime;

public class Simulation {
    private final Engine engine;
    private final Scheduler scheduler;

    private final long simulationTimeStepSec;
    private final long simulationTimeStepNano;

    public final Config config;
    public LocalTime time;

    /**
     * Instantiate a simulation without starting it
     * @param config all the required parameters for the simulation
     */
    public Simulation(Config config) {
        this.config = config;
        engine = new Engine();
        scheduler = new Scheduler(config.schedule, this);
        time = scheduler.getStartTime();
        engine.addSystem(scheduler);

        if (config.showViewer) {
            var viewer = new InfraViewer(config.infra);
            engine.addSystem(viewer);
            viewer.display();
        }

        // split simulation time step
        BigDecimal simulationTimeStep = new BigDecimal(String.valueOf(config.simulationTimeStep));
        simulationTimeStepSec = simulationTimeStep.longValueExact(); // truncate simulationTimeStep
        simulationTimeStepNano = simulationTimeStep
                .subtract(new BigDecimal(simulationTimeStepSec))
                .multiply(new BigDecimal(1000000000))
                .longValueExact();

        engine.addSystem(new TrainUpdateSystem());
    }

    /**
     * Run the simulation
     */
    public void run() throws InterruptedException {
        long stepCount = 0;
        while (true) {
            engine.update(config.simulationTimeStep);
            if (scheduler.willScheduleTrains() && engine.getEntities().size() == 0)
                break;

            ++stepCount;
            time = time.plusSeconds(simulationTimeStepSec);
            if (simulationTimeStepNano != 0)
                time = time.plusNanos(simulationTimeStepNano);

            if (config.simulationStepPause != 0)
                Thread.sleep((long) (config.simulationStepPause * 1000));
        }
    }
}
