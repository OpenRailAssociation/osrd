package fr.sncf.osrd.interactive;

import fr.sncf.osrd.interactive.changes_adapters.SerializedChange;
import fr.sncf.osrd.interactive.client_messages.ChangeType;
import fr.sncf.osrd.simulation.Change;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

public class StreamChangesConsumer extends ChangeConsumer {
    private final InteractiveSimulation interactiveSimulation;
    static final Logger logger = LoggerFactory.getLogger(InteractiveEndpoint.class);

    public StreamChangesConsumer(InteractiveSimulation interactiveSimulation) {
        this.interactiveSimulation = interactiveSimulation;
    }

    @Override
    public void changeCreationCallback(Change change) {}

    @Override
    public void changePublishedCallback(Change change) {
        var watchedChangesType = interactiveSimulation.watchedChangeTypes;
        var changeType = ChangeType.fromChange(change);
        if (watchedChangesType.contains(changeType)) {
            var infraState = interactiveSimulation.simulation.infraState;
            var serializedChange = SerializedChange.fromChange(change, infraState);
            var changeOccurred = new ServerMessage.ChangeOccurred(serializedChange);
            try {
                interactiveSimulation.sendResponse(changeOccurred);
            } catch (IOException e) {
                logger.error("failed to serialize change", e);
            }
        }
    }
}
