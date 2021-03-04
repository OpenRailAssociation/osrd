package fr.sncf.osrd.simulation;

import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;

public class ChangeReplayChecker extends ChangeConsumer {
    static final Logger logger = LoggerFactory.getLogger(ChangeReplayChecker.class);

    private final Simulation referenceSim;
    private final Simulation replaySim;

    private ChangeReplayChecker(Simulation referenceSim, Simulation replaySim) {
        this.referenceSim = referenceSim;
        this.replaySim = replaySim;
    }

    /** Creates a change replay checker */
    public static ChangeReplayChecker from(Simulation referenceSim) {
        var replaySim = Simulation.create(referenceSim.infra, referenceSim.startTime, null);
        assert replaySim.equals(referenceSim) : "the reference and replay simulation shouldn't differ from the start";
        return new ChangeReplayChecker(referenceSim, replaySim);
    }

    @Override
    public void changeCreationCallback(Change change) {
    }

    private boolean isConsistent = true;

    @Override
    public void changePublishedCallback(Change change) {
        change.replay(replaySim);

        var newConsistency = referenceSim.equals(replaySim);
        if (newConsistency == isConsistent)
            return;

        if (newConsistency)
            logger.error("the simulation replay is consistent again after change {}", change);
        else
            logger.error("the result of the simulation replay isn't identical "
                    + " to the simulation result after change {}", change);
        isConsistent = newConsistency;
    }
}
