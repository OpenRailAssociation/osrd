package fr.sncf.osrd.simulation;

import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.ArrayList;

public class ChangeStateChecker extends ChangeConsumer {
    static final Logger logger = LoggerFactory.getLogger(ChangeReplayChecker.class);
    private final ArrayList<Change> createdChanges = new ArrayList<>();

    void check() throws SimulationError {
        int count = 0;
        for (var change : createdChanges) {
            if (change.state == Change.State.PUBLISHED)
                continue;
            logger.error("change wasn't published: {}", change);
            count++;
        }

        if (count != 0)
            throw new SimulationError(String.format("%d changes were not published", count));
    }

    @Override
    public void changeCreationCallback(Change change) {
        createdChanges.add(change);
    }

    @Override
    public void changePublishedCallback(Change change) {
    }
}
