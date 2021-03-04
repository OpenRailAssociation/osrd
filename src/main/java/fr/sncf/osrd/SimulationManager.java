package fr.sncf.osrd;

import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.simulation.changelog.ArrayChangeLog;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.simulation.changelog.ChangeConsumerMultiplexer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;

public final class SimulationManager {
    static final Logger logger = LoggerFactory.getLogger(SimulationManager.class);

    private static void updateViewer(
            Simulation sim,
            Config config,
            DebugViewer viewer,
            TimelineEvent<?> nextEvent
    ) throws InterruptedException {
        double nextEventTime = nextEvent.scheduledTime;

        // the time to wait between simulation steps
        double interpolationStep = 1.0;

        // if the user doesn't want realtime visualization, update the viewer once per timeline event
        if (!config.realTimeViewer) {
            viewer.update(sim.trains, nextEventTime);
            Thread.sleep((long) (interpolationStep * 1000));
            return;
        }

        // skip updates when there are no trains
        if (sim.trains.isEmpty())
            return;

        // move the time forward by time increments
        // to help the viewer see something
        double interpolatedTime = sim.getTime();

        while (sim.getTime() < nextEventTime) {
            interpolatedTime += interpolationStep;
            if (interpolatedTime > nextEventTime)
                interpolatedTime = nextEventTime;

            Thread.sleep((long) (interpolationStep * 1000));
            viewer.update(sim.trains, interpolatedTime);
        }
    }

    /**
     * Run the simulation
     */
    public static void run(
            Config config,
            ArrayList<ChangeConsumer> changeConsumers
    ) throws SimulationError, InterruptedException {
        // create the simulation and add change consumers
        var multiplexer = new ChangeConsumerMultiplexer(changeConsumers);
        var sim = Simulation.create(config.infra, 0, multiplexer);
        if (config.changeReplayCheck)
            multiplexer.add(ChangeReplayChecker.from(sim));

        // plan train creation
        for (var trainSchedule : config.schedule.trainSchedules)
            sim.scheduler.planTrain(sim, trainSchedule);

        // initialize the viewer
        DebugViewer viewer = null;
        if (config.showViewer) {
            viewer = new DebugViewer(config.infra);
            viewer.display();
        }

        // run the simulation loop
        for (int eventsCount = 0; !sim.isSimulationOver(); eventsCount++) {
            if (eventsCount != 0)
                Thread.sleep((long) (config.simulationStepPause * 1000));

            var event = sim.getNextEvent();

            if (viewer != null)
                updateViewer(sim, config, viewer, event);

            sim.step(event);
        }
    }
}
