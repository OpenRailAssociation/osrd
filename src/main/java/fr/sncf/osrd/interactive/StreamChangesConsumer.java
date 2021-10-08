package fr.sncf.osrd.interactive;

import fr.sncf.osrd.infra_state.InfraState;
import fr.sncf.osrd.interactive.changes_adapters.SerializedChange;
import fr.sncf.osrd.interactive.client_messages.ChangeType;
import fr.sncf.osrd.simulation.Change;
import fr.sncf.osrd.simulation.changelog.ChangeConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

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
            var serializedClass = changeType.serializedChangeType;
            SerializedChange serializedChange;
            try {
                Method fromChange = serializedClass.getMethod("fromChange", changeType.internalChangeType, InfraState.class);
                serializedChange = (SerializedChange) fromChange.invoke(null, change, interactiveSimulation.simulation.infraState);
            } catch (NoSuchMethodException e) {
                throw new RuntimeException(
                        String.format("Missing 'fromChange' static method for change '%s'", changeType.toString()), e);
            } catch (InvocationTargetException e) {
                throw new RuntimeException("Fail running fromChange method", e);
            } catch (IllegalAccessException e) {
                throw new RuntimeException("Wrong visibility for 'fromChange' method", e);
            }
            var changeOccurred = new ServerMessage.ChangeOccurred(serializedChange);
            try {
                interactiveSimulation.sendResponse(changeOccurred);
            } catch (IOException e) {
                logger.error("failed to serialize change", e);
            }
        }
    }
}
