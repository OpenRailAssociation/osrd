package fr.sncf.osrd.simulation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SimulationChecker {
    static final Logger logger = LoggerFactory.getLogger(SimulationChecker.class);

    private static void checkChangeStates(Simulation sim, ChangeLog changelog) throws SimulationError {
        int count = 0;
        for (var change : changelog.getCreatedChanges()) {
            if (change.state == Change.State.PUBLISHED)
                continue;
            logger.error("this change wasn't published: {}", change);
            count++;
        }

        if (count != 0)
            throw new SimulationError(String.format("%d changes were not published", count));
    }

    private static void replayCheck(Simulation oldSim, ChangeLog changelog) throws SimulationError {
        var world = new World(oldSim.world.infra);
        var replaySim = new Simulation(world, oldSim.startTime, null);
        for (var change : changelog)
            change.replay(replaySim);

        if (!oldSim.equals(replaySim))
            throw new SimulationError("the result of the simulation replay isn't identical to the simulation result");
    }

    public static void check(Simulation sim, ChangeLog changelog) throws SimulationError {
        checkChangeStates(sim, changelog);
        replayCheck(sim, changelog);
    }
}
