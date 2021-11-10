package fr.sncf.osrd.simulation;

import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.ArrayList;

public class ChangeReplayChecker extends ChangeConsumer {
    static final Logger logger = LoggerFactory.getLogger(ChangeReplayChecker.class);

    private final Simulation referenceSim;
    private final Simulation replaySim;
    private boolean isConsistent = true;

    private ChangeReplayChecker(Simulation referenceSim, Simulation replaySim) {
        this.referenceSim = referenceSim;
        this.replaySim = replaySim;
    }

    /** Creates a change replay checker */
    public static ChangeReplayChecker from(Simulation refSim) {
        var refInfra = refSim.infra;
        Simulation replaySim;
        if (refInfra != null) {
            var initTST = new ArrayList<>(refSim.infraState.towerState.trainSuccessionTables.values());
            replaySim = Simulation.createFromInfraAndSuccessions(refInfra, initTST, refSim.startTime, null);
        } else {
            replaySim = Simulation.createWithoutInfra(refSim.startTime, null);
        }

        assert replaySim.deepEquals(refSim) : "the reference and replay simulation shouldn't differ from the start";
        return new ChangeReplayChecker(refSim, replaySim);
    }

    @Override
    public void changeCreationCallback(Change change) {
    }

    @Override
    public void changePublishedCallback(Change change) {
        change.replay(replaySim);

        var newConsistency = referenceSim.deepEquals(replaySim);
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
