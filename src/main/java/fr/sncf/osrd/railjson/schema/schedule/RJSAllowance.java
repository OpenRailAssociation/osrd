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
