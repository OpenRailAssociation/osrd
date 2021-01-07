package fr.sncf.osrd.simulation;

import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.infra.viewer.InfraViewer;
import fr.sncf.osrd.simulation.utils.Change;
import fr.sncf.osrd.simulation.utils.TimelineEvent;
import fr.sncf.osrd.simulation.utils.Simulation;
import fr.sncf.osrd.simulation.utils.SimulationError;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.function.Consumer;

public class SimulationManager {
    static final Logger logger = LoggerFactory.getLogger(SimulationManager.class);

    public final Simulation simulation;
    private final World world;

    private final double simStartTime = 0.0;


    ArrayList<Change> allChanges = new ArrayList<>();
    long publishedChanges = 0;

    /**
     * Instantiate a simulation without starting it
     * @param config all the required parameters for the simulation
     */
    public SimulationManager(Config config) throws SimulationError {
        // create a logger for event sourcing changes
        Consumer<Change> changeLogger = (change) -> {
            logger.info("new change: {}", change);
            publishedChanges++;
        };

        // create the discrete event simulation
        var world = new World(config);

        // the replay check mode needs to log all events
        Consumer<Change> onChangeCreated = null;
        Consumer<Change> onChangeSubmitted = null;
        if (config.changeReplayCheck) {
            onChangeCreated = allChanges::add;
            onChangeSubmitted = changeLogger;
        }

        var sim = new Simulation(world, simStartTime, onChangeCreated, onChangeSubmitted);

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
            TimelineEvent<?> nextEvent
    ) throws InterruptedException {
        // if the user doesn't want realtime visualization, update the viewer once
        if (!world.config.realTimeViewer) {
            viewer.update(world, simulation.getTime());
            return;
        }

        // move the time forward by time increments
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

    private void checkChangeStates() {
        if (allChanges.size() == publishedChanges)
            return;

        logger.error(
                "some Changes were not logged: {} created, {} published",
                allChanges.size(),
                publishedChanges);

        for (var change : allChanges) {
            if (change.state == Change.State.PUBLISHED)
                continue;
            logger.error("this change wasn't published: {}", change);
        }
    }

    private void replayCheck() {
        checkChangeStates();

        var replaySim = new Simulation(world, simStartTime, null, null);
        for (var change : allChanges)
            change.replay(replaySim);

        if (this.simulation.equals(replaySim))
            logger.info("replay check succeeded");
        else
            logger.error("replay check failed");
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

        if (world.config.changeReplayCheck)
            replayCheck();
    }
}
