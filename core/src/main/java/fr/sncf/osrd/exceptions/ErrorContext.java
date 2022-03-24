package fr.sncf.osrd.exceptions;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;

public class ErrorContext {

    public static final PolymorphicJsonAdapterFactory<ErrorContext> adapter = (
            PolymorphicJsonAdapterFactory.of(ErrorContext.class, "type")
                    .withSubtype(Train.class, "train")
                    .withSubtype(Allowance.class, "allowance")
                    .withSubtype(Signal.class, "signal")
    );

    public static class Train extends ErrorContext {
        public final String id;

        public Train(String id) {
            this.id = id;
        }
    }

    public static class Allowance extends ErrorContext {
        public final int index;

        public Allowance(int index) {
            this.index = index;
        }
    }

    public static class Signal extends ErrorContext {
        @Json(name = "signal_id")
        public final String signalID;

        public Signal(String signalID) {
            this.signalID = signalID;
        }
    }
}
