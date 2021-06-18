package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

public abstract class RJSAllowance {
    public static final PolymorphicJsonAdapterFactory<RJSAllowance> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSAllowance.class, "type")
                    .withSubtype(MarecoAllowance.class, "eco")
                    .withSubtype(ConstructionAllowance.class, "construction")
                    .withSubtype(LinearAllowance.class, "linear")
    );

    public static final class MarecoAllowance extends RJSAllowance {

        @Json(name = "allowance_type")
        public MarecoAllowance.MarginType allowanceType;

        @Json(name = "allowance_value")
        public double allowanceValue;

        public enum MarginType {
            TIME,
            DISTANCE,
        }
    }

    public static final class LinearAllowance extends RJSAllowance {
        @Json(name = "allowance_type")
        public MarginType allowanceType;

        @Json(name = "allowance_value")
        public double allowanceValue;

        public enum MarginType {
            TIME,
            DISTANCE,
        }
    }

    public static final class ConstructionAllowance extends RJSAllowance {
        @Json(name = "allowance_value")
        public double allowanceValue;

    }
}
