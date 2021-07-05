package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;

public abstract class RJSAllowance {
    public static final PolymorphicJsonAdapterFactory<RJSAllowance> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSAllowance.class, "type")
                    .withSubtype(MarecoAllowance.class, "eco")
                    .withSubtype(ConstructionAllowance.class, "construction")
                    .withSubtype(LinearAllowance.class, "linear")
    );

    /** Beginning of the allowance, defaults to beginning of the path */
    public RJSTrackLocation begin = null;

    /** End of the allowance, defaults to end of the path */
    public RJSTrackLocation end = null;

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
