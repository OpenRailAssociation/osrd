package fr.sncf.osrd.simulation;

import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.infra.viewer.InfraViewer;
import fr.sncf.osrd.simulation.utils.TimelineEvent;
import fr.sncf.osrd.simulation.utils.BaseChange;
import fr.sncf.osrd.simulation.utils.Simulation;
import fr.sncf.osrd.simulation.utils.SimulationError;

public class SimulationManager {
    public final Simulation simulation;
    private final World world;

    /**
     * Instantiate a simulation without starting it
     * @param config all the required parameters for the simulation
     */
    public SimulationManager(Config config) throws SimulationError {
        // create the discrete event simulation
        var world = new World(config);
        var sim = new Simulation(world, 0.0);

        // create systems
        world.scheduler = SchedulerSystem.fromSchedule(sim, config.schedule);

        this.simulation = sim;
        this.world = world;
    }

    InfraViewer viewer = null;

    private void initViewer() {
        viewer = new InfraViewer(world.infra);
        viewer.display();
    }

    private void updateViewer(
            TimelineEvent<? extends BaseChange> nextEvent
    ) throws InterruptedException {
        if (world.trains.isEmpty())
            return;

        // if we have trains running, move the time forward by time increments
        // to help the viewer see something
        double interpolatedTime = simulation.getTime();
        double nextEventTime = nextEvent.scheduledTime;

        double interpolationStep = 1.0;
        while (simulation.getTime() < nextEventTime) {
            interpolatedTime += interpolationStep;
            if (interpolatedTime > nextEventTime)
                interpolatedTime = nextEventTime;

            Thread.sleep((long)(interpolationStep * 1000));
            viewer.update(world, interpolatedTime);
        }
    }

    /**
     * Run the simulation
     */
    public void run() throws SimulationError, InterruptedException {
        if (world.config.showViewer)
            initViewer();

        while (!simulation.isSimulationOver()) {
            var event = simulation.nextEvent();

            if (viewer != null)
                updateViewer(event);

            simulation.step(event);
        }
    }
}
