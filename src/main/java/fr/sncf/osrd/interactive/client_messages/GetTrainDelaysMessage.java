package fr.sncf.osrd.interactive.client_messages;

import fr.sncf.osrd.interactive.InteractiveSimulation;
import java.io.IOException;
import java.util.Collection;

public class GetTrainDelaysMessage extends ClientMessage {
    Collection<String> trains;

    @Override
    public void run(InteractiveSimulation interactiveSimulation) throws IOException {
        interactiveSimulation.sendTrainDelays(trains);
    }
}
