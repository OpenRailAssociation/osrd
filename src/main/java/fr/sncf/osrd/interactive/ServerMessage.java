package fr.sncf.osrd.interactive;

import com.squareup.moshi.Json;
import com.squareup.moshi.JsonAdapter;
import com.squareup.moshi.Moshi;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import fr.sncf.osrd.interactive.action_point_adapters.SerializedActionPoint;
import fr.sncf.osrd.interactive.changes_adapters.SerializedChange;
import fr.sncf.osrd.interactive.events_adapters.*;
import java.util.List;
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
                            .withSubtype(ChangeOccurred.class, "change_occurred")
                            .withSubtype(WatchChanges.class, "watch_changes")
                            .withSubtype(TrainDelays.class, "train_delays")
                            .withSubtype(TrainSuccessionTables.class, "train_succession_tables")
                            .withSubtype(Error.class, "error")
                    )
                    .add(SerializedChange.adapter)
                    .add(SerializedEvent.adapter)
                    .add(SerializedActionPoint.adapter)
                    .build()
                    .adapter(ServerMessage.class)
    );

    public static final class SessionInitialized extends ServerMessage {}

    public static final class SimulationCreated extends ServerMessage {}

    public static final class SimulationComplete extends ServerMessage {}

    public static final class SimulationPaused extends ServerMessage {
        public final SerializedEvent event;

        public SimulationPaused(SerializedEvent event) {
            this.event = event;
        }
    }

    public static final class ChangeOccurred extends ServerMessage {
        public final SerializedChange change;

        public ChangeOccurred(SerializedChange change) {
            this.change = change;
        }
    }

    public static final class WatchChanges extends ServerMessage {}

    public static final class TrainDelays extends ServerMessage {
        @Json(name = "train_delays")
        public Map<String, Double> trainDelays;

        TrainDelays(Map<String, Double> trainDelays) {
            this.trainDelays = trainDelays;
        }
    }

    public static final class TrainSuccessionTables extends ServerMessage {
        @Json(name = "train_succession")
        public Map<String, List<String>> trainSuccession;

        TrainSuccessionTables(Map<String, List<String>> trainSuccession) {
            this.trainSuccession = trainSuccession;
        }
    }

    public static final class Error extends ServerMessage {
        public String message;
        public Map<String, String> details;

        public Error(String message, Map<String, String> details) {
            this.message = message;
            this.details = details;
        }

        /** Create an error message with a given reason */
        public static Error withReason(String message, String reason) {
            var details = new TreeMap<String, String>();
            details.put("reason", reason);
            return new Error(message, details);
        }
    }
}
