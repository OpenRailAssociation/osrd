package fr.sncf.osrd.simulation;

import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.infra.viewer.InfraViewer;
import fr.sncf.osrd.util.simulation.core.AbstractEvent;
import fr.sncf.osrd.util.simulation.core.Simulation;
import fr.sncf.osrd.util.simulation.core.SimulationError;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.function.BiConsumer;

public class SimulationManager {
    public final Simulation<World, BaseEvent> simulation;
    private ArrayList<BiConsumer<Simulation<World, BaseEvent>, BaseEvent>> eventCallbacks = new ArrayList<>();

    public final Config config;

    /**
     * Instantiate a simulation without starting it
     * @param config all the required parameters for the simulation
     */
    public SimulationManager(Config config) throws SimulationError {
        // create the discrete event simulation
        var world = new World(config);
        var sim = new Simulation<World, BaseEvent>(world, 0.0);

        // create systems
        world.scheduler = SchedulerSystem.fromSchedule(sim, config.schedule);

        if (config.showViewer) {
            var viewer = new InfraViewer(config.infra);
            viewer.display();
            eventCallbacks.add((_sim, event) -> {
                viewer.update(_sim.world, _sim.getTime());
            });
        }

        this.config = config;
        this.simulation = sim;
    }

    /**
     * Run the simulation
     */
    public void run() throws SimulationError {
        while (!simulation.isSimulationOver()) {
            var event = simulation.step();
            for (var callback : eventCallbacks)
                callback.accept(simulation, event);
        }
    }
}
