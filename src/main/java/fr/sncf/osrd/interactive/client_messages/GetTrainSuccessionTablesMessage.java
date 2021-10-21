package fr.sncf.osrd.interactive.client_messages;

import fr.sncf.osrd.interactive.InteractiveSimulation;
import java.io.IOException;
import java.util.List;

public class GetTrainSuccessionTablesMessage extends ClientMessage {
    public List<String> switches;

    @Override
    public void run(InteractiveSimulation interactiveSimulation) throws IOException {
        interactiveSimulation.sendTrainSuccessionTables(switches);
    }
}
