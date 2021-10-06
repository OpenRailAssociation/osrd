package fr.sncf.osrd.interactive.client_messages;

import fr.sncf.osrd.interactive.InteractiveSimulation;
import fr.sncf.osrd.interactive.ServerError;
import fr.sncf.osrd.interactive.ServerMessage;

public class RunMessage extends ClientMessage {
    @Override
    public ServerMessage run(InteractiveSimulation interactiveSimulation) throws ServerError {
        return interactiveSimulation.run();
    }
}
