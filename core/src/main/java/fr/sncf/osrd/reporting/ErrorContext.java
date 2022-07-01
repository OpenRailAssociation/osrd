package fr.sncf.osrd.reporting;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import java.io.Serial;
import java.io.Serializable;

public class ErrorContext implements Serializable {

    public static final PolymorphicJsonAdapterFactory<ErrorContext> adapter = (
            PolymorphicJsonAdapterFactory.of(ErrorContext.class, "type")
                    .withSubtype(Train.class, "train")
                    .withSubtype(Allowance.class, "allowance")
                    .withSubtype(Signal.class, "signal")
    );
    @Serial
    private static final long serialVersionUID = 2059829018182790086L;

    public static class Train extends ErrorContext {
        @Serial
        private static final long serialVersionUID = 806035086782570303L;
        public final String id;

        public Train(String id) {
            this.id = id;
        }
    }

    public static class Allowance extends ErrorContext {
        @Serial
        private static final long serialVersionUID = 6574267112831336260L;
        public final int index;

        public Allowance(int index) {
            this.index = index;
        }
    }

    public static class Signal extends ErrorContext {
        @Serial
        private static final long serialVersionUID = 1307122869428730982L;
        @Json(name = "signal_id")
        public final String signalID;

        public Signal(String signalID) {
            this.signalID = signalID;
        }
    }
}
