package fr.sncf.osrd.interactive.client_messages;

import com.squareup.moshi.Json;
import fr.sncf.osrd.interactive.InteractiveSimulation;

import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

public class RunUntilMessage extends ClientMessage {
    @Json(name = "until_events")
    public Set<EventType> untilEvents;
    @Override
    public void run(InteractiveSimulation interactiveSimulation) throws IOException {
        interactiveSimulation.run(untilEvents != null ? untilEvents : new HashSet<>());
    }
}
