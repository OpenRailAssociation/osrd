package fr.sncf.osrd.interactive;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import fr.sncf.osrd.interactive.client_messages.EventType;

import java.util.Map;
import java.util.TreeMap;

public abstract class ServerMessage {
    public static final JsonAdapter<ServerMessage> adapter = (
            new Moshi.Builder()
                    .add(PolymorphicJsonAdapterFactory.of(ServerMessage.class, "message_type")
                            .withSubtype(SessionInitialized.class, "session_initialized")
                            .withSubtype(SimulationCreated.class, "simulation_created")
                            .withSubtype(SimulationComplete.class, "simulation_complete")
                            .withSubtype(SimulationPaused.class, "simulation_paused")
                            .withSubtype(Error.class, "error"))
                    .build()
                    .adapter(ServerMessage.class)
    );

    public static final class SessionInitialized extends ServerMessage {
    }

    public static final class SimulationCreated extends ServerMessage {
    }

    public static final class SimulationComplete extends ServerMessage {
    }

    public static final class SimulationPaused extends ServerMessage {
        @Json(name = "event_type")
        public EventType eventType;

        public SimulationPaused(EventType eventType) {
            this.eventType = eventType;
        }
    }

    public static final class Error extends ServerMessage {
        public String message = null;
        public Map<String, String> details = null;

        public Error(String message, Map<String, String> details) {
            this.message = message;
            this.details = details;
        }

        public static Error withReason(String message, String reason) {
            var details = new TreeMap<String, String>();
            details.put("reason", reason);
            return new Error(message, details);
        }
    }
}
