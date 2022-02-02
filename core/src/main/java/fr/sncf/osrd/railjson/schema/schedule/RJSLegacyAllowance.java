package fr.sncf.osrd.railjson.schema.schedule;

import com.squareup.moshi.Json;
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory;
import fr.sncf.osrd.railjson.schema.common.RJSTrackLocation;

public abstract class RJSLegacyAllowance {
    public static final PolymorphicJsonAdapterFactory<RJSLegacyAllowance> adapter = (
            PolymorphicJsonAdapterFactory.of(RJSLegacyAllowance.class, "type")
                    .withSubtype(Mareco.class, "eco")
                    .withSubtype(Construction.class, "construction")
                    .withSubtype(Linear.class, "linear")
    );

    /** Beginning of the allowance as a track location, defaults to beginning of the path */
    @Json(name = "begin_location")
    public RJSTrackLocation beginLocation = null;

    /** End of the allowance as a track location, defaults to end of the path */
    @Json(name = "end_location")
    public RJSTrackLocation endLocation = null;

    /** Beginning of the allowance as a position of the path, cannot be used with beginLocation */
    @Json(name = "begin_position")
    public Double beginPosition = null;

    /** End of the allowance as a position of the path, cannot be used with beginLocation */
    @Json(name = "end_position")
    public Double endPosition = null;

    public enum MarginType {
        TIME,
        PERCENTAGE,
        DISTANCE,
    }

    public static final class Mareco extends RJSLegacyAllowance {
        public Mareco(MarginType type, double value) {
            this.allowanceValue = value;
            this.allowanceType = type;
        }

        @Json(name = "allowance_type")
        public MarginType allowanceType;

        @Json(name = "allowance_value")
        public double allowanceValue;
    }

    public static final class Linear extends RJSLegacyAllowance {
        public Linear(MarginType type, double value) {
            this.allowanceType = type;
            this.allowanceValue = value;
        }

        @Json(name = "allowance_type")
        public MarginType allowanceType;

        /** If TIME: we add allowanceValue% time
         * If DISTANCE: we add allowanceValue minute per 100km */
        @Json(name = "allowance_value")
        public double allowanceValue;
    }

    public static final class Construction extends RJSLegacyAllowance {
        @Json(name = "allowance_value")
        public double allowanceValue;

        public Construction(double value) {
            this.allowanceValue = value;
        }
    }
}
