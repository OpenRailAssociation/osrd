package fr.sncf.osrd;

import fr.sncf.osrd.config.Config;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import fr.sncf.osrd.simulation.changelog.ChangeConsumerMultiplexer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;

public final class SimulationManager {
    static final Logger logger = LoggerFactory.getLogger(SimulationManager.class);


    /** Run the simulation */
    public static void run(
            Config config,
            ArrayList<ChangeConsumer> changeConsumers
    ) throws SimulationError, InterruptedException {
        // create the simulation and add change consumers
        var multiplexer = new ChangeConsumerMultiplexer(changeConsumers);
        var sim = Simulation.createFromInfra(config.infra, 0, multiplexer);

        if (config.changeReplayCheck)
            multiplexer.add(ChangeReplayChecker.from(sim));

        // create the viewer
        if (config.showViewer)
            multiplexer.add(DebugViewer.from(config.infra, config.realTimeViewer));

        // plan train creation
        for (var trainSchedule : config.schedule.trainSchedules)
            sim.scheduler.planTrain(sim, trainSchedule);

        // run the simulation loop
        while (!sim.isSimulationOver())
            sim.step();
    }
}
