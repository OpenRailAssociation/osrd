package fr.sncf.osrd.simulation;

import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.viewer.DebugViewer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class SimulationManager {
    static final Logger logger = LoggerFactory.getLogger(SimulationManager.class);

    public final ArrayChangeLog changelog;

    private final Simulation sim;
    private final Config config;

    private SimulationManager(Config config, ArrayChangeLog changelog) throws SimulationError {
        this.sim = Simulation.create(config.infra, 0, config.schedule, changelog);
        this.changelog = changelog;
        this.config = config;
    }

    /**
     * Instantiate a simulation without starting it
     * @param config all the required parameters for the simulation
     */
    public static SimulationManager fromConfig(Config config, boolean needsChangeLog) throws SimulationError {
        ArrayChangeLog changelog = null;
        if (needsChangeLog || config.changeReplayCheck)
            changelog = new ArrayChangeLog();

        // create a logger for event sourcing changes
        return new SimulationManager(config, changelog);
    }

    private void updateViewer(
            DebugViewer viewer,
            TimelineEvent<?> nextEvent
    ) throws InterruptedException {
        double nextEventTime = nextEvent.scheduledTime;

        // the time to wait between simulation steps
        double interpolationStep = 1.0;

        // if the user doesn't want realtime visualization, update the viewer once per timeline event
        if (!config.realTimeViewer) {
            viewer.update(sim.world, nextEventTime);
            Thread.sleep((long) (interpolationStep * 1000));
            return;
        }

        // skip updates when there are no trains
        if (sim.world.trains.isEmpty())
            return;

        // move the time forward by time increments
        // to help the viewer see something
        double interpolatedTime = sim.getTime();

        while (sim.getTime() < nextEventTime) {
            interpolatedTime += interpolationStep;
            if (interpolatedTime > nextEventTime)
                interpolatedTime = nextEventTime;

            Thread.sleep((long) (interpolationStep * 1000));
            viewer.update(sim.world, interpolatedTime);
        }
    }

    /**
     * Run the simulation
     */
    public void run() throws SimulationError, InterruptedException {
        DebugViewer viewer = null;

        if (config.showViewer) {
            viewer = new DebugViewer(config.infra);
            viewer.display();
        }

        while (!sim.isSimulationOver()) {
            var event = sim.getNextEvent();

            if (viewer != null)
                updateViewer(viewer, event);

            sim.step(event);
        }

        if (config.changeReplayCheck)
            SimulationChecker.check(sim, changelog);
    }
}
