package fr.sncf.osrd;

import com.badlogic.ashley.core.Engine;
import fr.sncf.osrd.timetable.Scheduler;

public class Simulation {
    private Config config;
    private Engine engine;

    /**
     * Instantiate a simulation without starting it
     */
    public Simulation(Config config) {
        this.config = config;
        engine = new Engine();
        engine.addSystem(new Scheduler());
    }

    /**
     * Run the simulation
     */
    public void run() {
        long stepCount = 0;
        while (true) {
            engine.update(config.getSimulationTimeStep());
            ++stepCount;
        }
    }
}
