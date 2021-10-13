package fr.sncf.osrd.interactive.client_messages;

import com.squareup.moshi.Json;
import fr.sncf.osrd.interactive.InteractiveSimulation;
import java.io.IOException;
import java.util.Set;

public class WatchChangesMessage extends ClientMessage {
    @Json(name = "change_types")
    public Set<ChangeType> changeTypes;

    @Override
    public void run(InteractiveSimulation interactiveSimulation) throws IOException {
        interactiveSimulation.watchChangesTypes(changeTypes);
    }
}
